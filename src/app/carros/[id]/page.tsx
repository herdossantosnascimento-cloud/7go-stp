import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cars } from "@/data/cars";
import { brand } from "@/config/brand";
import { PublicCarDetail } from "@/components/fleet/PublicCarDetail";

type PageProps = {
  params: Promise<{ id: string }>;
};

export function generateStaticParams() {
  return cars.map((car) => ({ id: car.id }));
}

export default async function CarDetailPage({ params }: PageProps) {
  const { id } = await params;
  const car = cars.find((item) => item.id === id);

  if (!car) notFound();

  return (
    <main className="site">
      <header className="header">
        <Link className="brand-link" href="/" aria-label="7Go início">
          <Image
            src={brand.logo}
            alt="7Go STP"
            width={110}
            height={90}
            priority
            className="logo"
          />
        </Link>

        <nav>
          <Link href="/">Início</Link>
          <Link className="active" href="/#frota">Carros</Link>
          <Link href="/como-funciona">Como funciona</Link>
          <Link href="/minha-reserva">Minha reserva</Link>
          <Link href="/#contacto">Contacto</Link>
        </nav>

        <a href="/acesso" className="login-button">Entrar</a>
      </header>

      <PublicCarDetail fallbackCar={car} />
    </main>
  );
}
