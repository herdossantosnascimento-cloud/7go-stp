import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "node:fs";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    return;
  }

  const text = fs.readFileSync(path, "utf8");

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (
      !trimmed ||
      trimmed.startsWith("#") ||
      !trimmed.includes("=")
    ) {
      continue;
    }

    const index = trimmed.indexOf("=");

    const key = trimmed
      .slice(0, index)
      .trim();

    let value = trimmed
      .slice(index + 1)
      .trim();

    if (
      (value.startsWith('"') &&
        value.endsWith('"')) ||
      (value.startsWith("'") &&
        value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env.local");

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID;

const clientEmail =
  process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

const privateKey =
  process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

if (
  !projectId ||
  !clientEmail ||
  !privateKey
) {
  throw new Error(
    "Variáveis FIREBASE_ADMIN_* não encontradas em .env.local",
  );
}

const app =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });

const auth = getAuth(app);

const updated =
  await auth
    .projectConfigManager()
    .updateProjectConfig({
      multiFactorConfig: {
        providerConfigs: [
          {
            state: "ENABLED",
            totpProviderConfig: {
              adjacentIntervals: 5,
            },
          },
        ],
      },
    });

console.log("");
console.log("===== MFA CONFIG =====");
console.log(
  JSON.stringify(
    updated.multiFactorConfig,
    null,
    2,
  ),
);

console.log("");
console.log("✓ TOTP MFA ativado no projeto:");
console.log(projectId);
