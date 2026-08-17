import { FieldValue } from "firebase-admin/firestore";
import { Resend } from "resend";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

const ADMIN_EMAIL = "her.dos.santos.nascimento@gmail.com";

type PaidBooking = {
  reference?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;

  carBrand?: string;
  carModel?: string;

  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  totalDays?: number;

  paymentAmount?: number;
  finalAmount?: number;
  estimatedTotal?: number;
  paymentCurrency?: string;
  currency?: string;

  paymentConfirmationEmailSentAt?: unknown;
  adminPaymentNotificationSentAt?: unknown;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] || character,
  );
}

function formatMoney(value: number, currency: string) {
  const symbol =
    currency.toUpperCase() === "EUR" || currency === "€" ? "€" : currency;

  return `${symbol}${Number(value || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatRentalDate(date?: string, time?: string) {
  if (!date) {
    return "Por confirmar";
  }

  const parts = date.split("-");

  const formattedDate =
    parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;

  return time ? `${formattedDate} às ${time}` : formattedDate;
}

export async function sendBookingPaymentConfirmation(bookingId: string) {
  const { adminDb } = getFirebaseAdmin();

  const bookingReference = adminDb.collection("bookings").doc(bookingId);

  const snapshot = await bookingReference.get();

  if (!snapshot.exists) {
    throw new Error(`Reserva ${bookingId} não encontrada para envio de email.`);
  }

  const booking = snapshot.data() as PaidBooking;

  const resendApiKey = process.env.RESEND_API_KEY;

  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !fromEmail) {
    throw new Error("RESEND_API_KEY ou RESEND_FROM_EMAIL não configurado.");
  }

  const resend = new Resend(resendApiKey);

  const reference = booking.reference || bookingId;

  const customerName = booking.customerName || "Cliente";

  const vehicle = `${booking.carBrand || "Viatura"} ${
    booking.carModel || ""
  }`.trim();

  const amount =
    Number(
      booking.paymentAmount ??
        booking.finalAmount ??
        booking.estimatedTotal ??
        0,
    ) || 0;

  const currency = booking.paymentCurrency || booking.currency || "EUR";

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  /*
   * EMAIL DO CLIENTE
   */

  if (booking.customerEmail && !booking.paymentConfirmationEmailSentAt) {
    const recipient = process.env.RESEND_TEST_EMAIL || booking.customerEmail;

    const safeName = escapeHtml(customerName);

    const safeReference = escapeHtml(reference);

    const safeVehicle = escapeHtml(vehicle);

    const result = await resend.emails.send({
      from: fromEmail,
      to: [recipient],
      subject: `Pagamento confirmado — ${reference}`,
      html: `
        <div style="background:#f5f7f5;padding:32px 14px;font-family:Arial,sans-serif;color:#172019">
          <div style="max-width:640px;margin:auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dce4dd">

            <div style="padding:28px;background:#071109;color:#ffffff">
              <div style="font-size:30px;font-weight:900;color:#22c55e">
                7GO
              </div>

              <div style="font-size:10px;letter-spacing:2px">
                DRIVE YOUR WAY
              </div>
            </div>

            <div style="padding:30px">
              <div style="display:inline-block;padding:7px 12px;border-radius:999px;background:#dcfce7;color:#166534;font-size:11px;font-weight:700">
                ✓ Pagamento confirmado
              </div>

              <h1 style="margin:18px 0 8px;font-size:25px">
                Reserva confirmada
              </h1>

              <p>
                Olá ${safeName},
              </p>

              <p style="line-height:1.6;color:#475569">
                Recebemos o pagamento da sua reserva
                <strong>${safeReference}</strong>.
                A sua viatura encontra-se agora reservada.
              </p>

              <div style="margin:24px 0;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden">
                <div style="padding:14px 17px;background:#f8fafc">
                  <strong>${safeVehicle}</strong>
                </div>

                <div style="padding:17px;line-height:1.8;font-size:14px">
                  <div>
                    <strong>Referência:</strong>
                    ${safeReference}
                  </div>

                  <div>
                    <strong>Levantamento:</strong>
                    ${escapeHtml(
                      formatRentalDate(booking.pickupDate, booking.pickupTime),
                    )}
                  </div>

                  <div>
                    <strong>Devolução:</strong>
                    ${escapeHtml(
                      formatRentalDate(booking.returnDate, booking.returnTime),
                    )}
                  </div>

                  <div>
                    <strong>Duração:</strong>
                    ${booking.totalDays || 0} dia(s)
                  </div>

                  <div style="margin-top:10px;font-size:17px">
                    <strong>Total pago:</strong>
                    ${formatMoney(amount, currency)}
                  </div>
                </div>
              </div>

              <a
                href="${siteUrl}/minha-reserva"
                style="display:inline-block;padding:13px 19px;background:#22c55e;color:#052e16;text-decoration:none;border-radius:10px;font-size:13px;font-weight:800"
              >
                Consultar minha reserva
              </a>

              <p style="margin-top:28px;color:#64748b;font-size:12px;line-height:1.6">
                Guarde a referência
                <strong>${safeReference}</strong>.
                Poderá ser necessária durante o levantamento da viatura.
              </p>

              <p style="margin-top:26px">
                <strong>Equipa 7Go STP</strong><br>
                <span style="color:#64748b">
                  Drive your way
                </span>
              </p>
            </div>
          </div>
        </div>
      `,
    });

    if (result.error) {
      throw new Error(`Erro no email do cliente: ${result.error.message}`);
    }

    await bookingReference.update({
      paymentConfirmationEmail: booking.customerEmail,
      paymentConfirmationEmailSentTo: recipient,
      paymentConfirmationEmailSentAt: FieldValue.serverTimestamp(),
      paymentConfirmationResendId: result.data?.id || "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  /*
   * EMAIL DO ADMIN
   */

  const refreshedSnapshot = await bookingReference.get();

  const refreshed = refreshedSnapshot.data() as PaidBooking;

  if (!refreshed.adminPaymentNotificationSentAt) {
    const adminResult = await resend.emails.send({
      from: fromEmail,
      to: [ADMIN_EMAIL],
      subject: `Nova reserva paga — ${reference}`,
      html: `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172019">
            <div style="padding:24px;background:#071109;color:#ffffff;border-radius:16px 16px 0 0">
              <div style="font-size:28px;font-weight:900;color:#22c55e">
                7GO
              </div>
              <div style="font-size:11px;letter-spacing:2px">
                NOVA RESERVA PAGA
              </div>
            </div>

            <div style="padding:28px;border:1px solid #dce4dd;border-top:0;border-radius:0 0 16px 16px">
              <h1 style="font-size:22px;margin-top:0">
                Pagamento recebido
              </h1>

              <p>
                Uma nova reserva foi paga através da Stripe.
              </p>

              <div style="padding:18px;background:#f8fafc;border-radius:12px;line-height:1.8">
                <strong>Referência:</strong>
                ${escapeHtml(reference)}<br>

                <strong>Cliente:</strong>
                ${escapeHtml(customerName)}<br>

                <strong>Email:</strong>
                ${escapeHtml(booking.customerEmail || "—")}<br>

                <strong>Contacto:</strong>
                ${escapeHtml(booking.customerPhone || "—")}<br>

                <strong>Viatura:</strong>
                ${escapeHtml(vehicle)}<br>

                <strong>Levantamento:</strong>
                ${escapeHtml(
                  formatRentalDate(booking.pickupDate, booking.pickupTime),
                )}<br>

                <strong>Devolução:</strong>
                ${escapeHtml(
                  formatRentalDate(booking.returnDate, booking.returnTime),
                )}<br>

                <strong>Total recebido:</strong>
                ${formatMoney(amount, currency)}
              </div>

              <a
                href="${siteUrl}/admin/reservas"
                style="display:inline-block;margin-top:20px;padding:12px 18px;background:#071109;color:#ffffff;text-decoration:none;border-radius:9px;font-weight:700"
              >
                Abrir painel 7Go
              </a>
            </div>
          </div>
        `,
    });

    if (adminResult.error) {
      throw new Error(`Erro no email do Admin: ${adminResult.error.message}`);
    }

    await bookingReference.update({
      adminPaymentNotificationSentAt: FieldValue.serverTimestamp(),
      adminPaymentNotificationResendId: adminResult.data?.id || "",
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  return {
    ok: true,
  };
}
