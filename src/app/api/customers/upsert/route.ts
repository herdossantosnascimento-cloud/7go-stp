import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

type CustomerRequest = {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
};

function cleanText(value: unknown, maximumLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maximumLength) : "";
}

function normaliseEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalisePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function createCustomerId(email: string, phone: string) {
  const identity = email ? `email:${email}` : `phone:${phone}`;

  return `cus_${createHash("sha256")
    .update(identity)
    .digest("hex")
    .slice(0, 24)}`;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CustomerRequest;

    const name = cleanText(body.name, 120);
    const email = normaliseEmail(cleanText(body.email, 180));
    const phone = normalisePhone(cleanText(body.phone, 40));

    if (!name) {
      return Response.json(
        { error: "O nome do cliente é obrigatório." },
        { status: 400 },
      );
    }

    if (!email && !phone) {
      return Response.json(
        {
          error: "É necessário indicar email ou contacto do cliente.",
        },
        { status: 400 },
      );
    }

    const customerId = createCustomerId(email, phone);
    const { adminDb } = getFirebaseAdmin();

    const customerRef = adminDb.collection("customers").doc(customerId);

    const snapshot = await customerRef.get();

    if (snapshot.exists) {
      await customerRef.update({
        name,
        email,
        phone,
        normalisedEmail: email,
        normalisedPhone: phone,
        lastBookingAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await customerRef.set({
        name,
        email,
        phone,
        normalisedEmail: email,
        normalisedPhone: phone,
        status: "active",
        internalNotes: "",
        bookingCount: 0,
        totalSpent: 0,
        firstBookingAt: FieldValue.serverTimestamp(),
        lastBookingAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return Response.json({
      ok: true,
      customerId,
    });
  } catch (error) {
    console.error("ERRO AO CRIAR/ATUALIZAR CLIENTE:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    return Response.json({ error: message }, { status: 500 });
  }
}
