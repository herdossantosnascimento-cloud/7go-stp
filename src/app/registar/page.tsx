"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase/client";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function register(event: FormEvent) {
    event.preventDefault();

    if (password.length < 6) {
      setError("A palavra-passe deve ter pelo menos 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As palavras-passe não coincidem.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      await updateProfile(credential.user, {
        displayName: name.trim(),
      });

      await setDoc(
        doc(db, "users", credential.user.uid),
        {
          uid: credential.user.uid,
          name: name.trim(),
          phone: phone.trim(),
          email: credential.user.email,
          role: "customer",
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );

      await sendEmailVerification(credential.user);

      router.push("/");
    } catch (error) {
      const firebaseError = error as {
        code?: string;
        message?: string;
      };

      console.error("ERRO REGISTO FIREBASE:", firebaseError);

      switch (firebaseError.code) {
        case "auth/email-already-in-use":
          setError(
            "Este email já tem uma conta. Usa Entrar ou recupera a palavra-passe.",
          );
          break;

        case "auth/invalid-email":
          setError("O endereço de email não é válido.");
          break;

        case "auth/weak-password":
          setError("A palavra-passe é demasiado fraca.");
          break;

        case "auth/operation-not-allowed":
          setError(
            "O registo por email e palavra-passe ainda não está ativado no Firebase.",
          );
          break;

        default:
          setError(
            `Não foi possível criar a conta${
              firebaseError.code ? ` (${firebaseError.code})` : ""
            }.`,
          );
      }
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

        <span className="customer-auth-kicker">Novo cliente</span>

        <h1>Criar conta</h1>

        <form onSubmit={register}>
          <label>
            Nome completo
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <label>
            Telefone
            <input
              type="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>

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
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <label>
            Confirmar palavra-passe
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          {error && <div className="customer-auth-error">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? "A criar conta..." : "Criar conta"}
          </button>
        </form>

        <div className="customer-auth-links">
          <Link href="/login">Já tenho conta</Link>
        </div>
      </section>
    </main>
  );
}
