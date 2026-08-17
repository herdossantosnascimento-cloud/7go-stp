import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";

type CheckoutBooking = {
  reference?: string;
  status?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  totalDays?: number;
  finalAmount?: number;
  estimatedTotal?: number;
  currencyCode?: string;
};

function cleanMetadata(value: unknown) {
  return String(value ?? "").slice(0, 500);
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      bookingId?: string;
    };

    const bookingId = body.bookingId?.trim();

    if (!bookingId) {
      return Response.json({ error: "Reserva inválida." }, { status: 400 });
    }

    const { adminDb } = getFirebaseAdmin();

    const bookingReference = adminDb.collection("bookings").doc(bookingId);

    const bookingSnapshot = await bookingReference.get();

    if (!bookingSnapshot.exists) {
      return Response.json(
        { error: "Reserva não encontrada." },
        { status: 404 },
      );
    }

    const booking = bookingSnapshot.data() as CheckoutBooking;

    if (booking.paymentMethod !== "stripe") {
      return Response.json(
        {
          error: "Esta reserva não está configurada para pagamento Stripe.",
        },
        { status: 400 },
      );
    }

    if (booking.paymentStatus === "paid") {
      return Response.json(
        { error: "Esta reserva já está paga." },
        { status: 409 },
      );
    }

    const amount = Number(booking.finalAmount ?? booking.estimatedTotal ?? 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return Response.json(
        { error: "Valor da reserva inválido." },
        { status: 400 },
      );
    }

    const amountInCents = Math.round(amount * 100);

    const reference = booking.reference || bookingId;

    const vehicleName = `${booking.carBrand || "Viatura"} ${
      booking.carModel || ""
    }`.trim();

    const origin =
      request.headers.get("origin") ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      new URL(request.url).origin;

    const metadata = {
      bookingId,
      bookingReference: cleanMetadata(reference),
      carId: cleanMetadata(booking.carId),
      carName: cleanMetadata(vehicleName),
      customerName: cleanMetadata(booking.customerName),
      customerEmail: cleanMetadata(booking.customerEmail),
      customerPhone: cleanMetadata(booking.customerPhone),
      pickupDate: cleanMetadata(booking.pickupDate),
      pickupTime: cleanMetadata(booking.pickupTime),
      returnDate: cleanMetadata(booking.returnDate),
      returnTime: cleanMetadata(booking.returnTime),
      totalDays: cleanMetadata(booking.totalDays),
    };

    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: booking.customerEmail || undefined,
      client_reference_id: reference,
      success_url:
        `${origin}/reserva/sucesso?ref=${encodeURIComponent(reference)}` +
        "&payment=stripe" +
        "&session_id={CHECKOUT_SESSION_ID}",
      cancel_url:
        `${origin}/carros/${encodeURIComponent(booking.carId || "")}` +
        `?payment=cancelled&ref=${encodeURIComponent(reference)}`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountInCents,
            product_data: {
              name: `Reserva 7Go — ${vehicleName}`,
              description:
                `${booking.pickupDate || "Data"} ${
                  booking.pickupTime || ""
                } → ` +
                `${booking.returnDate || "Data"} ${
                  booking.returnTime || ""
                } · ` +
                `${booking.totalDays || 0} dia(s)`,
              metadata: {
                bookingReference: reference,
                carId: booking.carId || "",
              },
            },
          },
        },
      ],
      metadata,
      payment_intent_data: {
        metadata,
      },
    });

    if (!session.url) {
      throw new Error("A Stripe não devolveu o endereço do Checkout.");
    }

    await bookingReference.update({
      stripeCheckoutSessionId: session.id,
      stripeCheckoutUrl: session.url,
      stripeCheckoutCreatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (booking.reference) {
      await adminDb.collection("bookingStatus").doc(booking.reference).set(
        {
          paymentStatus: "pending",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    return Response.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    console.error("ERRO AO CRIAR STRIPE CHECKOUT:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    return Response.json({ error: message }, { status: 500 });
  }
}
