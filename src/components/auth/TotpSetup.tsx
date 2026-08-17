"use client";

import QRCode from "qrcode";
import {
  multiFactor,
  sendEmailVerification,
  TotpMultiFactorGenerator,
  type TotpSecret,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";

type Props = {
  user: User;
  label: string;
};

export function TotpSetup({ user, label }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [secret, setSecret] = useState<TotpSecret | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [code, setCode] = useState("");
  const [manualKey, setManualKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const factors = multiFactor(user).enrolledFactors;

    setEnabled(
      factors.some(
        (factor) => factor.factorId === TotpMultiFactorGenerator.FACTOR_ID,
      ),
    );
  }, [user]);

  async function sendVerification() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await sendEmailVerification(user);

      setMessage(
        "✓ Email de verificação enviado. Abre o email, confirma a conta e depois termina sessão e volta a entrar.",
      );
    } catch (verificationError) {
      console.error("ERRO AO ENVIAR VERIFICAÇÃO:", verificationError);

      setError("Não foi possível enviar o email de verificação.");
    } finally {
      setLoading(false);
    }
  }

  async function beginSetup() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await user.reload();

      if (!user.emailVerified) {
        setError("Confirma primeiro o email desta conta antes de ativar 2FA.");
        return;
      }

      const session = await multiFactor(user).getSession();

      const generatedSecret =
        await TotpMultiFactorGenerator.generateSecret(session);

      const uri = generatedSecret.generateQrCodeUrl(
        user.email || user.uid,
        "7Go STP",
      );

      const dataUrl = await QRCode.toDataURL(uri, {
        width: 260,
        margin: 2,
      });

      setSecret(generatedSecret);
      setQrCode(dataUrl);
      setManualKey(generatedSecret.secretKey);
    } catch (setupError) {
      console.error("ERRO TOTP SETUP:", setupError);

      setError(
        setupError instanceof Error
          ? setupError.message
          : "Não foi possível iniciar a configuração 2FA.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmSetup() {
    if (!secret) return;

    const cleanCode = code.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      setError("Introduz o código de 6 dígitos.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const assertion = TotpMultiFactorGenerator.assertionForEnrollment(
        secret,
        cleanCode,
      );

      await multiFactor(user).enroll(assertion, label);

      setEnabled(true);
      setSecret(null);
      setQrCode("");
      setManualKey("");
      setCode("");

      setMessage("✓ Autenticação em dois fatores ativada.");
    } catch (confirmError) {
      console.error("ERRO CONFIRMAR TOTP:", confirmError);

      setError("Código inválido ou expirado. Tenta novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="totp-setup-card">
      <div>
        <span className="totp-kicker">Segurança</span>

        <h3>Autenticação em dois fatores</h3>

        <p>
          Usa Google Authenticator, Microsoft Authenticator ou outra aplicação
          compatível com TOTP.
        </p>
      </div>

      {enabled ? (
        <div className="totp-enabled">✓ 2FA está ativo nesta conta.</div>
      ) : !user.emailVerified ? (
        <div className="totp-email-verification">
          <p>Antes de ativar o 2FA, confirma o email desta conta.</p>

          <button
            type="button"
            onClick={() => void sendVerification()}
            disabled={loading}
          >
            {loading ? "A enviar..." : "Enviar email de verificação"}
          </button>
        </div>
      ) : !secret ? (
        <button
          type="button"
          onClick={() => void beginSetup()}
          disabled={loading}
        >
          {loading ? "A preparar..." : "Ativar 2FA"}
        </button>
      ) : (
        <div className="totp-enrollment">
          {qrCode && (
            <img src={qrCode} alt="QR Code 2FA" width={260} height={260} />
          )}

          <p>Abre a aplicação Authenticator e lê o QR Code.</p>

          <div className="totp-manual-key">
            <span>Chave manual</span>
            <code>{manualKey}</code>
          </div>

          <label>
            Código de 6 dígitos
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, ""))
              }
            />
          </label>

          <button
            type="button"
            onClick={() => void confirmSetup()}
            disabled={loading}
          >
            {loading ? "A confirmar..." : "Confirmar e ativar"}
          </button>
        </div>
      )}

      {message && <div className="customer-auth-message">{message}</div>}

      {error && <div className="customer-auth-error">{error}</div>}
    </section>
  );
}
