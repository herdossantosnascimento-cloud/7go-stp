"use client";

import { Banknote, CreditCard, ShieldCheck, X } from "lucide-react";

export type PaymentChoice = "stripe" | "cash";

type PaymentMethodModalProps = {
  open: boolean;
  currency: string;
  baseAmount: number;
  cashFee: number;
  selected: PaymentChoice;
  onSelect: (choice: PaymentChoice) => void;
  onClose: () => void;
  onContinue: () => void;
  loading?: boolean;
};

function money(value: number, currency: string) {
  return `${currency}${Number(value || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function PaymentMethodModal({
  open,
  currency,
  baseAmount,
  cashFee,
  selected,
  onSelect,
  onClose,
  onContinue,
  loading = false,
}: PaymentMethodModalProps) {
  if (!open) {
    return null;
  }

  const finalAmount = selected === "cash" ? baseAmount + cashFee : baseAmount;

  return (
    <div
      className="payment-method-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className="payment-method-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-method-title"
      >
        <header className="payment-method-modal-header">
          <div>
            <span>Pagamento da reserva</span>
            <h3 id="payment-method-title">Como pretendes pagar?</h3>
            <p>Escolhe uma opção para continuar.</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            disabled={loading}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="payment-method-options">
          <button
            type="button"
            className={
              selected === "stripe"
                ? "payment-method-option is-selected"
                : "payment-method-option"
            }
            onClick={() => onSelect("stripe")}
            disabled={loading}
          >
            <div className="payment-method-option-icon is-stripe">
              <CreditCard aria-hidden="true" />
            </div>

            <span>
              <small>Pagar agora</small>
              <strong>Stripe Checkout</strong>
              <p>Cartão e outros métodos suportados pela Stripe.</p>
            </span>

            <strong>{money(baseAmount, currency)}</strong>
          </button>

          <button
            type="button"
            className={
              selected === "cash"
                ? "payment-method-option is-selected"
                : "payment-method-option"
            }
            onClick={() => onSelect("cash")}
            disabled={loading}
          >
            <div className="payment-method-option-icon is-cash">
              <Banknote aria-hidden="true" />
            </div>

            <span>
              <small>Pagar depois</small>
              <strong>Dinheiro na recolha</strong>
              <p>
                Inclui uma taxa administrativa de {money(cashFee, currency)}.
              </p>
            </span>

            <strong>{money(baseAmount + cashFee, currency)}</strong>
          </button>
        </div>

        <div className="payment-method-security">
          <ShieldCheck aria-hidden="true" />

          <span>
            <strong>Pagamento online seguro</strong>
            <small>Os dados do cartão serão tratados pela Stripe.</small>
          </span>
        </div>

        <footer className="payment-method-modal-footer">
          <div>
            <span>Total selecionado</span>
            <strong>{money(finalAmount, currency)}</strong>
          </div>

          <button type="button" onClick={onContinue} disabled={loading}>
            {loading
              ? "A processar..."
              : selected === "stripe"
                ? "Continuar para pagamento"
                : "Confirmar pedido"}
          </button>
        </footer>
      </section>
    </div>
  );
}
