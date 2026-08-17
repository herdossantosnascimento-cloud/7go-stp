"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getMultiFactorResolver,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  TotpMultiFactorGenerator,
  type MultiFactorError,
  type MultiFactorResolver,
} from "firebase/auth";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { auth } from "@/lib/firebase/client";

const ADMIN_EMAIL =
  "her.dos.santos.nascimento@gmail.com";

async function isAdminAccount() {
  const user = auth.currentUser;

  if (!user) return false;

  if (
    user.email?.toLowerCase() ===
    ADMIN_EMAIL.toLowerCase()
  ) {
    return true;
  }

  const token =
    await user.getIdTokenResult(true);

  return token.claims.role === "admin";
}

async function hasTotpSecondFactor() {
  const user = auth.currentUser;

  if (!user) return false;

  const token =
    await user.getIdTokenResult(true);

  const firebaseClaims =
    token.claims.firebase as
      | {
          sign_in_second_factor?: string;
        }
      | undefined;

  return (
    firebaseClaims?.sign_in_second_factor ===
    TotpMultiFactorGenerator.FACTOR_ID
  );
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [mfaCode, setMfaCode] =
    useState("");

  const [resolver, setResolver] =
    useState<MultiFactorResolver | null>(
      null,
    );

  const [loading, setLoading] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    return onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          setChecking(false);
          return;
        }

        try {
          const admin =
            await isAdminAccount();

          const mfa =
            await hasTotpSecondFactor();

          if (admin && mfa) {
            router.replace(
              "/admin/reservas",
            );
            return;
          }

          await signOut(auth);

          setChecking(false);
        } catch (authError) {
          console.error(
            "ERRO AO VERIFICAR ADMIN:",
            authError,
          );

          await signOut(auth);

          setChecking(false);
        }
      },
    );
  }, [router]);

  async function login(
    event: FormEvent,
  ) {
    event.preventDefault();

    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password,
      );

      /*
       * Se chegou aqui sem MFA challenge,
       * não permitimos acesso ao Admin.
       */
      const admin =
        await isAdminAccount();

      if (!admin) {
        await signOut(auth);

        setError(
          "Esta conta não tem acesso de administrador.",
        );

        return;
      }

      const mfa =
        await hasTotpSecondFactor();

      if (!mfa) {
        await signOut(auth);

        setError(
          "O acesso de administrador exige autenticação em dois fatores.",
        );

        return;
      }

      router.replace(
        "/admin/reservas",
      );
    } catch (loginError) {
      const firebaseError =
        loginError as {
          code?: string;
        };

      if (
        firebaseError.code ===
        "auth/multi-factor-auth-required"
      ) {
        const mfaResolver =
          getMultiFactorResolver(
            auth,
            loginError as MultiFactorError,
          );

        const totpFactor =
          mfaResolver.hints.find(
            (hint) =>
              hint.factorId ===
              TotpMultiFactorGenerator.FACTOR_ID,
          );

        if (!totpFactor) {
          setError(
            "Não foi encontrado um autenticador TOTP nesta conta.",
          );

          return;
        }

        setResolver(mfaResolver);
        setMfaCode("");
        setError("");

        return;
      }

      console.error(
        "ERRO LOGIN ADMIN:",
        loginError,
      );

      setError(
        "Não foi possível iniciar sessão. Confirma o email e a palavra-passe.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmMfa(
    event: FormEvent,
  ) {
    event.preventDefault();

    if (!resolver) return;

    const cleanCode =
      mfaCode.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      setError(
        "Introduz o código de 6 dígitos do Authenticator.",
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const totpFactor =
        resolver.hints.find(
          (hint) =>
            hint.factorId ===
            TotpMultiFactorGenerator.FACTOR_ID,
        );

      if (!totpFactor) {
        throw new Error(
          "TOTP_NOT_FOUND",
        );
      }

      const assertion =
        TotpMultiFactorGenerator.assertionForSignIn(
          totpFactor.uid,
          cleanCode,
        );

      await resolver.resolveSignIn(
        assertion,
      );

      const admin =
        await isAdminAccount();

      const mfa =
        await hasTotpSecondFactor();

      if (!admin || !mfa) {
        await signOut(auth);

        throw new Error(
          "ADMIN_MFA_INVALID",
        );
      }

      router.replace(
        "/admin/reservas",
      );
    } catch (mfaError) {
      console.error(
        "ERRO MFA ADMIN:",
        mfaError,
      );

      setError(
        "Código inválido ou expirado. Introduz o código atual do Authenticator.",
      );
    } finally {
      setLoading(false);
    }
  }

  function cancelMfa() {
    setResolver(null);
    setMfaCode("");
    setPassword("");
    setError("");
  }

  if (checking) {
    return (
      <main className="site">
        <section className="admin-login">
          <p>
            A verificar sessão...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="site">
      <section className="admin-login">
        <p className="eyebrow">
          Administração 7Go
        </p>

        <h1>
          {resolver
            ? "Confirma o segundo fator."
            : "Entrar no painel."}
        </h1>

        {!resolver ? (
          <form
            className="admin-login-card"
            onSubmit={login}
          >
            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Palavra-passe
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value,
                  )
                }
              />
            </label>

            {error && (
              <div className="customer-auth-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "A verificar..."
                : "Continuar"}
            </button>

            <Link href="/">
              ← Voltar ao site
            </Link>
          </form>
        ) : (
          <form
            className="admin-login-card"
            onSubmit={confirmMfa}
          >
            <p>
              Abre o Google Authenticator
              e introduz o código atual
              de 6 dígitos.
            </p>

            <label>
              Código do Authenticator

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                autoFocus
                required
                value={mfaCode}
                onChange={(event) =>
                  setMfaCode(
                    event.target.value.replace(
                      /\D/g,
                      "",
                    ),
                  )
                }
              />
            </label>

            {error && (
              <div className="customer-auth-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
            >
              {loading
                ? "A confirmar..."
                : "Confirmar código"}
            </button>

            <button
              type="button"
              onClick={cancelMfa}
              disabled={loading}
            >
              Voltar
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
