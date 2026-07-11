"use client";

import Image from "next/image";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { CarCard } from "@/components/CarCard";
import { cars as fallbackCars } from "@/data/cars";
import type { Car } from "@/data/cars";
import { db } from "@/lib/firebase/client";

export function PublicHomeFleet() {
  const [cars, setCars] = useState<Car[]>(fallbackCars);

  useEffect(() => {
    const fleetQuery = query(
      collection(db, "carCatalog"),
      orderBy("brand", "asc"),
    );

    return onSnapshot(
      fleetQuery,
      (snapshot) => {
        if (snapshot.empty) {
          setCars(fallbackCars);
          return;
        }

        setCars(
          snapshot.docs.map((item) => {
            const fallback = fallbackCars.find((car) => car.id === item.id);

            return {
              ...fallback,
              id: item.id,
              ...item.data(),
              premiumPricePerDay:
                item.data().premiumPricePerDay ??
                fallback?.premiumPricePerDay ??
                0,
              normalExcess:
                item.data().normalExcess ??
                fallback?.normalExcess ??
                0,
            };
          }) as Car[],
        );
      },
      (error) => {
        console.error("ERRO AO CARREGAR FROTA PÚBLICA:", error);
        setCars(fallbackCars);
      },
    );
  }, []);

  const featuredCar = useMemo(() => {
    return (
      cars.find((car) => car.id === "ford-kuga-2010") ||
      cars[0] ||
      fallbackCars[0]
    );
  }, [cars]);

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Aluguer de carros em São Tomé</p>

          <h1>
            O teu destino.
            <span>O teu caminho.</span>
          </h1>

          <p className="hero-desc">
            Encontra o carro ideal para explorar São Tomé com liberdade,
            conforto e segurança.
          </p>

          <div className="hero-actions">
            <a href="#frota">Ver carros disponíveis</a>
            <a className="hero-secondary-link" href="/como-funciona">
              Como funciona
            </a>
          </div>

          <div className="trust-row">
            <span>Reserva simples</span>
            <span>Carros verificados</span>
            <span>Suporte local</span>
          </div>
        </div>

        <div className="hero-showcase">
          <div className="showcase-glow" />

          <div className="vehicle-stage">
            <div className="stage-orbit stage-orbit-one" />
            <div className="stage-orbit stage-orbit-two" />

            <div className="vehicle-motion">
              <div className="vehicle-image">
                <Image
                  src={featuredCar.image}
                  alt={`${featuredCar.brand} ${featuredCar.model}`}
                  fill
                  sizes="(max-width: 900px) 100vw, 55vw"
                  priority
                />
              </div>

              <div className="vehicle-shadow" />
            </div>
          </div>

          <div className="vehicle-meta">
            <div className="vehicle-name">
              <span>{featuredCar.brand}</span>
              <h2>{featuredCar.model}</h2>
              <p>
                {featuredCar.category}
                <i />
                {featuredCar.seats} lugares
                <i />
                {featuredCar.transmission}
              </p>
            </div>

            <div className="vehicle-price">
              <small>Desde</small>
              <div>
                <strong>
                  {featuredCar.currency}
                  {featuredCar.pricePerDay}
                </strong>
                <span>/ dia</span>
              </div>
            </div>
          </div>

          <div className="showcase-caption">
            <span>01</span>
            <div />
            <p>Explora São Tomé à tua maneira</p>
          </div>
        </div>
      </section>

      <section className="fleet-section" id="frota">
        <div className="section-heading">
          <p>Frota 7Go</p>
          <h2>Escolhe o carro certo para a tua viagem.</h2>
        </div>

        <div className="car-grid">
          {cars.map((car) => (
            <CarCard key={car.id} car={car} />
          ))}
        </div>
      </section>

    </>
  );
}
