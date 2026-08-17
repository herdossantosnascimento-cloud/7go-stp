"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  onAuthStateChanged,
  sendEmailVerification,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { FormEvent, useEffect, useState } from "react";

import { auth, db } from "@/lib/firebase/client";

type CustomerProfile = {
  uid?: string;
  name?: string;
  phone?: string;
  email?: string;
  role?: string;
  active?: boolean;
};

export default function CustomerProfilePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  const [name, setName] = useState("");

  const [phone, setPhone] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/login");
        return;
      }

      setUser(currentUser);

      try {
        const snapshot = await getDoc(doc(db, "users", currentUser.uid));

        if (snapshot.exists()) {
          const profile = snapshot.data() as CustomerProfile;

          setName(profile.name || currentUser.displayName || "");

          setPhone(profile.phone || "");
        } else {
          setName(currentUser.displayName || "");
        }
      } catch (loadError) {
        console.error("ERRO AO CARREGAR PERFIL:", loadError);

        setError("Não foi possível carregar o perfil.");
      } finally {
        setLoading(false);
      }
    });
  }, [router]);

  async function saveProfile(event: FormEvent) {
    event.preventDefault();

    if (!user) return;

    const cleanName = name.trim();
    const cleanPhone = phone.trim();

    if (!cleanName) {
      setError("Introduz o teu nome.");
      return;
    }

    if (!cleanPhone) {
      setError("Introduz o teu telefone.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateProfile(user, {
        displayName: cleanName,
      });

      await updateDoc(doc(db, "users", user.uid), {
        name: cleanName,
        phone: cleanPhone,
        updatedAt: serverTimestamp(),
      });

      setMessage("✓ Perfil atualizado com sucesso.");
    } catch (saveError) {
      console.error("ERRO AO GUARDAR PERFIL:", saveError);

      setError("Não foi possível guardar as alterações.");
    } finally {
      setSaving(false);
    }
  }

  async function resendVerification() {
    if (!user) return;

    setError("");
    setMessage("");

    try {
      await sendEmailVerification(user);

      setMessage("✓ Email de verificação enviado.");
    } catch (verificationError) {
      console.error("ERRO VERIFICAÇÃO EMAIL:", verificationError);

      setError("Não foi possível enviar o email de verificação.");
    }
  }

  async function logout() {
    await signOut(auth);
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="customer-account-page">
        <p>A carregar perfil...</p>
      </main>
    );
  }

  return (
    <main className="customer-account-page">
      <section className="customer-bookings-header">
        <div>
          <Link href="/minha-conta">← Minha conta</Link>

          <span>7GO · Área do cliente</span>

          <h1>Perfil</h1>

          <p>Gere os teus dados pessoais e contacto.</p>
        </div>
      </section>

      <section className="customer-profile-card">
        <div className="customer-profile-status">
          <div>
            <span>Email</span>
            <strong>{user?.email || "-"}</strong>
          </div>

          <div>
            <span>Estado</span>

            <strong
              className={user?.emailVerified ? "is-verified" : "is-pending"}
            >
              {user?.emailVerified ? "✓ Verificado" : "⚠ Por verificar"}
            </strong>
          </div>
        </div>

        {!user?.emailVerified && (
          <button
            type="button"
            className="customer-profile-verification"
            onClick={resendVerification}
          >
            Reenviar email de verificação
          </button>
        )}

        <form onSubmit={saveProfile} className="customer-profile-form">
          <label>
            Nome completo
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <label>
            Telefone
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </label>

          <label>
            Email
            <input type="email" value={user?.email || ""} disabled />
            <small>O email da conta não pode ser alterado aqui.</small>
          </label>

          {error && <div className="customer-auth-error">{error}</div>}

          {message && <div className="customer-auth-message">{message}</div>}

          <button type="submit" disabled={saving}>
            {saving ? "A guardar..." : "Guardar alterações"}
          </button>
        </form>

        <button
          type="button"
          className="customer-profile-logout"
          onClick={logout}
        >
          Terminar sessão
        </button>
      </section>
    </main>
  );
}
