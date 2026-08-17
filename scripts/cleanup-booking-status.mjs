import fs from "node:fs";

import {
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import {
  FieldValue,
  getFirestore,
} from "firebase-admin/firestore";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return;

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

    const key = trimmed.slice(0, index).trim();

    let value = trimmed.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
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

if (!projectId || !clientEmail || !privateKey) {
  throw new Error(
    "FIREBASE_ADMIN_* não configurado.",
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

const db = getFirestore(app);

const snapshot =
  await db.collection("bookingStatus").get();

const backup = snapshot.docs.map((doc) => ({
  id: doc.id,
  data: doc.data(),
}));

const backupPath =
  process.env.BOOKINGSTATUS_BACKUP_PATH;

if (!backupPath) {
  throw new Error(
    "BOOKINGSTATUS_BACKUP_PATH não definido.",
  );
}

fs.writeFileSync(
  backupPath,
  JSON.stringify(backup, null, 2),
  "utf8",
);

console.log(
  `✓ Backup JSON criado com ${backup.length} documentos`,
);

const privateFields = [
  "bookingId",
  "customerId",
  "customerName",
  "customerPhone",
  "customerEmail",

  "carRegistrationPlate",
  "carVehicleColor",

  "pickupAt",
  "returnAt",
  "rentalHours",

  "baseAmount",
  "payLaterFee",
  "finalAmount",
  "currencyCode",

  "paymentChoice",
  "paymentMethod",

  "stripeCheckoutSessionId",
  "stripePaymentIntentId",
  "stripePaymentStatus",
  "paymentAmount",
  "paymentCurrency",
  "paidAt",

  "createdAt",
];

let cleaned = 0;

for (const doc of snapshot.docs) {
  const data = doc.data();

  const fieldsToDelete = {};

  for (const field of privateFields) {
    if (Object.prototype.hasOwnProperty.call(data, field)) {
      fieldsToDelete[field] =
        FieldValue.delete();
    }
  }

  const names = Object.keys(fieldsToDelete);

  if (names.length === 0) {
    continue;
  }

  await doc.ref.update({
    ...fieldsToDelete,
    updatedAt:
      FieldValue.serverTimestamp(),
  });

  cleaned += 1;

  console.log(
    `✓ ${doc.id}: removidos ${names.join(", ")}`,
  );
}

console.log("");
console.log(
  `✓ Limpeza concluída: ${cleaned} documentos alterados`,
);
