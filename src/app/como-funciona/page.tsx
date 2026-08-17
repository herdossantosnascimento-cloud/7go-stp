import Image from "next/image";
import Link from "next/link";
import { brand } from "@/config/brand";

export default function ComoFuncionaPage() {
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
          <Link className="active" href="/como-funciona">
            Como funciona
          </Link>
          <Link href="/minha-reserva">Minha reserva</Link>
          <Link href="/#contacto">Contacto</Link>
        </nav>

        <a href="/acesso" className="login-button">Entrar</a>
      </header>

      <section className="how-page how-page-protection">
        <div className="section-heading how-main-heading">
          <p>Como funciona</p>

          <h1>Escolhe a proteção certa para a tua viagem.</h1>

          <span>
            Em todas as reservas, os valores da franquia e da caução são
            apresentados antes do envio do pedido.
          </span>
        </div>

        <div className="rental-options-grid protection-options-grid">
          <article className="rental-option rental-option-premium protection-card">
            <div className="protection-card-top">
              <div>
                <span>7Go Premium</span>
                <h2>Viaja com franquia 0.</h2>
              </div>

              <div className="zero-excess-badge">
                <small>Franquia</small>
                <strong>0</strong>
              </div>
            </div>

            <p>
              Com a proteção 7Go Premium, em caso de dano coberto pelas
              condições do aluguer, não pagas franquia. O valor adicional do
              Premium é calculado por dia e apresentado antes da reserva.
            </p>

            <ul>
              <li>Franquia 0 em danos cobertos</li>
              <li>Caução reembolsável obrigatória</li>
              <li>Proteção adicional incluída</li>
              <li>Assistência prioritária da equipa 7Go</li>
              <li>Valor Premium acrescentado por dia</li>
            </ul>

            <div className="protection-note protection-note-premium">
              <strong>Importante</strong>

              <p>
                A franquia 0 não cobre multas, combustível em falta, perda de
                chaves ou documentos, danos intencionais, condução sob efeito
                de álcool ou drogas, utilização não autorizada ou outras
                exclusões previstas no contrato.
              </p>
            </div>
          </article>

          <article className="rental-option protection-card">
            <div className="protection-card-top">
              <div>
                <span>Aluguer normal</span>
                <h2>Preço diário mais baixo.</h2>
              </div>

              <div className="standard-excess-badge">
                <small>Franquia</small>
                <strong>Por carro</strong>
              </div>
            </div>

            <p>
              No aluguer normal, em caso de dano coberto, a responsabilidade do
              cliente fica limitada ao valor da franquia definida para o
              veículo escolhido.
            </p>

            <ul>
              <li>Franquia definida individualmente por carro</li>
              <li>Caução reembolsável obrigatória</li>
              <li>Entrega e devolução combinadas com a equipa 7Go</li>
              <li>Condições apresentadas antes da reserva</li>
              <li>Ideal para quem procura o preço diário mais baixo</li>
            </ul>

            <div className="protection-note">
              <strong>Valor transparente</strong>

              <p>
                O valor exato da franquia e da caução aparece na página de cada
                carro antes de confirmares o pedido de disponibilidade.
              </p>
            </div>
          </article>
        </div>

        <section className="deposit-excess-explainer">
          <div className="section-heading">
            <p>Franquia e caução</p>
            <h2>São valores diferentes.</h2>
          </div>

          <div className="deposit-excess-grid">
            <article>
              <span>Franquia</span>

              <h3>Responsabilidade em caso de dano.</h3>

              <p>
                A franquia é o limite da responsabilidade financeira do cliente
                em caso de dano coberto pelas condições do aluguer.
              </p>

              <div>
                <strong>Aluguer normal</strong>
                <small>Franquia definida por carro</small>
              </div>

              <div>
                <strong>7Go Premium</strong>
                <small>Franquia 0 em danos cobertos</small>
              </div>
            </article>

            <article>
              <span>Caução reembolsável</span>

              <h3>Garantia durante o aluguer.</h3>

              <p>
                A caução é paga ou bloqueada antes da entrega e devolvida após a
                verificação do veículo, desde que não existam valores pendentes.
              </p>

              <div>
                <strong>Pode cobrir</strong>
                <small>
                  Combustível em falta, multas, perda de chaves, atraso, limpeza
                  extraordinária e outras situações previstas no contrato.
                </small>
              </div>
            </article>
          </div>
        </section>

        <section className="rental-process">
          <div className="section-heading">
            <p>Passo a passo</p>
            <h2>Da escolha do carro até à devolução.</h2>
          </div>

          <div className="rental-process-grid">
            <article>
              <span>01</span>
              <h3>Escolhe o carro</h3>
              <p>
                Consulta preço, transmissão, combustível, franquia e caução.
              </p>
            </article>

            <article>
              <span>02</span>
              <h3>Escolhe as datas</h3>
              <p>
                O sistema verifica se o carro está livre durante o período.
              </p>
            </article>

            <article>
              <span>03</span>
              <h3>Seleciona a modalidade</h3>
              <p>
                Escolhe Aluguer normal ou 7Go Premium com franquia 0.
              </p>
            </article>

            <article>
              <span>04</span>
              <h3>Recebe a confirmação</h3>
              <p>
                A equipa 7Go confirma disponibilidade, caução e condições.
              </p>
            </article>

            <article>
              <span>05</span>
              <h3>Entrega e devolução</h3>
              <p>
                O nível de combustível e o estado do carro são registados na
                entrega e na devolução.
              </p>
            </article>
          </div>
        </section>

        <div className="how-page-actions">
          <Link className="how-back-link" href="/#frota">
            Ver carros disponíveis
          </Link>

          <Link className="how-secondary-link" href="/minha-reserva">
            Consultar minha reserva
          </Link>
        </div>
      </section>
    </main>
  );
}
