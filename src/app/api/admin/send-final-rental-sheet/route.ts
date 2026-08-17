import { randomUUID } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import QRCode from "qrcode";
import { Resend } from "resend";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  createFinalRentalSheetPdf,
  type FinalRentalBooking,
} from "@/components/admin/pdf/createFinalRentalSheetPdf";

export const runtime = "nodejs";

const ADMIN_EMAIL = "her.dos.santos.nascimento@gmail.com";

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

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Sessão de Admin inválida." },
        { status: 401 },
      );
    }

    const token = authorization.slice("Bearer ".length);
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const decodedToken = await adminAuth.verifyIdToken(token);

    if (decodedToken.email !== ADMIN_EMAIL) {
      return Response.json(
        { error: "Acesso não autorizado." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      bookingId?: string;
    };

    if (!body.bookingId) {
      return Response.json({ error: "Reserva não indicada." }, { status: 400 });
    }

    const bookingReference = adminDb.collection("bookings").doc(body.bookingId);

    const snapshot = await bookingReference.get();

    if (!snapshot.exists) {
      return Response.json(
        { error: "Reserva não encontrada." },
        { status: 404 },
      );
    }

    const booking = {
      id: snapshot.id,
      ...snapshot.data(),
    } as FinalRentalBooking;

    if (booking.status !== "completed") {
      return Response.json(
        {
          error:
            "A ficha final só pode ser enviada depois de a reserva estar concluída.",
        },
        { status: 409 },
      );
    }

    if (!booking.customerEmail) {
      return Response.json(
        {
          error: "Esta reserva não tem email do cliente registado.",
        },
        { status: 409 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!resendApiKey || !fromEmail) {
      return Response.json(
        {
          error: "O serviço de email ainda não está configurado.",
        },
        { status: 503 },
      );
    }

    const existingVerificationCode =
      typeof booking.verificationCode === "string"
        ? booking.verificationCode.trim().toUpperCase()
        : "";

    const verificationCode =
      existingVerificationCode ||
      randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();

    const requestOrigin = new URL(request.url).origin;

    const verificationUrl = `${requestOrigin}/verificar/${encodeURIComponent(verificationCode)}`;

    const verificationQrDataUrl = await QRCode.toDataURL(verificationUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: {
        dark: "#071109",
        light: "#FFFFFF",
      },
    });

    if (!existingVerificationCode) {
      await bookingReference.update({
        verificationCode,
        verificationIssuedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    const bookingWithVerification: FinalRentalBooking = {
      ...booking,
      verificationCode,
      verificationUrl,
      verificationQrDataUrl,
    };

    const pdfBuffer = await createFinalRentalSheetPdf(bookingWithVerification);

    const resend = new Resend(resendApiKey);
    const recipient = process.env.RESEND_TEST_EMAIL || booking.customerEmail;

    const reference = booking.reference || booking.id;
    const safeCustomerName = escapeHtml(booking.customerName || "Cliente");
    const safeReference = escapeHtml(reference);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [recipient],
      subject: `Ficha final do aluguer — ${reference}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#172019">
          <div style="padding:24px;background:#071109;color:#ffffff;border-radius:16px 16px 0 0">
            <div style="font-size:28px;font-weight:900;color:#22c55e">7GO</div>
            <div style="font-size:11px;letter-spacing:2px">DRIVE YOUR WAY</div>
          </div>

          <div style="padding:28px;border:1px solid #dce4dd;border-top:0;border-radius:0 0 16px 16px">
            <h1 style="font-size:24px;margin:0 0 18px">
              Aluguer concluído
            </h1>

            <p>Olá ${safeCustomerName},</p>

            <p>
              A sua reserva <strong>${safeReference}</strong>
              foi concluída com sucesso.
            </p>

            <p>
              Em anexo segue a sua
              <strong>Ficha Final de Aluguer</strong>, com o
              resumo do veículo, período, valores, entrega e
              devolução.
            </p>

            <p>
              Obrigado por escolher a 7Go STP.
            </p>

            <p style="margin-top:28px">
              <strong>Equipa 7Go STP</strong><br>
              Drive your way
            </p>
          </div>
        </div>
      `,
      attachments: [
        {
          filename: `${reference}-ficha-final.pdf`,
          content: pdfBuffer.toString("base64"),
        },
      ],
    });

    if (error) {
      throw new Error(error.message);
    }

    await bookingReference.update({
      finalSheetEmail: booking.customerEmail,
      finalSheetSentTo: recipient,
      finalSheetSentAt: FieldValue.serverTimestamp(),
      finalSheetResendId: data?.id || "",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json({
      ok: true,
      sentTo: recipient,
      messageId: data?.id || "",
      verificationCode,
      verificationUrl,
      verificationQrDataUrl,
    });
  } catch (error) {
    console.error("ERRO AO ENVIAR FICHA FINAL:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    return Response.json({ error: message }, { status: 500 });
  }
}
