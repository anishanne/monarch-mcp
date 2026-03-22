import crypto from "node:crypto";
import type { Collection } from "mongodb";
import { getCollection } from "./db.js";
import { log } from "./logger.js";

const LOGIN_URL = "https://api.monarch.com/auth/login/";

interface TokenDoc {
  _id: string;
  token: string;
  updatedAt: Date;
}

let cachedToken: string | null = null;

function col(): Collection<TokenDoc> | null {
  return getCollection<TokenDoc>("tokens");
}

export async function initTokenManager(): Promise<void> {
  const collection = col();
  if (!collection) return;
  const doc = await collection.findOne({ _id: "monarch_token" });
  if (doc) {
    cachedToken = doc.token;
    console.log(
      `Loaded Monarch token from DB (updated ${doc.updatedAt.toISOString()})`
    );
  }
}

/**
 * Returns all unique token candidates.
 * Order: in-memory cache, DB token, env var token (deduplicated).
 */
export async function getAllTokenCandidates(): Promise<string[]> {
  const tokens: string[] = [];
  const seen = new Set<string>();

  const add = (t: string | null | undefined) => {
    if (t && !seen.has(t)) {
      seen.add(t);
      tokens.push(t);
    }
  };

  add(cachedToken);

  const collection = col();
  if (collection) {
    try {
      const doc = await collection.findOne({ _id: "monarch_token" });
      add(doc?.token);
    } catch {}
  }

  add(process.env.MONARCH_TOKEN);

  return tokens;
}

export async function getToken(): Promise<string> {
  const candidates = await getAllTokenCandidates();
  if (candidates.length > 0) return candidates[0];

  throw new Error(
    "No Monarch token available. Set MONARCH_TOKEN env var or configure MONARCH_EMAIL/MONARCH_PASSWORD for auto-login."
  );
}

export async function saveToken(token: string): Promise<void> {
  cachedToken = token;
  const collection = col();
  if (collection) {
    await collection
      .updateOne(
        { _id: "monarch_token" },
        { $set: { token, updatedAt: new Date() } },
        { upsert: true }
      )
      .catch(() => {});
  }
}

export function clearCachedToken(): void {
  cachedToken = null;
}

function generateTOTP(secret: string): string {
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleanSecret = secret.replace(/[\s=-]/g, "").toUpperCase();
  let bits = "";
  for (const c of cleanSecret) {
    const val = base32Chars.indexOf(c);
    if (val === -1) {
      throw new Error(
        `Invalid character '${c}' in MONARCH_MFA_SECRET — must be a valid base32 string`
      );
    }
    bits += val.toString(2).padStart(5, "0");
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }

  if (bytes.length < 10) {
    throw new Error(
      "Invalid MONARCH_MFA_SECRET — too short, must be a valid base32 TOTP secret"
    );
  }

  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto
    .createHmac("sha1", Buffer.from(bytes))
    .update(counterBuf)
    .digest();

  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 1000000).padStart(6, "0");
}

export async function refreshToken(): Promise<string> {
  const email = process.env.MONARCH_EMAIL;
  const password = process.env.MONARCH_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Cannot auto-refresh: MONARCH_EMAIL and MONARCH_PASSWORD env vars required."
    );
  }

  const mfaSecret = process.env.MONARCH_MFA_SECRET;
  const start = Date.now();

  log({
    type: "token",
    severity: "warning",
    method: "login",
    summary: `Logging in as ${email}${mfaSecret ? " (with TOTP)" : ""}`,
    details: { email, hasMfa: !!mfaSecret },
  });

  const body: Record<string, any> = {
    username: email,
    password,
    supports_mfa: true,
    trusted_device: false,
  };

  if (mfaSecret) {
    body.totp = generateTOTP(mfaSecret);
  }

  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-Platform": "web",
    },
    body: JSON.stringify(body),
  });

  const durationMs = Date.now() - start;

  if (res.status === 403 && !mfaSecret) {
    log({
      type: "token",
      severity: "critical",
      method: "login",
      summary: "Login failed: MFA required but MONARCH_MFA_SECRET not set",
      durationMs,
    });
    throw new Error(
      "MFA required. Set MONARCH_MFA_SECRET env var with your TOTP secret."
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    log({
      type: "token",
      severity: "critical",
      method: "login",
      summary: `Login failed → ${res.status} ${res.statusText}`,
      details: { status: res.status, body: text.slice(0, 500) },
      durationMs,
    });
    throw new Error(
      `Monarch login failed: ${res.status} ${res.statusText}`
    );
  }

  const data: any = await res.json();
  const token = data.token;

  if (!token) {
    log({
      type: "token",
      severity: "critical",
      method: "login",
      summary: "Login response missing token field",
      details: { responseKeys: Object.keys(data) },
      durationMs,
    });
    throw new Error("Monarch login response missing token");
  }

  await saveToken(token);

  log({
    type: "token",
    severity: "info",
    method: "login",
    summary: `Login succeeded — new token saved (${durationMs}ms)`,
    details: { email, tokenPrefix: token.slice(0, 8) + "..." },
    durationMs,
  });

  return token;
}
