"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { FormEvent, useEffect, useState } from "react";

import { auth } from "@/lib/firebase/client";

async function isStaffAccount() {
  const user = auth.currentUser;

  if (!user) {
    return false;
  }

  const token = await user.getIdTokenResult(true);

  return token.claims.role === "staff";
}

export default function StaffLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [checking, setChecking] = useState(true);

  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setChecking(false);
        return;
      }

      try {
        const staff = await isStaffAccount();

        if (staff) {
          router.replace("/staff");
          return;
        }

        await signOut(auth);
        setChecking(false);
      } catch (authError) {
        console.error("ERRO AO VALIDAR STAFF:", authError);

        await signOut(auth);
        setChecking(false);
      }
    });
  }, [router]);

  async function login(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);

      const staff = await isStaffAccount();

      if (!staff) {
        await signOut(auth);

        setError("Esta conta não tem acesso à área de funcionário.");

        return;
      }

      router.replace("/staff");
    } catch (loginError) {
      console.error("ERRO LOGIN STAFF:", loginError);

      setError(
        "Não foi possível iniciar sessão. Confirma o email e a palavra-passe.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <main className="staff-login-page">
        <section className="staff-login-card">
          <p>A verificar sessão...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="staff-login-page">
      <section className="staff-login-card">
        <Link href="/" className="staff-login-brand">
          7GO
        </Link>

        <span className="staff-login-kicker">Área do funcionário</span>

        <h1>Entrar</h1>

        <p>Acesso à operação da 7Go.</p>

        <form onSubmit={login}>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label>
            Palavra-passe
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          {error && <div className="customer-auth-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "A entrar..." : "Entrar"}
          </button>
        </form>

        <Link href="/" className="staff-login-back">
          ← Voltar ao site
        </Link>
      </section>
    </main>
  );
}
