import * as readline from "node:readline/promises";
import { stdin, stdout } from "node:process";

const LOGIN_URL = "https://api.monarch.com/auth/login/";

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    const email = await rl.question("Monarch Money email: ");
    const password = await rl.question("Password: ");

    console.log("\nAttempting login...");

    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Platform": "web",
      },
      body: JSON.stringify({
        username: email,
        password,
        supports_mfa: true,
        trusted_device: false,
      }),
    });

    if (res.status === 403) {
      // MFA required
      const mfaCode = await rl.question("MFA code: ");

      const mfaRes = await fetch(LOGIN_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Platform": "web",
        },
        body: JSON.stringify({
          username: email,
          password,
          supports_mfa: true,
          trusted_device: false,
          totp: mfaCode,
        }),
      });

      if (!mfaRes.ok) {
        console.error(
          `MFA login failed: ${mfaRes.status} ${mfaRes.statusText}`
        );
        const body = await mfaRes.text();
        console.error(body);
        process.exit(1);
      }

      const data = await mfaRes.json();
      printToken(data.token);
    } else if (res.ok) {
      const data = await res.json();
      printToken(data.token);
    } else {
      console.error(`Login failed: ${res.status} ${res.statusText}`);
      const body = await res.text();
      console.error(body);
      process.exit(1);
    }
  } finally {
    rl.close();
  }
}

function printToken(token: string) {
  console.log("\n--- SUCCESS ---");
  console.log(`\nYour MONARCH_TOKEN:\n\n${token}`);
  console.log("\nAdd this to your .env file or Vercel environment variables:");
  console.log(`  MONARCH_TOKEN=${token}`);
}

main().catch(console.error);
