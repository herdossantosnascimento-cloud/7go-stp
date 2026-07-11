"use client";

import { doc, getDoc } from "firebase/firestore";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  CarFront,
  Clock3,
  CreditCard,
  Hash,
  MessageCircle,
  Search,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { db } from "@/lib/firebase/client";

type PublicBookingStatus = {
  reference?: string;
  status?:
    | "pending"
    | "confirmed"
    | "in_progress"
    | "completed"
    | "cancelled";
  carBrand?: string;
  carModel?: string;
  pickupDate?: string;
  returnDate?: string;
  totalDays?: number;
  rentalModeLabel?: string;
  pricePerDay?: number;
  premiumPricePerDay?: number;
  dailyRate?: number;
  normalExcess?: number;
  appliedExcess?: number;
  refundableDeposit?: number;
  estimatedTotal?: number;
  currency?: string;
  paymentStatus?: "pending" | "partial" | "paid";
  depositStatus?: "pending" | "received" | "returned" | "retained";
};

const statusLabel = {
  pending: "Pendente",
  confirmed: "Confirmada",
  in_progress: "Em curso",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const paymentStatusLabel = {
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago",
};

const depositStatusLabel = {
  pending: "Pendente",
  received: "Recebida / bloqueada",
  returned: "Devolvida",
  retained: "Retida",
};

const whatsappNumber = "41796600932";

export function MyBookingLookup() {
  const [reference, setReference] = useState("");
  const [booking, setBooking] = useState<PublicBookingStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function searchBooking() {
    const cleanReference = reference.trim().toUpperCase();

    if (!cleanReference) {
      setError("Introduz a referência da reserva.");
      return;
    }

    setLoading(true);
    setError("");
    setBooking(null);

    try {
      const snapshot = await getDoc(doc(db, "bookingStatus", cleanReference));

      if (!snapshot.exists()) {
        setError("Não encontrámos nenhuma reserva com essa referência.");
        return;
      }

      setBooking(snapshot.data() as PublicBookingStatus);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido.";
      setError(`Erro ao procurar reserva: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  const whatsappUrl = booking
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `Olá 7Go STP, quero falar sobre a minha reserva ${booking.reference}.`,
      )}`
    : "";

  const currentStatus = booking?.status ?? "pending";
  const currency = booking?.currency ?? "£";
  const dailyPrice = booking?.dailyRate ?? booking?.pricePerDay;
  const appliedExcess =
    booking?.appliedExcess ?? booking?.normalExcess;

  return (
    <div className="my-booking-card">
      <div className="my-booking-search-header">
        <div className="my-booking-search-icon">
          <Search aria-hidden="true" />
        </div>

        <div>
          <span>Consulta segura</span>
          <h2>Encontra a tua reserva</h2>
          <p>
            Utiliza a referência 7GO recebida no momento do pedido.
          </p>
        </div>
      </div>

      <div className="my-booking-search-field">
        <label htmlFor="booking-reference">
          Referência da reserva
        </label>

        <div>
          <Hash aria-hidden="true" />

          <input
            id="booking-reference"
            value={reference}
            onChange={(e) =>
              setReference(e.target.value.toUpperCase())
            }
            placeholder="Ex.: 7GO-LUTNYT"
          />
        </div>
      </div>

      <button
        className="my-booking-search-button"
        type="button"
        onClick={searchBooking}
        disabled={loading}
      >
        <Search aria-hidden="true" />

        {loading ? "A procurar..." : "Ver estado da reserva"}

        {!loading && <ArrowRight aria-hidden="true" />}
      </button>

      {error && (
        <p className="form-warning my-booking-error">
          {error}
        </p>
      )}

      {booking && (
        <div className="my-booking-result">
          <div className="my-booking-result-header">
            <div>
              <span>Referência da reserva</span>
              <strong>{booking.reference}</strong>
            </div>

            <div
              className={`my-booking-status my-booking-status-${currentStatus}`}
            >
              <i />
              {statusLabel[currentStatus]}
            </div>
          </div>

          <section className="my-booking-result-section">
            <div className="my-booking-result-title">
              <CarFront aria-hidden="true" />

              <div>
                <strong>Viagem</strong>
                <small>Carro e período do aluguer</small>
              </div>
            </div>

            <div className="my-booking-result-grid">
              <div>
                <span>Carro</span>
                <strong>
                  {[booking.carBrand, booking.carModel]
                    .filter(Boolean)
                    .join(" ") || "Não registado"}
                </strong>
              </div>

              <div>
                <span>Modalidade</span>
                <strong>
                  {booking.rentalModeLabel || "Não registada"}
                </strong>
              </div>

              <div>
                <span>
                  <CalendarDays aria-hidden="true" />
                  Levantamento
                </span>
                <strong>
                  {booking.pickupDate || "Não registado"}
                </strong>
              </div>

              <div>
                <span>
                  <CalendarDays aria-hidden="true" />
                  Devolução
                </span>
                <strong>
                  {booking.returnDate || "Não registada"}
                </strong>
              </div>

              <div>
                <span>
                  <Clock3 aria-hidden="true" />
                  Dias
                </span>
                <strong>
                  {booking.totalDays ?? "Não registado"}
                </strong>
              </div>
            </div>
          </section>

          <section className="my-booking-result-section">
            <div className="my-booking-result-title">
              <WalletCards aria-hidden="true" />

              <div>
                <strong>Resumo financeiro</strong>
                <small>Valores associados à reserva</small>
              </div>
            </div>

            <div className="my-booking-financial-grid">
              <div>
                <span>Preço final/dia</span>
                <strong>
                  {dailyPrice != null
                    ? `${currency}${dailyPrice}`
                    : "Não registado"}
                </strong>
              </div>

              <div>
                <span>Franquia</span>
                <strong>
                  {appliedExcess != null
                    ? `${currency}${appliedExcess}`
                    : "Não registada"}
                </strong>
              </div>

              <div>
                <span>Caução reembolsável</span>
                <strong>
                  {booking.refundableDeposit != null
                    ? `${currency}${booking.refundableDeposit}`
                    : "Não registada"}
                </strong>
              </div>

              <div className="my-booking-total">
                <span>Total estimado</span>
                <strong>
                  {booking.estimatedTotal != null
                    ? `${currency}${booking.estimatedTotal}`
                    : "Não registado"}
                </strong>
              </div>
            </div>
          </section>

          <section className="my-booking-result-section">
            <div className="my-booking-result-title">
              <ShieldCheck aria-hidden="true" />

              <div>
                <strong>Situação da reserva</strong>
                <small>Pagamento e caução</small>
              </div>
            </div>

            <div className="my-booking-operation-grid">
              <div>
                <CreditCard aria-hidden="true" />

                <span>Pagamento</span>

                <strong>
                  {
                    paymentStatusLabel[
                      booking.paymentStatus ?? "pending"
                    ]
                  }
                </strong>
              </div>

              <div>
                <ShieldCheck aria-hidden="true" />

                <span>Estado da caução</span>

                <strong>
                  {
                    depositStatusLabel[
                      booking.depositStatus ?? "pending"
                    ]
                  }
                </strong>
              </div>
            </div>
          </section>

          <a
            className="my-booking-whatsapp"
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle aria-hidden="true" />

            <span>
              <small>Precisas de ajuda com esta reserva?</small>
              <strong>Contactar 7Go no WhatsApp</strong>
            </span>

            <ArrowRight aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}
