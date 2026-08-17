"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { CreditCard, ReceiptText, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { auth, db } from "@/lib/firebase/client";

type CustomerPayment = {
  id: string;
  reference?: string;
  customerEmail?: string;
  authUid?: string;

  carBrand?: string;
  carModel?: string;

  paymentStatus?: "pending" | "partial" | "paid";

  paymentMethod?: "stripe" | "cash";

  paymentAmount?: number;
  estimatedTotal?: number;

  currency?: string;

  stripePaymentStatus?: string;
  stripePaymentIntentId?: string;
};

const paymentLabels: Record<string, string> = {
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago",
};

const methodLabels: Record<string, string> = {
  stripe: "Stripe",
  cash: "Dinheiro",
};

export default function CustomerPaymentsPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  const [payments, setPayments] = useState<CustomerPayment[]>([]);

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
    if (!user?.email) return;

    async function loadPayments() {
      setLoading(true);
      setError("");

      try {
        const results = new Map<string, CustomerPayment>();

        const uidSnapshot = await getDocs(
          query(collection(db, "bookings"), where("authUid", "==", user!.uid)),
        );

        uidSnapshot.docs.forEach((item) => {
          results.set(item.id, {
            id: item.id,
            ...(item.data() as Omit<CustomerPayment, "id">),
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
              ...(item.data() as Omit<CustomerPayment, "id">),
            });
          });
        }

        setPayments(Array.from(results.values()));
      } catch (loadError) {
        console.error("ERRO PAGAMENTOS CLIENTE:", loadError);

        setError("Não foi possível carregar os pagamentos.");
      } finally {
        setLoading(false);
      }
    }

    void loadPayments();
  }, [user]);

  return (
    <main className="customer-account-page">
      <section className="customer-bookings-header">
        <div>
          <Link href="/minha-conta">← Minha conta</Link>

          <span>7GO · Área do cliente</span>

          <h1>Pagamentos</h1>

          <p>Consulta os pagamentos associados às tuas reservas.</p>
        </div>
      </section>

      {loading && (
        <div className="customer-bookings-empty">A carregar pagamentos...</div>
      )}

      {error && <div className="customer-auth-error">{error}</div>}

      {!loading && !error && payments.length === 0 && (
        <div className="customer-bookings-empty">
          <CreditCard aria-hidden="true" />

          <strong>Ainda não existem pagamentos</strong>

          <span>Os pagamentos das tuas reservas vão aparecer aqui.</span>
        </div>
      )}

      {!loading && payments.length > 0 && (
        <section className="customer-bookings-grid">
          {payments.map((payment) => {
            const total = payment.estimatedTotal ?? 0;

            const paid = payment.paymentAmount ?? 0;

            const remaining = Math.max(0, total - paid);

            const currency = payment.currency || "€";

            return (
              <article key={payment.id} className="customer-booking-card">
                <header>
                  <div>
                    <span>{payment.reference || "Reserva 7Go"}</span>

                    <h2>
                      {[payment.carBrand, payment.carModel]
                        .filter(Boolean)
                        .join(" ") || "Viatura"}
                    </h2>
                  </div>

                  <strong>
                    {paymentLabels[payment.paymentStatus ?? "pending"]}
                  </strong>
                </header>

                <div className="customer-booking-info">
                  <div>
                    <WalletCards aria-hidden="true" />

                    <span>Método</span>

                    <strong>
                      {methodLabels[payment.paymentMethod ?? ""] ||
                        "Não definido"}
                    </strong>
                  </div>

                  <div>
                    <ReceiptText aria-hidden="true" />

                    <span>Total</span>

                    <strong>
                      {currency}
                      {total.toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <CreditCard aria-hidden="true" />

                    <span>Pago</span>

                    <strong>
                      {currency}
                      {paid.toFixed(2)}
                    </strong>
                  </div>

                  <div>
                    <span>Em falta</span>

                    <strong>
                      {currency}
                      {remaining.toFixed(2)}
                    </strong>
                  </div>
                </div>

                {payment.stripePaymentIntentId && (
                  <small>Stripe ID: {payment.stripePaymentIntentId}</small>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
