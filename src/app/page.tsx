import Image from "next/image";
import { brand } from "@/config/brand";
import { PublicHomeFleet } from "@/components/fleet/PublicHomeFleet";

export default function Home() {
  return (
    <main className="site">
      <header className="header">
        <a className="brand-link" href="/" aria-label="7Go início">
          <Image
            src={brand.logo}
            alt="7Go STP"
            width={110}
            height={90}
            priority
            className="logo"
          />
        </a>

        <nav>
          <a className="active" href="/">Início</a>
          <a href="#frota">Carros</a>
          <a href="/como-funciona">Como funciona</a>
          <a href="/minha-reserva">Minha reserva</a>
          <a href="#contacto">Contacto</a>
        </nav>

        <button className="login-button">Entrar</button>
      </header>

      <PublicHomeFleet />
    </main>
  );
}
