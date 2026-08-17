"use client";

import {
  CalendarDays,
  CarFront,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/client";

type FleetStatus = "available" | "limited" | "booked";

type BookingStatus =
  "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

type PaymentStatus = "pending" | "partial" | "paid";

type BookingFilter = "all" | BookingStatus;

type FleetCar = {
  id: string;
  brand?: string;
  model?: string;
  status?: FleetStatus;
  registrationPlate?: string;
};

type Booking = {
  id: string;
  reference?: string;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  customerName?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  estimatedTotal?: number;
  currency?: string;
};

type CalendarBooking = Booking & {
  startColumn: number;
  columnSpan: number;
  lane: number;
};

const DAY_WIDTH = 54;
const VEHICLE_WIDTH = 220;

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const weekdayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const fleetStatusLabels: Record<FleetStatus, string> = {
  available: "Disponível",
  limited: "Limitado",
  booked: "Reservado",
};

const bookingStatusLabels: Record<BookingStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  in_progress: "Em curso",
  completed: "Concluída",
  cancelled: "Cancelada",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDate(first: Date, year: number, month: number, day: number) {
  return (
    first.getFullYear() === year &&
    first.getMonth() === month &&
    first.getDate() === day
  );
}

function parseDate(value?: string) {
  if (!value) {
    return null;
  }

  const parts = value.split("-").map(Number);

  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return null;
  }

  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
}

function parseDateTime(date?: string, time?: string) {
  if (!date) return null;
  const value = new Date(`${date}T${time || "00:00"}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function differenceInDays(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function getEffectiveBookingStatus(booking: Booking): BookingStatus {
  const storedStatus = booking.status ?? "pending";
  if (
    storedStatus === "pending" ||
    storedStatus === "cancelled" ||
    storedStatus === "completed"
  ) {
    return storedStatus;
  }

  const pickupAt = parseDateTime(booking.pickupDate, booking.pickupTime);
  const returnAt = parseDateTime(
    booking.returnDate,
    booking.returnTime || "23:59",
  );
  if (!pickupAt || !returnAt) return storedStatus;

  const now = new Date();
  if (now >= returnAt) return "completed";
  if (now >= pickupAt) return "in_progress";
  return "confirmed";
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

function formatMoney(value?: number, currency?: string) {
  if (typeof value !== "number") {
    return "";
  }

  return `${currency || "€"}${value.toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getBookingPosition(
  booking: Booking,
  year: number,
  month: number,
): CalendarBooking | null {
  const pickup = parseDate(booking.pickupDate);
  const returnDate = parseDate(booking.returnDate);

  if (!pickup || !returnDate || returnDate <= pickup) {
    return null;
  }

  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEndExclusive = new Date(Date.UTC(year, month + 1, 1));

  if (pickup >= monthEndExclusive || returnDate <= monthStart) {
    return null;
  }

  const visibleStart = pickup < monthStart ? monthStart : pickup;

  const visibleEnd =
    returnDate > monthEndExclusive ? monthEndExclusive : returnDate;

  const startColumn = differenceInDays(monthStart, visibleStart) + 1;

  const columnSpan = Math.max(differenceInDays(visibleStart, visibleEnd), 1);

  return {
    ...booking,
    startColumn,
    columnSpan,
    lane: 0,
  };
}

function assignBookingLanes(bookings: CalendarBooking[]) {
  const laneEnds: number[] = [];

  return bookings.map((booking) => {
    const bookingStart = booking.startColumn;
    const bookingEnd = booking.startColumn + booking.columnSpan;

    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= bookingStart);

    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(bookingEnd);
    } else {
      laneEnds[lane] = bookingEnd;
    }

    return {
      ...booking,
      lane,
    };
  });
}

export function AdminFleetCalendar() {
  const router = useRouter();
  const today = useMemo(() => new Date(), []);

  const [visibleDate, setVisibleDate] = useState(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );

  const [fleet, setFleet] = useState<FleetCar[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>("all");
  const [fleetLoaded, setFleetLoaded] = useState(false);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    const fleetQuery = query(
      collection(db, "carCatalog"),
      orderBy("brand", "asc"),
    );

    const unsubscribeFleet = onSnapshot(
      fleetQuery,
      (snapshot) => {
        setFleet(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as FleetCar[],
        );

        setFleetLoaded(true);
      },
      (error) => {
        console.error("Erro ao carregar frota no calendário:", error);

        setLoadError("Não foi possível carregar todos os dados do calendário.");

        setFleetLoaded(true);
      },
    );

    const unsubscribeBookings = onSnapshot(
      collection(db, "bookings"),
      (snapshot) => {
        setBookings(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })) as Booking[],
        );

        setBookingsLoaded(true);
      },
      (error) => {
        console.error("Erro ao carregar reservas no calendário:", error);

        setLoadError("Não foi possível carregar todos os dados do calendário.");

        setBookingsLoaded(true);
      },
    );

    return () => {
      unsubscribeFleet();
      unsubscribeBookings();
    };
  }, []);

  const year = visibleDate.getFullYear();
  const month = visibleDate.getMonth();
  const totalDays = getDaysInMonth(year, month);
  const loading = !fleetLoaded || !bookingsLoaded;

  const days = useMemo(
    () =>
      Array.from({ length: totalDays }, (_, index) => {
        const day = index + 1;
        const date = new Date(year, month, day);

        return {
          day,
          weekday: weekdayNames[date.getDay()],
          isToday: isSameDate(today, year, month, day),
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
        };
      }),
    [month, today, totalDays, year],
  );

  const visibleBookings = useMemo(
    () =>
      bookings
        .map((booking) => getBookingPosition(booking, year, month))
        .filter((booking): booking is CalendarBooking => Boolean(booking)),
    [bookings, month, year],
  );

  const filteredVisibleBookings = useMemo(
    () =>
      visibleBookings.filter((booking) => {
        if (bookingFilter === "all") {
          return true;
        }

        return getEffectiveBookingStatus(booking) === bookingFilter;
      }),
    [bookingFilter, visibleBookings],
  );

  const bookingsByCar = useMemo(() => {
    const result = new Map<string, CalendarBooking[]>();

    filteredVisibleBookings.forEach((booking) => {
      if (!booking.carId) {
        return;
      }

      const current = result.get(booking.carId) ?? [];

      current.push(booking);

      current.sort((first, second) => {
        const dateComparison = (first.pickupDate ?? "").localeCompare(
          second.pickupDate ?? "",
        );

        if (dateComparison !== 0) {
          return dateComparison;
        }

        return second.columnSpan - first.columnSpan;
      });

      result.set(booking.carId, assignBookingLanes(current));
    });

    return result;
  }, [filteredVisibleBookings]);

  const activeVisibleBookings = visibleBookings.filter(
    (booking) => getEffectiveBookingStatus(booking) !== "cancelled",
  ).length;

  function previousMonth() {
    setVisibleDate(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1),
    );
  }

  function nextMonth() {
    setVisibleDate(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1),
    );
  }

  function goToToday() {
    setVisibleDate(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <section className="fleet-calendar">
      <header className="fleet-calendar-header">
        <div>
          <span className="fleet-calendar-kicker">Planeamento operacional</span>

          <h2>Calendário da frota</h2>

          <p>Reservas, disponibilidade e utilização diária dos veículos.</p>
        </div>

        <div className="fleet-calendar-actions">
          <button
            type="button"
            className="fleet-calendar-today"
            onClick={goToToday}
          >
            <CalendarDays aria-hidden="true" />
            Hoje
          </button>

          <div className="fleet-calendar-navigation">
            <button
              type="button"
              onClick={previousMonth}
              aria-label="Mês anterior"
            >
              <ChevronLeft aria-hidden="true" />
            </button>

            <strong>
              {monthNames[month]} {year}
            </strong>

            <button type="button" onClick={nextMonth} aria-label="Próximo mês">
              <ChevronRight aria-hidden="true" />
            </button>
          </div>

          <div className="fleet-calendar-view-switch">
            <button type="button" disabled>
              Semana
            </button>

            <button type="button" className="is-active">
              Mês
            </button>
          </div>
        </div>
      </header>

      {loadError && <div className="fleet-calendar-error">{loadError}</div>}

      <div className="fleet-calendar-summary">
        <div>
          <CarFront aria-hidden="true" />

          <span>
            <strong>{fleet.length}</strong>
            veículos
          </span>
        </div>

        <div className="fleet-calendar-summary-divider" />

        <span>
          <strong>{activeVisibleBookings}</strong>
          reservas ativas neste mês
        </span>

        <div className="fleet-calendar-summary-divider" />

        <span>
          <strong>{filteredVisibleBookings.length}</strong>
          movimentos apresentados
        </span>
      </div>

      <div className="fleet-calendar-shell">
        {loading ? (
          <div className="fleet-calendar-loading">
            <LoaderCircle aria-hidden="true" />A carregar calendário...
          </div>
        ) : fleet.length === 0 ? (
          <div className="fleet-calendar-empty">
            Ainda não existem veículos registados na frota.
          </div>
        ) : (
          <div className="fleet-calendar-scroll">
            <div
              className="fleet-calendar-board"
              style={{
                width: VEHICLE_WIDTH + totalDays * DAY_WIDTH,
              }}
            >
              <div
                className="fleet-calendar-grid"
                style={{
                  gridTemplateColumns: `${VEHICLE_WIDTH}px repeat(${totalDays}, ${DAY_WIDTH}px)`,
                }}
              >
                <div className="fleet-calendar-corner">Veículo</div>

                {days.map((item) => (
                  <div
                    className={[
                      "fleet-calendar-day-header",
                      item.isToday ? "is-today" : "",
                      item.isWeekend ? "is-weekend" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={`header-${item.day}`}
                  >
                    <small>{item.weekday}</small>
                    <strong>{item.day}</strong>
                  </div>
                ))}

                {fleet.map((car) => {
                  const status = car.status ?? "available";

                  const carBookings = bookingsByCar.get(car.id) ?? [];

                  const laneCount = Math.max(
                    1,
                    ...carBookings.map((booking) => booking.lane + 1),
                  );

                  return (
                    <div
                      className="fleet-calendar-row"
                      style={{
                        display: "contents",
                      }}
                      key={car.id}
                    >
                      <div className="fleet-calendar-car">
                        <div>
                          <strong>
                            {car.brand || "Sem marca"} {car.model || ""}
                          </strong>

                          <small>
                            {car.registrationPlate || "Sem matrícula"}
                          </small>
                        </div>

                        <span
                          className={`fleet-calendar-status status-${status}`}
                          title={fleetStatusLabels[status]}
                        />
                      </div>

                      <div
                        className="fleet-calendar-timeline"
                        style={{
                          gridColumn: `2 / span ${totalDays}`,
                          gridTemplateColumns: `repeat(${totalDays}, ${DAY_WIDTH}px)`,
                          gridTemplateRows: `repeat(${laneCount}, 42px)`,
                          minHeight: `${Math.max(68, laneCount * 42 + 16)}px`,
                        }}
                      >
                        {days.map((item) => (
                          <div
                            className={[
                              "fleet-calendar-cell",
                              item.isToday ? "is-today" : "",
                              item.isWeekend ? "is-weekend" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={{
                              gridRow: `1 / span ${laneCount}`,
                            }}
                            key={`${car.id}-${item.day}`}
                          />
                        ))}

                        {carBookings.map((booking) => {
                          const storedBookingStatus =
                            booking.status ?? "pending";

                          const bookingStatus =
                            getEffectiveBookingStatus(booking);

                          const statusWasAdjusted =
                            storedBookingStatus !== bookingStatus;

                          const customerName =
                            booking.customerName || "Cliente não identificado";

                          const bookingTotal = formatMoney(
                            booking.estimatedTotal,
                            booking.currency,
                          );

                          return (
                            <button
                              type="button"
                              className={[
                                "fleet-calendar-booking",
                                `booking-${bookingStatus}`,
                              ].join(" ")}
                              style={{
                                gridColumn: `${booking.startColumn} / span ${booking.columnSpan}`,
                                gridRow: booking.lane + 1,
                              }}
                              onClick={() =>
                                router.push(
                                  `/admin/reservas/${booking.id}/ficha`,
                                )
                              }
                              aria-label={`Abrir reserva de ${customerName}`}
                              key={booking.id}
                            >
                              <strong>{customerName}</strong>

                              <small>
                                {booking.reference ||
                                  bookingStatusLabels[bookingStatus]}
                              </small>

                              <span className="fleet-calendar-booking-tooltip">
                                <span className="fleet-calendar-tooltip-status">
                                  {bookingStatusLabels[bookingStatus]}
                                </span>

                                {statusWasAdjusted && (
                                  <span className="fleet-calendar-auto-status">
                                    Estado calculado pelas datas
                                  </span>
                                )}

                                <strong>{customerName}</strong>

                                <small>
                                  {booking.carBrand || car.brand}{" "}
                                  {booking.carModel || car.model}
                                </small>

                                <dl>
                                  <div>
                                    <dt>Levantamento</dt>
                                    <dd>
                                      {formatDate(booking.pickupDate)}
                                      {booking.pickupTime
                                        ? ` às ${booking.pickupTime}`
                                        : ""}
                                    </dd>
                                  </div>

                                  <div>
                                    <dt>Devolução</dt>
                                    <dd>
                                      {formatDate(booking.returnDate)}
                                      {booking.returnTime
                                        ? ` às ${booking.returnTime}`
                                        : ""}
                                    </dd>
                                  </div>

                                  <div>
                                    <dt>Referência</dt>
                                    <dd>
                                      {booking.reference || "Sem referência"}
                                    </dd>
                                  </div>

                                  <div>
                                    <dt>Pagamento</dt>
                                    <dd>
                                      {booking.paymentStatus === "paid"
                                        ? "Pago"
                                        : booking.paymentStatus === "partial"
                                          ? "Parcial"
                                          : "Pendente"}
                                    </dd>
                                  </div>

                                  {statusWasAdjusted && (
                                    <div>
                                      <dt>Estado registado</dt>
                                      <dd>
                                        {
                                          bookingStatusLabels[
                                            storedBookingStatus
                                          ]
                                        }
                                      </dd>
                                    </div>
                                  )}

                                  {bookingTotal && (
                                    <div>
                                      <dt>Total</dt>
                                      <dd>{bookingTotal}</dd>
                                    </div>
                                  )}
                                </dl>

                                <span className="fleet-calendar-tooltip-action">
                                  Clica para abrir a ficha
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="fleet-calendar-legend">
        <button
          type="button"
          className={bookingFilter === "all" ? "is-active" : ""}
          onClick={() => setBookingFilter("all")}
        >
          <i className="booking-all" />
          Todas
          <small>{visibleBookings.length}</small>
        </button>

        <button
          type="button"
          className={bookingFilter === "pending" ? "is-active" : ""}
          onClick={() => setBookingFilter("pending")}
        >
          <i className="booking-pending" />
          Pendente
          <small>
            {
              visibleBookings.filter(
                (booking) => getEffectiveBookingStatus(booking) === "pending",
              ).length
            }
          </small>
        </button>

        <button
          type="button"
          className={bookingFilter === "confirmed" ? "is-active" : ""}
          onClick={() => setBookingFilter("confirmed")}
        >
          <i className="booking-confirmed" />
          Confirmada
          <small>
            {
              visibleBookings.filter(
                (booking) => getEffectiveBookingStatus(booking) === "confirmed",
              ).length
            }
          </small>
        </button>

        <button
          type="button"
          className={bookingFilter === "in_progress" ? "is-active" : ""}
          onClick={() => setBookingFilter("in_progress")}
        >
          <i className="booking-in_progress" />
          Em curso
          <small>
            {
              visibleBookings.filter(
                (booking) =>
                  getEffectiveBookingStatus(booking) === "in_progress",
              ).length
            }
          </small>
        </button>

        <button
          type="button"
          className={bookingFilter === "completed" ? "is-active" : ""}
          onClick={() => setBookingFilter("completed")}
        >
          <i className="booking-completed" />
          Concluída
          <small>
            {
              visibleBookings.filter(
                (booking) => getEffectiveBookingStatus(booking) === "completed",
              ).length
            }
          </small>
        </button>

        <button
          type="button"
          className={bookingFilter === "cancelled" ? "is-active" : ""}
          onClick={() => setBookingFilter("cancelled")}
        >
          <i className="booking-cancelled" />
          Cancelada
          <small>
            {
              visibleBookings.filter(
                (booking) => getEffectiveBookingStatus(booking) === "cancelled",
              ).length
            }
          </small>
        </button>
      </footer>
    </section>
  );
}
