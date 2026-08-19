import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, User, UserCog } from "lucide-react";

export default function AccessPage() {
  return (
    <main className="access-hub-page">
      <section className="access-hub">
        <Link href="/" className="access-hub-brand" aria-label="7Go STP">
          <Image
            src="/images/7go-logo-final.png"
            alt="7Go STP"
            width={120}
            height={90}
            priority
            className="auth-brand-logo"
          />
        </Link>

        <span className="access-hub-kicker">Acesso 7Go</span>

        <h1>Como queres entrar?</h1>

        <p>Escolhe a área correspondente ao teu acesso.</p>

        <div className="access-hub-grid">
          <Link href="/login" className="access-hub-card">
            <User aria-hidden="true" />

            <div>
              <strong>Cliente</strong>

              <span>Reservas, pagamentos, documentos e perfil.</span>
            </div>
          </Link>

          <Link href="/staff/login" className="access-hub-card">
            <UserCog aria-hidden="true" />

            <div>
              <strong>Funcionário</strong>

              <span>Reservas, entregas, devoluções e calendário.</span>
            </div>
          </Link>

          <Link href="/admin/login" className="access-hub-card">
            <ShieldCheck aria-hidden="true" />

            <div>
              <strong>Administrador</strong>

              <span>Gestão completa da 7Go.</span>
            </div>
          </Link>
        </div>

        <Link href="/" className="access-hub-back">
          ← Voltar ao início
        </Link>
      </section>
    </main>
  );
}
