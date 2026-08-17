"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FileCheck2, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

import { auth, db } from "@/lib/firebase/client";

type CustomerDocumentBooking = {
  id: string;
  reference?: string;
  authUid?: string;
  customerEmail?: string;
  status?: string;

  carBrand?: string;
  carModel?: string;

  verificationCode?: string;
  finalSheetSentTo?: string;
  finalSheetSentAt?: unknown;
};

export default function CustomerDocumentsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  const [documents, setDocuments] = useState<CustomerDocumentBooking[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);
    });
  }, [router]);

  useEffect(() => {
    if (!user) return;

    async function loadDocuments() {
      setLoading(true);
      setError("");

      try {
        const results = new Map<string, CustomerDocumentBooking>();

        const uidSnapshot = await getDocs(
          query(collection(db, "bookings"), where("authUid", "==", user!.uid)),
        );

        uidSnapshot.docs.forEach((item) => {
          results.set(item.id, {
            id: item.id,
            ...(item.data() as Omit<CustomerDocumentBooking, "id">),
          });
        });

        if (user!.emailVerified && user!.email) {
          const emailSnapshot = await getDocs(
            query(
              collection(db, "bookings"),
              where("customerEmail", "==", user!.email),
            ),
          );

          emailSnapshot.docs.forEach((item) => {
            results.set(item.id, {
              id: item.id,
              ...(item.data() as Omit<CustomerDocumentBooking, "id">),
            });
          });
        }

        const completed = Array.from(results.values()).filter(
          (booking) =>
            booking.status === "completed" || Boolean(booking.verificationCode),
        );

        setDocuments(completed);
      } catch (loadError) {
        console.error("ERRO DOCUMENTOS CLIENTE:", loadError);

        setError("Não foi possível carregar os documentos.");
      } finally {
        setLoading(false);
      }
    }

    void loadDocuments();
  }, [user]);

  async function openFinalSheet(bookingId: string) {
    if (!user) return;

    setOpeningId(bookingId);
    setError("");

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/customer/final-sheet", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookingId,
        }),
      });

      if (!response.ok) {
        const result = (await response.json()) as {
          error?: string;
        };

        throw new Error(
          result.error || "Não foi possível abrir a ficha final.",
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      window.open(url, "_blank", "noopener,noreferrer");

      window.setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
    } catch (openError) {
      console.error("ERRO AO ABRIR FICHA FINAL:", openError);

      setError(
        openError instanceof Error
          ? openError.message
          : "Não foi possível abrir a ficha final.",
      );
    } finally {
      setOpeningId("");
    }
  }

  return (
    <main className="customer-account-page">
      <section className="customer-bookings-header">
        <div>
          <Link href="/minha-conta">← Minha conta</Link>

          <span>7GO · Área do cliente</span>

          <h1>Documentos</h1>

          <p>Consulta fichas finais e códigos de verificação.</p>
        </div>
      </section>

      {loading && (
        <div className="customer-bookings-empty">A carregar documentos...</div>
      )}

      {error && <div className="customer-auth-error">{error}</div>}

      {!loading && !error && documents.length === 0 && (
        <div className="customer-bookings-empty">
          <FileCheck2 aria-hidden="true" />

          <strong>Ainda não existem documentos</strong>

          <span>
            As fichas finais aparecem aqui depois da conclusão do aluguer.
          </span>
        </div>
      )}

      {!loading && documents.length > 0 && (
        <section className="customer-bookings-grid">
          {documents.map((booking) => (
            <article key={booking.id} className="customer-booking-card">
              <header>
                <div>
                  <span>{booking.reference || "Reserva 7Go"}</span>

                  <h2>
                    {[booking.carBrand, booking.carModel]
                      .filter(Boolean)
                      .join(" ") || "Viatura"}
                  </h2>
                </div>

                <strong>Documento final</strong>
              </header>

              <div className="customer-booking-info">
                <div>
                  <FileCheck2 aria-hidden="true" />

                  <span>Ficha final</span>

                  <strong>
                    {booking.finalSheetSentAt ? "Enviada" : "Disponível"}
                  </strong>
                </div>

                <div>
                  <ShieldCheck aria-hidden="true" />

                  <span>Código</span>

                  <strong>{booking.verificationCode || "Não emitido"}</strong>
                </div>
              </div>

              {booking.finalSheetSentTo && (
                <small>Enviada para: {booking.finalSheetSentTo}</small>
              )}

              <button
                type="button"
                className="customer-document-pdf-button"
                disabled={openingId === booking.id}
                onClick={() => void openFinalSheet(booking.id)}
              >
                {openingId === booking.id
                  ? "A preparar PDF..."
                  : "📄 Abrir ficha final PDF"}
              </button>

              {booking.verificationCode && (
                <Link
                  href={`/verificar/${encodeURIComponent(
                    booking.verificationCode,
                  )}`}
                >
                  Verificar documento
                </Link>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
