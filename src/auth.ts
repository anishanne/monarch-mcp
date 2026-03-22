import crypto from "node:crypto";
import type { Response } from "express";
import type {
  OAuthServerProvider,
  AuthorizationParams,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokenRevocationRequest,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";

function signPayload(payload: object, secret: string): string {
  const data = JSON.stringify(payload);
  const encoded = Buffer.from(data).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

function verifyPayload(token: string, secret: string): any | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString());
  } catch {
    return null;
  }
}

function deriveClientSecret(clientId: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`client_secret:${clientId}`)
    .digest("hex");
}

export class SimpleOAuthProvider implements OAuthServerProvider {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  get clientsStore(): OAuthRegisteredClientsStore {
    const secret = this.secret;
    return {
      getClient(clientId: string) {
        const payload = verifyPayload(clientId, secret);
        if (!payload) return undefined;
        return {
          ...payload,
          client_id: clientId,
          client_secret: deriveClientSecret(clientId, secret),
        } as OAuthClientInformationFull;
      },
      registerClient(
        client: Omit<
          OAuthClientInformationFull,
          "client_id" | "client_id_issued_at"
        >
      ) {
        const issuedAt = Math.floor(Date.now() / 1000);
        const clientId = signPayload(
          { ...client, client_id_issued_at: issuedAt },
          secret
        );
        const clientSecret = deriveClientSecret(clientId, secret);
        return {
          ...client,
          client_id: clientId,
          client_secret: clientSecret,
          client_id_issued_at: issuedAt,
        } as OAuthClientInformationFull;
      },
    };
  }

  async authorize(
    client: OAuthClientInformationFull,
    params: AuthorizationParams,
    res: Response
  ): Promise<void> {
    const formData = JSON.stringify({
      clientId: client.client_id,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      state: params.state,
    });

    res.setHeader("Content-Type", "text/html");
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Monarch Money MCP — Authorize</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0a0a0a; color: #e5e5e5;
           display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #1a1a1a; border: 1px solid #333; border-radius: 12px;
            padding: 2rem; width: 100%; max-width: 400px; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { font-size: 0.875rem; color: #888; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; margin-bottom: 0.5rem; }
    input[type="password"] { width: 100%; padding: 0.625rem; background: #0a0a0a;
           border: 1px solid #333; border-radius: 6px; color: #e5e5e5; font-size: 1rem; }
    input[type="password"]:focus { outline: none; border-color: #666; }
    button { width: 100%; padding: 0.625rem; background: #fff; color: #0a0a0a;
             border: none; border-radius: 6px; font-size: 1rem; font-weight: 600;
             cursor: pointer; margin-top: 1rem; }
    button:hover { background: #ddd; }
    .error { color: #f87171; font-size: 0.875rem; margin-top: 0.75rem; display: none; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Monarch Money MCP</h1>
    <p>Enter the server access token to authorize this connection.</p>
    <form id="form">
      <label for="token">Access Token</label>
      <input type="password" id="token" name="token" required autofocus>
      <button type="submit">Authorize</button>
      <div class="error" id="error">Invalid token. Please try again.</div>
    </form>
  </div>
  <script>
    const formData = ${formData};
    document.getElementById('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const token = document.getElementById('token').value;
      try {
        const res = await fetch('/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, token }),
        });
        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        } else {
          document.getElementById('error').style.display = 'block';
        }
      } catch {
        document.getElementById('error').style.display = 'block';
      }
    });
  </script>
</body>
</html>`);
  }

  async challengeForAuthorizationCode(
    _client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<string> {
    const payload = verifyPayload(authorizationCode, this.secret);
    if (!payload) throw new Error("Invalid authorization code");
    if (payload.expiresAt < Date.now()) throw new Error("Code expired");
    return payload.codeChallenge;
  }

  async exchangeAuthorizationCode(
    client: OAuthClientInformationFull,
    authorizationCode: string
  ): Promise<OAuthTokens> {
    const payload = verifyPayload(authorizationCode, this.secret);
    if (!payload) throw new Error("Invalid authorization code");
    if (payload.expiresAt < Date.now()) throw new Error("Code expired");
    if (payload.clientId !== client.client_id)
      throw new Error("Client mismatch");

    const accessToken = signPayload(
      {
        clientId: client.client_id,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      this.secret
    );

    const refreshToken = signPayload(
      { clientId: client.client_id, type: "refresh" },
      this.secret
    );

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 7 * 24 * 60 * 60,
      refresh_token: refreshToken,
    };
  }

  async exchangeRefreshToken(
    client: OAuthClientInformationFull,
    refreshToken: string
  ): Promise<OAuthTokens> {
    const payload = verifyPayload(refreshToken, this.secret);
    if (!payload || payload.clientId !== client.client_id)
      throw new Error("Invalid refresh token");

    const accessToken = signPayload(
      {
        clientId: client.client_id,
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      this.secret
    );

    return {
      access_token: accessToken,
      token_type: "bearer",
      expires_in: 7 * 24 * 60 * 60,
    };
  }

  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (token === this.secret) {
      return {
        token,
        clientId: "direct",
        scopes: [],
        expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
      };
    }

    const payload = verifyPayload(token, this.secret);
    if (!payload) throw new Error("Invalid access token");
    if (payload.expiresAt && payload.expiresAt < Date.now())
      throw new Error("Token expired");

    const expiresAtSec = payload.expiresAt
      ? Math.floor(payload.expiresAt / 1000)
      : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    return {
      token,
      clientId: payload.clientId,
      scopes: [],
      expiresAt: expiresAtSec,
    };
  }

  async revokeToken(
    _client: OAuthClientInformationFull,
    _request: OAuthTokenRevocationRequest
  ): Promise<void> {}

  generateAuthorizationCode(
    clientId: string,
    codeChallenge: string,
    redirectUri: string
  ): string {
    return signPayload(
      {
        clientId,
        codeChallenge,
        redirectUri,
        expiresAt: Date.now() + 60_000,
      },
      this.secret
    );
  }
}
