"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";

import { auth } from "@/lib/firebase/client";

export default function MyAccountPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);
      setLoading(false);
    });
  }, [router]);

  async function logout() {
    await signOut(auth);
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="customer-account-page">
        <p>A carregar...</p>
      </main>
    );
  }

  return (
    <main className="customer-account-page">
      <section className="customer-account-header">
        <div>
          <Link href="/" className="customer-account-home-link">
            ← Voltar ao início
          </Link>

          <span>7GO · Área do cliente</span>

          <h1>Olá, {user?.displayName || "Cliente"}</h1>

          <p>{user?.email}</p>
        </div>

        <button type="button" onClick={logout}>
          Terminar sessão
        </button>
      </section>

      {!user?.emailVerified && (
        <div className="customer-account-warning">
          ⚠ Confirma o teu email para proteger a tua conta.
        </div>
      )}

      <section className="customer-account-grid">
        <Link href="/minha-conta/reservas">
          <strong>🚗 Minhas reservas</strong>
          <span>Consultar reservas e estado.</span>
        </Link>

        <Link href="/minha-conta/pagamentos">
          <strong>💳 Pagamentos</strong>
          <span>Consultar pagamentos.</span>
        </Link>

        <Link href="/minha-conta/documentos">
          <strong>📄 Documentos</strong>
          <span>Consultar fichas e documentos.</span>
        </Link>

        <Link href="/minha-conta/perfil">
          <strong>👤 Perfil</strong>
          <span>Dados pessoais e contacto.</span>
        </Link>
      </section>
    </main>
  );
}
