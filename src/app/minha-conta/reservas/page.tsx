"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { CalendarDays, CarFront, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";

import { auth, db } from "@/lib/firebase/client";

type CustomerBooking = {
  id: string;
  reference?: string;

  status?:
    | "pending"
    | "pending_payment"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "cancelled";

  carBrand?: string;
  carModel?: string;

  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;

  estimatedTotal?: number;
  currency?: string;

  paymentStatus?: "pending" | "partial" | "paid";

  customerEmail?: string;
  authUid?: string;
};

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  pending_payment: "Aguardando pagamento",
  confirmed: "Confirmada",
  in_progress: "Em curso",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const paymentLabels: Record<string, string> = {
  pending: "Pagamento pendente",
  partial: "Pagamento parcial",
  paid: "Pago",
};

export default function CustomerBookingsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  const [bookings, setBookings] = useState<CustomerBooking[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

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

    async function loadBookings() {
      setLoading(true);
      setError("");

      try {
        const results = new Map<string, CustomerBooking>();

        // Reservas novas: ligação direta pelo UID.
        const uidSnapshot = await getDocs(
          query(collection(db, "bookings"), where("authUid", "==", user!.uid)),
        );

        uidSnapshot.forEach((item) => {
          results.set(item.id, {
            id: item.id,
            ...(item.data() as Omit<CustomerBooking, "id">),
          });
        });

        // Compatibilidade com reservas anteriores
        // à criação da conta.
        if (user!.emailVerified && user!.email) {
          const emailSnapshot = await getDocs(
            query(
              collection(db, "bookings"),
              where("customerEmail", "==", user!.email),
            ),
          );

          emailSnapshot.forEach((item) => {
            results.set(item.id, {
              id: item.id,
              ...(item.data() as Omit<CustomerBooking, "id">),
            });
          });
        }

        setBookings(Array.from(results.values()));
      } catch (loadError) {
        console.error("ERRO MINHAS RESERVAS:", loadError);

        setError("Não foi possível carregar as tuas reservas.");
      } finally {
        setLoading(false);
      }
    }

    void loadBookings();
  }, [user]);

  return (
    <main className="customer-account-page">
      <section className="customer-bookings-header">
        <div>
          <Link href="/minha-conta">← Minha conta</Link>

          <span>7GO · Área do cliente</span>

          <h1>Minhas reservas</h1>

          <p>Todas as reservas associadas à tua conta.</p>
        </div>
      </section>

      {user && !user.emailVerified && (
        <div className="customer-account-warning">
          ⚠ Verifica o teu email para também conseguirmos associar reservas
          anteriores à criação da tua conta.
        </div>
      )}

      {loading && (
        <div className="customer-bookings-empty">A carregar reservas...</div>
      )}

      {error && <div className="customer-auth-error">{error}</div>}

      {!loading && !error && bookings.length === 0 && (
        <div className="customer-bookings-empty">
          <CarFront aria-hidden="true" />

          <strong>Ainda não tens reservas</strong>

          <span>Escolhe uma viatura e cria a tua primeira reserva.</span>

          <Link href="/#frota">Ver carros</Link>
        </div>
      )}

      {!loading && bookings.length > 0 && (
        <section className="customer-bookings-grid">
          {bookings.map((booking) => (
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

                <strong>
                  {statusLabels[booking.status ?? "pending"] || booking.status}
                </strong>
              </header>

              <div className="customer-booking-info">
                <div>
                  <CalendarDays aria-hidden="true" />

                  <span>Levantamento</span>

                  <strong>
                    {booking.pickupDate || "-"}
                    {booking.pickupTime ? ` · ${booking.pickupTime}` : ""}
                  </strong>
                </div>

                <div>
                  <CalendarDays aria-hidden="true" />

                  <span>Devolução</span>

                  <strong>
                    {booking.returnDate || "-"}
                    {booking.returnTime ? ` · ${booking.returnTime}` : ""}
                  </strong>
                </div>

                <div>
                  <CreditCard aria-hidden="true" />

                  <span>Pagamento</span>

                  <strong>
                    {paymentLabels[booking.paymentStatus ?? "pending"]}
                  </strong>
                </div>

                <div>
                  <span>Total</span>

                  <strong>
                    {booking.estimatedTotal != null
                      ? `${booking.currency || "€"}${booking.estimatedTotal}`
                      : "-"}
                  </strong>
                </div>
              </div>

              {booking.reference && (
                <Link
                  href={`/minha-reserva?ref=${encodeURIComponent(
                    booking.reference,
                  )}`}
                >
                  Ver detalhes
                </Link>
              )}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
