"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";

import { auth } from "@/lib/firebase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function resetPassword(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      await sendPasswordResetEmail(auth, email.trim());

      setMessage(
        "Se o email estiver registado, receberás instruções para alterar a palavra-passe.",
      );
    } catch {
      setMessage("Não foi possível processar o pedido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="customer-auth-page">
      <section className="customer-auth-card">
        <Link href="/" className="customer-auth-brand">
          7GO
        </Link>

        <span className="customer-auth-kicker">Recuperar acesso</span>

        <h1>Esqueci a palavra-passe</h1>

        <p>Introduz o email associado à tua conta.</p>

        <form onSubmit={resetPassword}>
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          {message && <div className="customer-auth-message">{message}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "A enviar..." : "Enviar recuperação"}
          </button>
        </form>

        <div className="customer-auth-links">
          <Link href="/login">Voltar ao login</Link>
        </div>
      </section>
    </main>
  );
}
