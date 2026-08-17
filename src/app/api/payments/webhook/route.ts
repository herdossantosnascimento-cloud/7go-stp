import type Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { sendBookingPaymentConfirmation } from "@/lib/email/sendBookingPaymentConfirmation";
import { getStripe } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getPaymentIntentId(
  paymentIntent: Stripe.Checkout.Session["payment_intent"],
) {
  if (!paymentIntent) {
    return "";
  }

  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

async function confirmPaidCheckout(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
) {
  const bookingId = session.metadata?.bookingId?.trim();
  const bookingReference =
    session.metadata?.bookingReference?.trim() ||
    session.client_reference_id?.trim() ||
    "";

  if (!bookingId) {
    throw new Error(`O evento ${event.id} não contém bookingId na metadata.`);
  }

  const { adminDb } = getFirebaseAdmin();

  const eventReference = adminDb
    .collection("stripeWebhookEvents")
    .doc(event.id);

  const bookingDocument = adminDb.collection("bookings").doc(bookingId);

  await adminDb.runTransaction(async (transaction) => {
    const [processedEventSnapshot, bookingSnapshot] = await Promise.all([
      transaction.get(eventReference),
      transaction.get(bookingDocument),
    ]);

    if (processedEventSnapshot.exists) {
      return;
    }

    if (!bookingSnapshot.exists) {
      throw new Error(`Reserva ${bookingId} não encontrada.`);
    }

    const paymentIntentId = getPaymentIntentId(session.payment_intent);

    const amountPaid =
      typeof session.amount_total === "number" ? session.amount_total / 100 : 0;

    const paymentCurrency = session.currency?.toUpperCase() || "EUR";

    transaction.update(bookingDocument, {
      status: "confirmed",
      paymentStatus: "paid",
      paymentMethod: "stripe",

      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      stripePaymentStatus: session.payment_status,

      paymentAmount: amountPaid,
      paymentCurrency,
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (bookingReference) {
      const statusDocument = adminDb
        .collection("bookingStatus")
        .doc(bookingReference);

      transaction.set(
        statusDocument,
        {
          status: "confirmed",
          paymentStatus: "paid",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    transaction.create(eventReference, {
      eventId: event.id,
      eventType: event.type,
      bookingId,
      bookingReference,
      stripeCheckoutSessionId: session.id,
      processedAt: FieldValue.serverTimestamp(),
    });
  });

  await sendBookingPaymentConfirmation(bookingId);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET não está configurado.");

    return new Response("Webhook Stripe não configurado.", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Cabeçalho Stripe-Signature ausente.", { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Assinatura inválida.";

    console.error("ERRO DE ASSINATURA DO WEBHOOK STRIPE:", message);

    return new Response(`Webhook Error: ${message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status === "paid") {
          await confirmPaidCheckout(event, session);
        }

        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;

        const bookingId = session.metadata?.bookingId?.trim();

        if (bookingId) {
          const { adminDb } = getFirebaseAdmin();

          await adminDb.collection("bookings").doc(bookingId).set(
            {
              stripePaymentStatus: "failed",
              paymentStatus: "pending",
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }

        break;
      }

      default:
        console.log(`Evento Stripe ignorado: ${event.type}`);
    }

    return Response.json({
      received: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    console.error("ERRO AO PROCESSAR WEBHOOK STRIPE:", error);

    return new Response(`Erro ao processar webhook: ${message}`, {
      status: 500,
    });
  }
}
