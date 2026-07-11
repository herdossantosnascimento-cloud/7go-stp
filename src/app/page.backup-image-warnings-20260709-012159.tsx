import Image from "next/image";

const cars = [
  { brand: "Ford", model: "Kuga", image: "/images/ford-kuga.jpg", price: "Desde 45€/dia" },
  { brand: "Toyota", model: "RAV4", image: "/images/ford-kuga.jpg", price: "Em breve" },
  { brand: "Suzuki", model: "Vitara", image: "/images/ford-kuga.jpg", price: "Em breve" },
  { brand: "Daihatsu", model: "Terios", image: "/images/ford-kuga.jpg", price: "Em breve" },
  { brand: "Toyota", model: "Prado", image: "/images/ford-kuga.jpg", price: "Em breve" },
  { brand: "Toyota", model: "Land Cruiser", image: "/images/ford-kuga.jpg", price: "Em breve" },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-black text-white">
      <section className="relative min-h-screen px-6 py-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(34,197,94,0.25),transparent_35%),radial-gradient(circle_at_20%_70%,rgba(255,255,255,0.08),transparent_30%)]" />

        <nav className="relative z-20 flex items-center justify-between">
          <div className="logo-spin">
            <Image src="/images/7go-logo.png" alt="7Go STP" width={120} height={120} priority />
          </div>

          <div className="hidden gap-8 rounded-full border border-white/10 bg-white/5 px-8 py-4 text-sm font-semibold backdrop-blur md:flex">
            <a className="text-green-400">Início</a>
            <a>Carros</a>
            <a>Como funciona</a>
            <a>Contacto</a>
          </div>

          <button className="rounded-full bg-green-500 px-7 py-3 font-bold text-black shadow-[0_0_30px_rgba(34,197,94,0.55)]">
            Entrar
          </button>
        </nav>

        <div className="relative z-10 grid min-h-[80vh] items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-5 inline-flex rounded-full border border-green-400/40 bg-green-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-green-400">
              Aluguer de carros em São Tomé
            </p>

            <h1 className="max-w-3xl text-6xl font-black leading-none tracking-tight md:text-8xl">
              O teu destino.
              <br />
              <span className="text-green-400">O teu caminho.</span>
            </h1>

            <p className="mt-7 max-w-xl text-lg text-white/70">
              Encontra carros para turismo, negócios e aventura. Ford Kuga, Suzuki, RAV4, Terios,
              Prado, Land Cruiser e muito mais.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <button className="rounded-full bg-green-500 px-8 py-4 font-black text-black">
                Ver carros disponíveis
              </button>
              <button className="rounded-full border border-white/15 px-8 py-4 font-black">
                Criar anúncio
              </button>
            </div>
          </div>

          <div className="relative mx-auto h-[520px] w-[520px] max-w-full">
            <div className="orbit-ring" />

            {cars.map((car, index) => (
              <div
                key={`${car.brand}-${car.model}`}
                className="car-orbit"
                style={{ animationDelay: `-${index * 4}s` }}
              >
                <div className="car-card">
                  <div className="relative h-40 w-40 overflow-hidden rounded-full border-4 border-green-400/70 shadow-[0_0_45px_rgba(34,197,94,0.45)]">
                    <Image src={car.image} alt={`${car.brand} ${car.model}`} fill className="object-cover" />
                  </div>
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/80 px-4 py-3 text-center backdrop-blur">
                    <p className="text-xs font-black uppercase text-green-400">{car.price}</p>
                    <p className="text-lg font-black">{car.brand}</p>
                    <p className="text-sm text-white/70">{car.model}</p>
                  </div>
                </div>
              </div>
            ))}

            <div className="absolute left-1/2 top-1/2 z-20 flex h-56 w-56 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-green-400/40 bg-black/70 shadow-[0_0_80px_rgba(34,197,94,0.4)] backdrop-blur">
              <Image src="/images/7go-icon.png" alt="7Go Icon" width={190} height={190} className="pulse-logo" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
