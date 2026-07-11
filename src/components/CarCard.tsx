import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Fuel,
  Gauge,
  Users,
} from "lucide-react";
import type { Car } from "@/data/cars";

const statusLabel = {
  available: "Disponível",
  limited: "Poucas datas",
  booked: "Reservado",
};

export function CarCard({ car }: { car: Car }) {
  return (
    <article className="car-card">
      <div className="car-card-image">
        <Image
          src={car.image}
          alt={`${car.brand} ${car.model}`}
          fill
          sizes="(max-width: 900px) 100vw, 560px"
        />

        <span className={`car-status car-status-${car.status}`}>
          {statusLabel[car.status]}
        </span>
      </div>

      <div className="car-card-content">
        <div className="car-card-heading">
          <div>
            <p>{car.brand}</p>
            <h3>{car.model}</h3>
          </div>

          <div className="car-price">
            <strong>
              {car.currency}
              {car.pricePerDay}
            </strong>
            <span>/ dia</span>
          </div>
        </div>

        <small>{car.category}</small>

        <div className="car-specs">
          <span>
            <Users aria-hidden="true" />
            {car.seats} lugares
          </span>

          <span>
            <Gauge aria-hidden="true" />
            {car.transmission}
          </span>

          <span>
            <Fuel aria-hidden="true" />
            {car.fuel}
          </span>
        </div>

        <Link className="car-card-action" href={`/carros/${car.id}`}>
          <strong>Ver disponibilidade</strong>

          <span className="car-card-action-icon">
            <ArrowUpRight aria-hidden="true" />
          </span>
        </Link>
      </div>
    </article>
  );
}
