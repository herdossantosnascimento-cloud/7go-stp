"use client";

import Link from "next/link";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";

import { auth } from "@/lib/firebase/client";

export function HomeAuthNav() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="home-auth-loading">...</div>;
  }

  if (!user) {
    return (
      <div className="home-auth-actions">
        <Link href="/acesso" className="login-button">
          Entrar
        </Link>

        <Link href="/registar" className="home-register-button">
          Criar conta
        </Link>
      </div>
    );
  }

  const firstName = user.displayName?.trim().split(/\s+/)[0] || "Cliente";

  return (
    <div className="home-auth-user">
      <div className="home-auth-user-info">
        <span>Olá, {firstName}</span>

        <Link href="/minha-conta">Minha conta</Link>
      </div>

      <button type="button" onClick={() => signOut(auth)}>
        Sair
      </button>
    </div>
  );
}
