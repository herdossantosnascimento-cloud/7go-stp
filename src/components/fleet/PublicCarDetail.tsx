"use client";

import Image from "next/image";
import Link from "next/link";
import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { AvailabilityForm } from "@/components/AvailabilityForm";
import type { Car } from "@/data/cars";
import { db } from "@/lib/firebase/client";

export function PublicCarDetail({ fallbackCar }: { fallbackCar: Car }) {
  const [car, setCar] = useState<Car>(fallbackCar);

  useEffect(() => {
    return onSnapshot(
      doc(db, "carCatalog", fallbackCar.id),
      (snapshot) => {
        if (!snapshot.exists()) {
          setCar(fallbackCar);
          return;
        }

        setCar({
          ...fallbackCar,
          id: snapshot.id,
          ...snapshot.data(),
          premiumPricePerDay:
            snapshot.data().premiumPricePerDay ??
            fallbackCar.premiumPricePerDay,
          normalExcess:
            snapshot.data().normalExcess ??
            fallbackCar.normalExcess,
        } as Car);
      },
      (error) => {
        console.error("ERRO AO CARREGAR CARRO:", error);
        setCar(fallbackCar);
      },
    );
  }, [fallbackCar]);

  return (
    <section className="car-detail">
      <Link className="detail-back" href="/#frota">
        ← Voltar à frota
      </Link>

      <div className="car-detail-grid">
        <div className="car-detail-media">
          <div className="showcase-glow" />

          <Image
            src={car.image}
            alt={`${car.brand} ${car.model}`}
            fill
            priority
            sizes="(max-width: 900px) 100vw, 56vw"
          />
        </div>

        <div className="car-detail-info">
          <p className="eyebrow">Ver disponibilidade</p>

          <h1>
            {car.brand}
            <span>{car.model}</span>
          </h1>

          <p className="detail-desc">
            Confirma a disponibilidade deste carro para a tua viagem em São
            Tomé. A equipa 7Go confirma datas, caução, entrega e condições antes
            da reserva final.
          </p>

          <div className="detail-price">
            <small>Desde</small>
            <strong>
              {car.currency}
              {car.pricePerDay}
            </strong>
            <span>/ dia</span>
          </div>

          <div className="detail-specs">
            <span>{car.year}</span>
            <span>{car.category}</span>
            <span>{car.seats} lugares</span>
            <span>{car.transmission}</span>
            <span>{car.fuel}</span>
          </div>

          {car.status === "booked" ? (
            <div className="fleet-global-status fleet-global-status-booked">
              Este carro está temporariamente indisponível para novos pedidos.
            </div>
          ) : (
            <>
              {car.status === "limited" && (
                <div className="fleet-global-status fleet-global-status-limited">
                  Disponibilidade limitada. Confirma as datas com a 7Go.
                </div>
              )}

              <AvailabilityForm car={car} />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
