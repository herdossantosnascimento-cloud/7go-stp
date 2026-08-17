import {
  createFinalRentalSheetPdf,
  type FinalRentalBooking,
} from "@/components/admin/pdf/createFinalRentalSheetPdf";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return Response.json({ error: "Sessão inválida." }, { status: 401 });
    }

    const token = authorization.slice("Bearer ".length);

    const { adminAuth, adminDb } = getFirebaseAdmin();

    const decodedToken = await adminAuth.verifyIdToken(token);

    const body = (await request.json()) as {
      bookingId?: string;
    };

    if (!body.bookingId) {
      return Response.json({ error: "Reserva não indicada." }, { status: 400 });
    }

    const snapshot = await adminDb
      .collection("bookings")
      .doc(body.bookingId)
      .get();

    if (!snapshot.exists) {
      return Response.json(
        { error: "Reserva não encontrada." },
        { status: 404 },
      );
    }

    const booking = {
      id: snapshot.id,
      ...snapshot.data(),
    } as FinalRentalBooking & {
      authUid?: string;
      customerEmail?: string;
      status?: string;
    };

    const belongsByUid = booking.authUid === decodedToken.uid;

    const belongsByVerifiedEmail =
      decodedToken.email_verified === true &&
      Boolean(decodedToken.email) &&
      booking.customerEmail === decodedToken.email;

    if (!belongsByUid && !belongsByVerifiedEmail) {
      return Response.json(
        {
          error: "Não tens autorização para consultar esta reserva.",
        },
        { status: 403 },
      );
    }

    if (booking.status !== "completed") {
      return Response.json(
        {
          error:
            "A ficha final só fica disponível depois da conclusão do aluguer.",
        },
        { status: 409 },
      );
    }

    const pdfBuffer = await createFinalRentalSheetPdf(booking);

    const reference = booking.reference || booking.id;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${reference}-ficha-final.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("ERRO PDF CLIENTE:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    return Response.json({ error: message }, { status: 500 });
  }
}
