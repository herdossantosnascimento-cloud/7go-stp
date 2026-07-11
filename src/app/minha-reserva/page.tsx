import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";
import { MyBookingLookup } from "@/components/booking/MyBookingLookup";

export default function MinhaReservaPage() {
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
          <Link href="/#frota">Carros</Link>
          <Link href="/como-funciona">Como funciona</Link>
          <Link className="active" href="/minha-reserva">
            Minha reserva
          </Link>
        </nav>

        <button className="login-button">Entrar</button>
      </header>

      <section className="my-booking-page">
        <p className="eyebrow">Minha reserva</p>

        <h1>Consulta o estado da tua reserva.</h1>

        <p>
          Introduz a referência recebida no pedido para acompanhar se a reserva
          está pendente, confirmada ou cancelada.
        </p>

        <MyBookingLookup />
      </section>
    </main>
  );
}
