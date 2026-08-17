"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams.get("returnTo") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);

      router.push(returnTo);
    } catch {
      setError(
        "Não foi possível iniciar sessão. Confirma o email e a palavra-passe.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function loginWithGoogle() {
    setGoogleLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(auth, provider);

      const token = await result.user.getIdTokenResult(true);

      if (token.claims.role === "admin" || token.claims.role === "staff") {
        await signOut(auth);

        setError("Esta conta deve entrar pela área correspondente.");

        return;
      }

      await setDoc(
        doc(db, "users", result.user.uid),
        {
          uid: result.user.uid,
          name: result.user.displayName || "",
          email: result.user.email || "",
          role: "customer",
          active: true,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      router.push(returnTo);
    } catch (googleError) {
      console.error("ERRO GOOGLE CLIENTE:", googleError);

      setError("Não foi possível entrar com Google.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <main className="customer-auth-page">
      <section className="customer-auth-card">
        <Link href="/" className="customer-auth-brand">
          7GO
        </Link>

        <span className="customer-auth-kicker">Área do cliente</span>

        <h1>Entrar</h1>

        <p>Acede às tuas reservas e documentos.</p>

        <button
          type="button"
          className="google-login-button"
          disabled={googleLoading}
          onClick={() => void loginWithGoogle()}
        >
          {googleLoading ? "A entrar..." : "G  Continuar com Google"}
        </button>

        <div className="auth-divider">
          <span>ou</span>
        </div>

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

        <div className="customer-auth-links">
          <Link href="/esqueci-password">Esqueci a palavra-passe</Link>

          <Link href="/registar">Criar conta</Link>
        </div>
      </section>
    </main>
  );
}
