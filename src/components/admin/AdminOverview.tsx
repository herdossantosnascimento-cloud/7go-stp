"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Clock3,
  CreditCard,
  Gauge,
  WalletCards,
} from "lucide-react";
import { auth, db } from "@/lib/firebase/client";
import { AdminFinancialDashboard } from "@/components/admin/AdminFinancialDashboard";

type BookingStatus =
  | "pending"
  | "pending_payment"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

type PaymentStatus = "pending" | "partial" | "paid";

type Booking = {
  id: string;
  reference?: string;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  customerName?: string;
  estimatedTotal?: number;
  finalAmount?: number;
  paymentAmount?: number;
  paymentMethod?: "stripe" | "cash";
  stripePaymentStatus?: string;
  paidAt?: unknown;
  createdAt?: unknown;
  currency?: string;
};

type FleetCar = {
  id: string;
  brand?: string;
  model?: string;
};

const statusLabel: Record<BookingStatus, string> = {
  pending: "Pendente",
  pending_payment: "Aguarda pagamento",
  confirmed: "Confirmada",
  in_progress: "Em curso",
  completed: "Concluída",
  cancelled: "Cancelada",
};

function getSaoTomeToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Sao_Tome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().split("T")[0];
  }

  return `${year}-${month}-${day}`;
}

function formatDate(value?: string) {
  if (!value) {
    return "Sem data";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function getDateFromUnknown(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object") {
    const timestamp = value as {
      toDate?: () => Date;
      seconds?: number;
    };

    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate();
    }

    if (typeof timestamp.seconds === "number") {
      return new Date(timestamp.seconds * 1000);
    }
  }

  return null;
}

function getSaoTomeDateKey(value: unknown) {
  const date = getDateFromUnknown(value);

  if (!date) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Sao_Tome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;

  const month = parts.find((part) => part.type === "month")?.value;

  const day = parts.find((part) => part.type === "day")?.value;

  return year && month && day ? `${year}-${month}-${day}` : "";
}

function getBookingPaymentAmount(booking: Booking) {
  return Number(
    booking.paymentAmount ?? booking.finalAmount ?? booking.estimatedTotal ?? 0,
  );
}

function formatMoney(value: number, currency: string) {
  return `${currency}${value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function AdminOverview() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fleet, setFleet] = useState<FleetCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setBookings([]);
        setFleet([]);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    setLoading(true);
    setLoadError("");

    let bookingsLoaded = false;
    let fleetLoaded = false;

    const finishLoading = () => {
      if (bookingsLoaded && fleetLoaded) {
        setLoading(false);
      }
    };

    const unsubscribeBookings = onSnapshot(
      collection(db, "bookings"),
      (snapshot) => {
        setBookings(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Booking[],
        );

        bookingsLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error("Erro ao carregar reservas:", error);
        setLoadError("Não foi possível carregar as reservas.");
        bookingsLoaded = true;
        finishLoading();
      },
    );

    const unsubscribeFleet = onSnapshot(
      collection(db, "carCatalog"),
      (snapshot) => {
        setFleet(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as FleetCar[],
        );

        fleetLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error("Erro ao carregar frota:", error);
        setLoadError("Não foi possível carregar a frota.");
        fleetLoaded = true;
        finishLoading();
      },
    );

    return () => {
      unsubscribeBookings();
      unsubscribeFleet();
    };
  }, [user]);

  const dashboard = useMemo(() => {
    const today = getSaoTomeToday();

    const validBookings = bookings.filter(
      (booking) => booking.status !== "cancelled",
    );

    const operationalBookings = validBookings.filter(
      (booking) => booking.status !== "completed",
    );

    const occupiedCarIds = new Set(
      operationalBookings
        .filter((booking) => {
          if (!booking.carId || !booking.pickupDate || !booking.returnDate) {
            return false;
          }

          return booking.pickupDate <= today && booking.returnDate > today;
        })
        .map((booking) => booking.carId as string),
    );

    const occupiedCars = occupiedCarIds.size;
    const availableCars = Math.max(fleet.length - occupiedCars, 0);

    const pickupsToday = operationalBookings
      .filter((booking) => booking.pickupDate === today)
      .sort((a, b) =>
        (a.customerName ?? "").localeCompare(b.customerName ?? ""),
      );

    const returnsToday = operationalBookings
      .filter((booking) => booking.returnDate === today)
      .sort((a, b) =>
        (a.customerName ?? "").localeCompare(b.customerName ?? ""),
      );

    const upcomingBookings = operationalBookings
      .filter(
        (booking) =>
          Boolean(booking.pickupDate) && (booking.pickupDate as string) > today,
      )
      .sort((a, b) => (a.pickupDate ?? "").localeCompare(b.pickupDate ?? ""))
      .slice(0, 5);

    const expectedRevenue = validBookings.reduce(
      (total, booking) => total + (booking.estimatedTotal ?? 0),
      0,
    );

    const receivedRevenue = validBookings
      .filter((booking) => booking.paymentStatus === "paid")
      .reduce((total, booking) => total + (booking.estimatedTotal ?? 0), 0);

    const pendingPayments = validBookings.filter(
      (booking) =>
        booking.paymentStatus !== "paid" &&
        (booking.status === "confirmed" || booking.status === "in_progress"),
    );

    const pendingReservations = bookings.filter(
      (booking) => booking.status === "pending",
    ).length;

    const outstandingRevenue = Math.max(expectedRevenue - receivedRevenue, 0);

    const occupancyRate =
      fleet.length > 0 ? Math.round((occupiedCars / fleet.length) * 100) : 0;

    const currency =
      bookings.find((booking) => booking.currency)?.currency ?? "€";

    const monthKey = today.slice(0, 7);

    const paidBookings = validBookings.filter(
      (booking) => booking.paymentStatus === "paid",
    );

    const stripePaidBookings = paidBookings.filter(
      (booking) => booking.paymentMethod === "stripe",
    );

    const cashPaidBookings = paidBookings.filter(
      (booking) => booking.paymentMethod === "cash",
    );

    const stripeTodayRevenue = stripePaidBookings
      .filter(
        (booking) =>
          getSaoTomeDateKey(booking.paidAt ?? booking.createdAt) === today,
      )
      .reduce((total, booking) => total + getBookingPaymentAmount(booking), 0);

    const cashTodayRevenue = cashPaidBookings
      .filter(
        (booking) =>
          getSaoTomeDateKey(booking.paidAt ?? booking.createdAt) === today,
      )
      .reduce((total, booking) => total + getBookingPaymentAmount(booking), 0);

    const stripeMonthRevenue = stripePaidBookings
      .filter((booking) =>
        getSaoTomeDateKey(booking.paidAt ?? booking.createdAt).startsWith(
          monthKey,
        ),
      )
      .reduce((total, booking) => total + getBookingPaymentAmount(booking), 0);

    const cashMonthRevenue = cashPaidBookings
      .filter((booking) =>
        getSaoTomeDateKey(booking.paidAt ?? booking.createdAt).startsWith(
          monthKey,
        ),
      )
      .reduce((total, booking) => total + getBookingPaymentAmount(booking), 0);

    const paymentPendingBookings = validBookings.filter(
      (booking) =>
        booking.paymentStatus !== "paid" && booking.status !== "completed",
    );

    const failedPaymentBookings = validBookings.filter(
      (booking) => booking.stripePaymentStatus === "failed",
    );

    const recentPayments = [...paidBookings]
      .sort((first, second) => {
        const firstDate =
          getDateFromUnknown(first.paidAt ?? first.createdAt)?.getTime() ?? 0;

        const secondDate =
          getDateFromUnknown(second.paidAt ?? second.createdAt)?.getTime() ?? 0;

        return secondDate - firstDate;
      })
      .slice(0, 5);

    return {
      today,
      occupiedCars,
      availableCars,
      occupancyRate,
      pickupsToday,
      returnsToday,
      upcomingBookings,
      expectedRevenue,
      receivedRevenue,
      outstandingRevenue,
      pendingPayments,
      pendingReservations,
      currency,

      stripeTodayRevenue,
      cashTodayRevenue,
      stripeMonthRevenue,
      cashMonthRevenue,

      paidPayments: paidBookings.length,
      paymentPendingBookings,
      failedPaymentBookings,
      recentPayments,
    };
  }, [bookings, fleet]);

  if (!user) {
    return (
      <section className="admin-executive-dashboard">
        <div className="admin-executive-message">
          <strong>Sessão administrativa necessária</strong>
          <p>Abre a aba Reservas e inicia sessão para consultar o painel.</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="admin-executive-dashboard">
        <div className="admin-executive-message">
          A carregar painel operacional...
        </div>
      </section>
    );
  }

  return (
    <section className="admin-executive-dashboard">
      <header className="admin-executive-header">
        <div>
          <span className="admin-executive-kicker">Operação em tempo real</span>
          <h2>Dashboard</h2>
          <p>Estado atual da frota, movimentos do dia e situação financeira.</p>
        </div>

        <div className="admin-executive-date">
          <Clock3 aria-hidden="true" />
          <div>
            <small>Hoje</small>
            <strong>{formatDate(dashboard.today)}</strong>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="admin-executive-error">
          <AlertTriangle aria-hidden="true" />
          {loadError}
        </div>
      )}

      <div className="admin-executive-kpis">
        <article className="admin-executive-kpi">
          <div className="admin-executive-kpi-heading">
            <span>Receita recebida</span>
            <WalletCards aria-hidden="true" />
          </div>

          <strong>
            {formatMoney(dashboard.receivedRevenue, dashboard.currency)}
          </strong>

          <small>
            De {formatMoney(dashboard.expectedRevenue, dashboard.currency)}{" "}
            previstos
          </small>
        </article>

        <article className="admin-executive-kpi">
          <div className="admin-executive-kpi-heading">
            <span>Movimentos hoje</span>
            <CalendarDays aria-hidden="true" />
          </div>

          <strong>
            {dashboard.pickupsToday.length + dashboard.returnsToday.length}
          </strong>

          <small>
            {dashboard.pickupsToday.length} entregas ·{" "}
            {dashboard.returnsToday.length} devoluções
          </small>
        </article>

        <article className="admin-executive-kpi">
          <div className="admin-executive-kpi-heading">
            <span>Frota disponível</span>
            <CarFront aria-hidden="true" />
          </div>

          <strong>
            {dashboard.availableCars}/{fleet.length}
          </strong>

          <small>{dashboard.occupiedCars} veículo(s) em utilização</small>
        </article>

        <article className="admin-executive-kpi">
          <div className="admin-executive-kpi-heading">
            <span>Taxa de ocupação</span>
            <Gauge aria-hidden="true" />
          </div>

          <strong>{dashboard.occupancyRate}%</strong>

          <div className="admin-executive-occupancy">
            <span
              style={{
                width: `${Math.min(dashboard.occupancyRate, 100)}%`,
              }}
            />
          </div>
        </article>
      </div>

      <section className="admin-payment-command-center">
        <div className="admin-payment-command-heading">
          <div>
            <span>Pagamentos em tempo real</span>
            <h3>Centro de pagamentos</h3>
            <p>
              Stripe, dinheiro e pagamentos que ainda exigem acompanhamento.
            </p>
          </div>

          <CreditCard aria-hidden="true" />
        </div>

        <div className="admin-payment-command-kpis">
          <article>
            <div>
              <CreditCard aria-hidden="true" />
              <span>Stripe hoje</span>
            </div>

            <strong>
              {formatMoney(dashboard.stripeTodayRevenue, dashboard.currency)}
            </strong>

            <small>
              Este mês{" "}
              {formatMoney(dashboard.stripeMonthRevenue, dashboard.currency)}
            </small>
          </article>

          <article>
            <div>
              <WalletCards aria-hidden="true" />
              <span>Cash hoje</span>
            </div>

            <strong>
              {formatMoney(dashboard.cashTodayRevenue, dashboard.currency)}
            </strong>

            <small>
              Este mês{" "}
              {formatMoney(dashboard.cashMonthRevenue, dashboard.currency)}
            </small>
          </article>

          <article className="is-success">
            <div>
              <CheckCircle2 aria-hidden="true" />
              <span>Pagos</span>
            </div>

            <strong>{dashboard.paidPayments}</strong>

            <small>Pagamentos confirmados</small>
          </article>

          <article className="is-warning">
            <div>
              <Clock3 aria-hidden="true" />
              <span>Pendentes</span>
            </div>

            <strong>{dashboard.paymentPendingBookings.length}</strong>

            <small>Aguardam pagamento</small>
          </article>

          <article className="is-danger">
            <div>
              <AlertTriangle aria-hidden="true" />
              <span>Falhados</span>
            </div>

            <strong>{dashboard.failedPaymentBookings.length}</strong>

            <small>Falhas Stripe registadas</small>
          </article>
        </div>

        <div className="admin-payment-recent">
          <div className="admin-payment-recent-heading">
            <div>
              <span>Atividade recente</span>
              <h4>Últimos pagamentos</h4>
            </div>

            <strong>{dashboard.recentPayments.length}</strong>
          </div>

          {dashboard.recentPayments.length === 0 ? (
            <div className="admin-payment-empty">
              Ainda não existem pagamentos confirmados.
            </div>
          ) : (
            <div className="admin-payment-list">
              {dashboard.recentPayments.map((booking) => (
                <article key={booking.id}>
                  <div
                    className={
                      booking.paymentMethod === "stripe"
                        ? "admin-payment-method is-stripe"
                        : "admin-payment-method is-cash"
                    }
                  >
                    {booking.paymentMethod === "stripe" ? (
                      <CreditCard aria-hidden="true" />
                    ) : (
                      <WalletCards aria-hidden="true" />
                    )}
                  </div>

                  <div className="admin-payment-main">
                    <strong>{booking.reference || "Sem referência"}</strong>

                    <span>
                      {booking.customerName || "Cliente"} ·{" "}
                      {booking.carBrand || "Viatura"} {booking.carModel || ""}
                    </span>
                  </div>

                  <span className="admin-payment-channel">
                    {booking.paymentMethod === "stripe" ? "Stripe" : "Cash"}
                  </span>

                  <strong className="admin-payment-value">
                    {formatMoney(
                      getBookingPaymentAmount(booking),
                      booking.currency || dashboard.currency,
                    )}
                  </strong>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="admin-executive-main-grid">
        <article className="admin-executive-panel admin-executive-operations">
          <div className="admin-executive-panel-heading">
            <div>
              <span>Operação diária</span>
              <h3>Movimentos de hoje</h3>
            </div>

            <div className="admin-executive-live">
              <i />
              Ao vivo
            </div>
          </div>

          <div className="admin-executive-movements">
            <section>
              <div className="admin-executive-section-heading">
                <div>
                  <ArrowUpRight aria-hidden="true" />
                  <span>Entregas</span>
                </div>
                <strong>{dashboard.pickupsToday.length}</strong>
              </div>

              {dashboard.pickupsToday.length === 0 ? (
                <div className="admin-executive-empty">
                  Nenhuma entrega programada para hoje.
                </div>
              ) : (
                <div className="admin-executive-movement-list">
                  {dashboard.pickupsToday.map((booking) => (
                    <div className="admin-executive-movement" key={booking.id}>
                      <div>
                        <strong>
                          {booking.carBrand || "Veículo"}{" "}
                          {booking.carModel || ""}
                        </strong>
                        <span>
                          {booking.customerName || "Cliente não identificado"}
                        </span>
                      </div>

                      <small>{booking.reference || "Sem referência"}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="admin-executive-section-heading">
                <div>
                  <ArrowDownLeft aria-hidden="true" />
                  <span>Devoluções</span>
                </div>
                <strong>{dashboard.returnsToday.length}</strong>
              </div>

              {dashboard.returnsToday.length === 0 ? (
                <div className="admin-executive-empty">
                  Nenhuma devolução programada para hoje.
                </div>
              ) : (
                <div className="admin-executive-movement-list">
                  {dashboard.returnsToday.map((booking) => (
                    <div className="admin-executive-movement" key={booking.id}>
                      <div>
                        <strong>
                          {booking.carBrand || "Veículo"}{" "}
                          {booking.carModel || ""}
                        </strong>
                        <span>
                          {booking.customerName || "Cliente não identificado"}
                        </span>
                      </div>

                      <small>{booking.reference || "Sem referência"}</small>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </article>

        <aside className="admin-executive-side">
          <article className="admin-executive-panel admin-executive-finance">
            <div className="admin-executive-panel-heading">
              <div>
                <span>Financeiro</span>
                <h3>Resumo</h3>
              </div>
              <CreditCard aria-hidden="true" />
            </div>

            <div className="admin-executive-finance-row">
              <span>Receita prevista</span>
              <strong>
                {formatMoney(dashboard.expectedRevenue, dashboard.currency)}
              </strong>
            </div>

            <div className="admin-executive-finance-row">
              <span>Receita recebida</span>
              <strong>
                {formatMoney(dashboard.receivedRevenue, dashboard.currency)}
              </strong>
            </div>

            <div className="admin-executive-finance-row">
              <span>Valor por receber</span>
              <strong>
                {formatMoney(dashboard.outstandingRevenue, dashboard.currency)}
              </strong>
            </div>
          </article>

          <article className="admin-executive-panel admin-executive-alerts">
            <div className="admin-executive-panel-heading">
              <div>
                <span>Atenção necessária</span>
                <h3>Alertas</h3>
              </div>
              <AlertTriangle aria-hidden="true" />
            </div>

            <div className="admin-executive-alert-list">
              <div>
                <AlertTriangle aria-hidden="true" />
                <span>
                  <strong>{dashboard.pendingPayments.length}</strong>
                  pagamentos pendentes
                </span>
              </div>

              <div>
                <Clock3 aria-hidden="true" />
                <span>
                  <strong>{dashboard.pendingReservations}</strong>
                  reservas por confirmar
                </span>
              </div>

              <div>
                <CheckCircle2 aria-hidden="true" />
                <span>
                  <strong>{dashboard.availableCars}</strong>
                  veículos disponíveis
                </span>
              </div>
            </div>
          </article>
        </aside>
      </div>

      <AdminFinancialDashboard />

      <article className="admin-executive-panel admin-executive-upcoming">
        <div className="admin-executive-panel-heading">
          <div>
            <span>Planeamento</span>
            <h3>Próximas reservas</h3>
          </div>

          <strong>{dashboard.upcomingBookings.length}</strong>
        </div>

        {dashboard.upcomingBookings.length === 0 ? (
          <div className="admin-executive-empty">
            Não existem próximas reservas ativas.
          </div>
        ) : (
          <div className="admin-executive-table">
            <div className="admin-executive-table-header">
              <span>Data</span>
              <span>Veículo</span>
              <span>Cliente</span>
              <span>Estado</span>
              <span>Referência</span>
            </div>

            {dashboard.upcomingBookings.map((booking) => {
              const status = booking.status ?? "pending";

              return (
                <div className="admin-executive-table-row" key={booking.id}>
                  <span>
                    <strong>
                      {formatDate(booking.pickupDate)}
                      {booking.pickupTime ? ` às ${booking.pickupTime}` : ""}
                    </strong>
                    <small>
                      até {formatDate(booking.returnDate)}
                      {booking.returnTime ? ` às ${booking.returnTime}` : ""}
                    </small>
                  </span>

                  <span>
                    {booking.carBrand || "Veículo"} {booking.carModel || ""}
                  </span>

                  <span>
                    {booking.customerName || "Cliente não identificado"}
                  </span>

                  <span>
                    <i className={`status-${status}`}>{statusLabel[status]}</i>
                  </span>

                  <span>{booking.reference || "Sem referência"}</span>
                </div>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
