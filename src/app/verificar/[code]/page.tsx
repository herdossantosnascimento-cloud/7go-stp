import type { Metadata } from "next";

import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verificar documento | 7Go STP",
  robots: {
    index: false,
    follow: false,
  },
};

type VerificationPageProps = {
  params: Promise<{
    code: string;
  }>;
};

function showValue(value: unknown, fallback = "Não registado") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
}

function formatDate(value: unknown) {
  if (!value) {
    return "Não registada";
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toLocaleString("pt-PT");
  }

  const date = new Date(String(value));

  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString("pt-PT");
}

export default async function VerificationPage({
  params,
}: VerificationPageProps) {
  const { code } = await params;
  const normalizedCode = decodeURIComponent(code).trim().toUpperCase();

  const { adminDb } = getFirebaseAdmin();

  const result = await adminDb
    .collection("bookings")
    .where("verificationCode", "==", normalizedCode)
    .limit(1)
    .get();

  if (result.empty) {
    return (
      <main className="verification-page">
        <section className="verification-card verification-card-invalid">
          <img
            src="/images/7go-stp-official-logo.png"
            alt="7Go STP"
            className="verification-logo"
          />

          <span className="verification-status-icon">×</span>
          <h1>Documento inválido</h1>

          <p>
            Não foi possível encontrar um documento oficial 7Go associado a este
            código.
          </p>

          <small>Código consultado: {normalizedCode}</small>
        </section>
      </main>
    );
  }

  const snapshot = result.docs[0];
  const booking = snapshot.data();

  const vehicle = [booking.carBrand, booking.carModel]
    .filter(Boolean)
    .join(" ");

  return (
    <main className="verification-page">
      <section className="verification-card">
        <header className="verification-header">
          <img
            src="/images/7go-stp-official-logo.png"
            alt="7Go STP"
            className="verification-logo"
          />

          <div>
            <span>Validação documental</span>
            <h1>Documento oficial 7Go</h1>
          </div>
        </header>

        <div className="verification-valid">
          <span>✓</span>

          <div>
            <strong>Documento válido</strong>
            <small>
              Esta ficha foi emitida pelo sistema oficial da 7Go STP.
            </small>
          </div>
        </div>

        <div className="verification-grid">
          <div>
            <span>Referência</span>
            <strong>{showValue(booking.reference || snapshot.id)}</strong>
          </div>

          <div>
            <span>Estado</span>
            <strong>{showValue(booking.status)}</strong>
          </div>

          <div>
            <span>Viatura</span>
            <strong>{showValue(vehicle)}</strong>
          </div>

          <div>
            <span>Matrícula</span>
            <strong>
              {showValue(
                booking.carRegistrationPlate ||
                  booking.checkout?.registrationPlate,
              )}
            </strong>
          </div>

          <div>
            <span>Data de entrega</span>
            <strong>
              {showValue(booking.pickupDate)}
              {booking.pickupTime ? ` às ${booking.pickupTime}` : ""}
            </strong>
          </div>

          <div>
            <span>Data de devolução</span>
            <strong>
              {showValue(booking.returnDate)}
              {booking.returnTime ? ` às ${booking.returnTime}` : ""}
            </strong>
          </div>

          <div>
            <span>Ficha emitida em</span>
            <strong>{formatDate(booking.verificationIssuedAt)}</strong>
          </div>

          <div>
            <span>Código de validação</span>
            <strong>{normalizedCode}</strong>
          </div>
        </div>

        <div className="verification-security-note">
          Por segurança, esta página não apresenta email, telefone, morada,
          documentos de identificação, valores financeiros ou assinaturas do
          cliente.
        </div>

        <footer>
          <strong>7Go STP</strong>
          <span>Drive Your Way</span>
        </footer>
      </section>
    </main>
  );
}
