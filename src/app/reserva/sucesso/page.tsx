import Link from "next/link";

type SuccessPageProps = {
  searchParams: Promise<{
    ref?: string;
  }>;
};

export default async function ReservaSucessoPage({
  searchParams,
}: SuccessPageProps) {
  const { ref } = await searchParams;

  return (
    <main className="site">
      <section className="success-page">
        <p className="eyebrow">Pedido enviado</p>

        <h1>Reserva recebida pela 7Go.</h1>

        <p>
          O teu pedido foi registado com sucesso. A equipa 7Go vai confirmar a
          disponibilidade, caução, entrega e condições finais.
        </p>

        {ref && (
          <div className="success-reference">
            <span>Referência</span>
            <strong>{ref}</strong>
          </div>
        )}

        <div className="success-actions">
          <Link href="/minha-reserva">Consultar minha reserva</Link>
          <Link href="/#frota">Voltar aos carros</Link>
        </div>
      </section>
    </main>
  );
}
