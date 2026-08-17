"use client";

import { collection, getDocs, orderBy, query } from "firebase/firestore";
import {
  CarFront,
  Fuel,
  Gauge,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { db } from "@/lib/firebase/client";

type FuelLevel =
  | "empty"
  | "one_eighth"
  | "quarter"
  | "three_eighths"
  | "half"
  | "five_eighths"
  | "three_quarters"
  | "seven_eighths"
  | "full";

type Inspection = {
  completed?: boolean;
  mileage?: number;
  fuelLevel?: FuelLevel;
  hasDamage?: boolean;
};

type Booking = {
  id: string;
  reference?: string;
  status?: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  carRegistrationPlate?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  checkout?: Inspection;
  checkin?: Inspection;
};

type Car = {
  id: string;
  brand?: string;
  model?: string;
  registrationPlate?: string;
  status?: "available" | "limited" | "booked";
  mileage?: number;
};

const fuelLabels: Record<string, string> = {
  empty: "Vazio",
  one_eighth: "1/8",
  quarter: "1/4",
  three_eighths: "3/8",
  half: "1/2",
  five_eighths: "5/8",
  three_quarters: "3/4",
  seven_eighths: "7/8",
  full: "Cheio",
};

const fleetStatusLabels: Record<string, string> = {
  available: "Disponível",
  limited: "Limitada",
  booked: "Reservada",
};

function getOperationalStatusClass(status: string) {
  const value = status.toLowerCase();

  if (value.includes("dano") || value.includes("limitada")) {
    return "is-danger";
  }

  if (value.includes("aluguer") || value.includes("reserva próxima")) {
    return "is-active";
  }

  if (value.includes("disponível")) {
    return "is-success";
  }

  return "is-warning";
}

function getInspectionStatusClass(status: string) {
  const value = status.toLowerCase();

  if (
    value.includes("falta") ||
    value.includes("pendente") ||
    value.includes("aguardar")
  ) {
    return "is-warning";
  }

  return "is-success";
}

export function StaffVehicles() {
  const [cars, setCars] = useState<Car[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const [carsSnapshot, bookingsSnapshot] = await Promise.all([
          getDocs(collection(db, "carCatalog")),
          getDocs(
            query(collection(db, "bookings"), orderBy("createdAt", "desc")),
          ),
        ]);

        setCars(
          carsSnapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<Car, "id">),
          })),
        );

        setBookings(
          bookingsSnapshot.docs.map((item) => ({
            id: item.id,
            ...(item.data() as Omit<Booking, "id">),
          })),
        );
      } catch (loadError) {
        console.error("ERRO STAFF VIATURAS:", loadError);
        setError("Não foi possível carregar o estado das viaturas.");
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, []);

  const rows = useMemo(() => {
    return cars.map((car) => {
      const carBookings = bookings.filter(
        (booking) => booking.carId === car.id && booking.status !== "cancelled",
      );

      const activeBooking = carBookings.find(
        (booking) => booking.status === "in_progress",
      );

      const nextBooking = carBookings.find(
        (booking) =>
          booking.status === "confirmed" || booking.status === "pending",
      );

      const latestCompleted = carBookings.find(
        (booking) =>
          booking.status === "completed" || booking.checkin?.completed,
      );

      const mileage =
        activeBooking?.checkout?.mileage ??
        latestCompleted?.checkin?.mileage ??
        latestCompleted?.checkout?.mileage ??
        car.mileage;

      const fuel =
        activeBooking?.checkout?.fuelLevel ??
        latestCompleted?.checkin?.fuelLevel ??
        latestCompleted?.checkout?.fuelLevel;

      let operationalStatus =
        fleetStatusLabels[car.status || "available"] || "Disponível";
      let inspectionStatus = "OK";

      if (activeBooking) {
        operationalStatus = "Em aluguer";

        if (!activeBooking.checkout?.completed) {
          inspectionStatus = "Falta inspeção de saída";
        } else if (!activeBooking.checkin?.completed) {
          inspectionStatus = "A aguardar devolução";
        }
      } else if (nextBooking) {
        operationalStatus = "Reserva próxima";

        if (!nextBooking.checkout?.completed) {
          inspectionStatus = "Inspeção de saída pendente";
        }
      }

      if (
        latestCompleted?.checkin?.hasDamage &&
        operationalStatus === "Disponível"
      ) {
        operationalStatus = "Com dano registado";
      }

      return {
        car,
        activeBooking,
        nextBooking,
        mileage,
        fuel,
        operationalStatus,
        inspectionStatus,
        hasDamage: Boolean(latestCompleted?.checkin?.hasDamage),
      };
    });
  }, [cars, bookings]);

  if (loading) {
    return <p>A carregar estado das viaturas...</p>;
  }

  if (error) {
    return <div className="customer-auth-error">{error}</div>;
  }

  return (
    <section className="staff-vehicles">
      <div className="staff-vehicles-heading">
        <div>
          <p className="eyebrow">Operação 7Go</p>
          <h2>Estado das viaturas</h2>
          <p>Disponibilidade, quilometragem, combustível e inspeções.</p>
        </div>
      </div>

      <div className="staff-vehicles-grid">
        {rows.map((row) => {
          const booking = row.activeBooking || row.nextBooking;

          return (
            <article key={row.car.id} className="staff-vehicle-card">
              <header>
                <div>
                  <span>{row.car.registrationPlate || "Sem matrícula"}</span>

                  <h3>
                    {[row.car.brand, row.car.model].filter(Boolean).join(" ") ||
                      "Viatura"}
                  </h3>
                </div>

                <strong
                  className={`staff-vehicle-status ${getOperationalStatusClass(
                    row.operationalStatus,
                  )}`}
                >
                  {row.operationalStatus}
                </strong>
              </header>

              <div className="staff-vehicle-facts">
                <div>
                  <Gauge aria-hidden="true" />
                  <span>Quilometragem</span>
                  <strong>
                    {row.mileage != null
                      ? `${row.mileage.toLocaleString("pt-PT")} km`
                      : "Não registada"}
                  </strong>
                </div>

                <div>
                  <Fuel aria-hidden="true" />
                  <span>Combustível</span>
                  <strong>
                    {row.fuel
                      ? fuelLabels[row.fuel] || row.fuel
                      : "Não registado"}
                  </strong>
                </div>

                <div>
                  <ShieldCheck aria-hidden="true" />
                  <span>Inspeção</span>
                  <strong
                    className={`staff-vehicle-inspection-status ${getInspectionStatusClass(
                      row.inspectionStatus,
                    )}`}
                  >
                    {row.inspectionStatus}
                  </strong>
                </div>

                <div>
                  {row.hasDamage ? (
                    <TriangleAlert aria-hidden="true" />
                  ) : (
                    <CarFront aria-hidden="true" />
                  )}

                  <span>Danos</span>
                  <strong
                    className={
                      row.hasDamage
                        ? "staff-vehicle-damage is-danger"
                        : "staff-vehicle-damage is-success"
                    }
                  >
                    {row.hasDamage ? "Registados" : "Sem danos registados"}
                  </strong>
                </div>
              </div>

              {booking && (
                <div className="staff-vehicle-booking">
                  <span>Reserva: {booking.reference || booking.id}</span>

                  {booking.returnDate && (
                    <strong>
                      Devolução: {booking.returnDate}
                      {booking.returnTime ? ` · ${booking.returnTime}` : ""}
                    </strong>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
