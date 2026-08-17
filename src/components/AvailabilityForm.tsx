"use client";

import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  PaymentMethodModal,
  type PaymentChoice,
} from "@/components/payment/PaymentMethodModal";
import type { Car } from "@/data/cars";
import { db, auth } from "@/lib/firebase/client";

type RentalMode = "normal" | "premium";

type AvailabilityLock = {
  carId?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
};

const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;
const MILLISECONDS_PER_DAY = MILLISECONDS_PER_HOUR * 24;

const operatingHours = Array.from({ length: 21 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
});

function createRentalDateTime(date: string, time: string) {
  if (!date || !time) return null;

  const value = new Date(`${date}T${time}:00`);

  return Number.isNaN(value.getTime()) ? null : value;
}

const whatsappNumber = "41796600932";

function createReference() {
  return `7GO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function datesOverlap(
  pickupDate: string,
  pickupTime: string,
  returnDate: string,
  returnTime: string,
  lockedPickupDate: string,
  lockedPickupTime: string,
  lockedReturnDate: string,
  lockedReturnTime: string,
) {
  const pickup = createRentalDateTime(pickupDate, pickupTime);
  const returnAt = createRentalDateTime(returnDate, returnTime);
  const lockedPickup = createRentalDateTime(lockedPickupDate, lockedPickupTime);
  const lockedReturn = createRentalDateTime(lockedReturnDate, lockedReturnTime);

  if (!pickup || !returnAt || !lockedPickup || !lockedReturn) {
    return false;
  }

  return pickup < lockedReturn && returnAt > lockedPickup;
}

export function AvailabilityForm({ car }: { car: Car }) {
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [mode, setMode] = useState<RentalMode>("normal");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>("stripe");

  const bookingDraftKey = `7go-booking-draft-${car.id}`;

  useEffect(() => {
    try {
      const savedDraft = sessionStorage.getItem(bookingDraftKey);

      if (!savedDraft) {
        return;
      }

      const draft = JSON.parse(savedDraft) as {
        pickupDate?: string;
        pickupTime?: string;
        returnDate?: string;
        returnTime?: string;
        mode?: RentalMode;
        name?: string;
        phone?: string;
        email?: string;
        paymentChoice?: PaymentChoice;
      };

      setPickupDate(draft.pickupDate ?? "");
      setPickupTime(draft.pickupTime ?? "");
      setReturnDate(draft.returnDate ?? "");
      setReturnTime(draft.returnTime ?? "");
      setMode(draft.mode ?? "normal");
      setName(draft.name ?? "");
      setPhone(draft.phone ?? "");
      setEmail(draft.email ?? "");
      setPaymentChoice(draft.paymentChoice ?? "stripe");
    } catch (error) {
      console.error("ERRO AO RESTAURAR RESERVA:", error);
      sessionStorage.removeItem(bookingDraftKey);
    }
  }, [bookingDraftKey]);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        return;
      }

      try {
        const savedDraft = sessionStorage.getItem(bookingDraftKey);

        const draft = savedDraft
          ? (JSON.parse(savedDraft) as {
              name?: string;
              phone?: string;
              email?: string;
            })
          : null;

        const profileSnapshot = await getDoc(doc(db, "users", currentUser.uid));

        const profile = profileSnapshot.exists()
          ? (profileSnapshot.data() as {
              name?: string;
              phone?: string;
              email?: string;
            })
          : {};

        if (!draft?.name) {
          setName(profile.name || currentUser.displayName || "");
        }

        if (!draft?.phone) {
          setPhone(profile.phone || "");
        }

        if (!draft?.email) {
          setEmail(profile.email || currentUser.email || "");
        }
      } catch (error) {
        console.error("ERRO AO CARREGAR PERFIL NA RESERVA:", error);
      }
    });
  }, [bookingDraftKey]);

  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [availabilityState, setAvailabilityState] = useState<
    "idle" | "available" | "unavailable"
  >("idle");

  const rentalPeriod = useMemo(() => {
    const pickupAt = createRentalDateTime(pickupDate, pickupTime);
    const returnAt = createRentalDateTime(returnDate, returnTime);

    if (!pickupAt || !returnAt) {
      return {
        pickupAt: null,
        returnAt: null,
        rentalHours: 0,
        totalDays: 0,
      };
    }

    const difference = returnAt.getTime() - pickupAt.getTime();

    if (difference <= 0) {
      return {
        pickupAt,
        returnAt,
        rentalHours: 0,
        totalDays: 0,
      };
    }

    return {
      pickupAt,
      returnAt,
      rentalHours: Math.ceil(difference / MILLISECONDS_PER_HOUR),
      totalDays: Math.ceil(difference / MILLISECONDS_PER_DAY),
    };
  }, [pickupDate, pickupTime, returnDate, returnTime]);

  const { pickupAt, returnAt, rentalHours, totalDays } = rentalPeriod;

  const premiumPricePerDay = car.premiumPricePerDay ?? 0;
  const normalExcess = car.normalExcess ?? 0;
  const refundableDeposit = car.refundableDeposit ?? 0;
  const dailyRate =
    car.pricePerDay + (mode === "premium" ? premiumPricePerDay : 0);
  const estimatedTotal = totalDays * dailyRate;
  const cashPayLaterFee = 5;
  const bookingCurrency = "€";
  const bookingCurrencyCode = "EUR";
  const appliedExcess = mode === "premium" ? 0 : normalExcess;
  const modeLabel = mode === "premium" ? "7Go Premium" : "Aluguer normal";

  const today = new Date().toISOString().split("T")[0];
  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const phoneDigits = cleanPhone.replace(/[^0-9]/g, "");

  const nameValid = cleanName.length >= 3;
  const phoneValid = phoneDigits.length >= 7;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pickupValid = Boolean(
    pickupDate &&
    pickupTime &&
    pickupAt &&
    pickupDate >= today &&
    pickupAt.getTime() > Date.now(),
  );

  const returnValid = Boolean(
    returnDate &&
    returnTime &&
    pickupAt &&
    returnAt &&
    returnAt.getTime() > pickupAt.getTime(),
  );

  const basicFieldsValid = Boolean(
    nameValid &&
    emailValid &&
    phoneValid &&
    pickupValid &&
    returnValid &&
    totalDays > 0,
  );

  const canSubmit = basicFieldsValid && availabilityState === "available";

  const message = `Olá 7Go STP, quero verificar disponibilidade.

Carro: ${car.brand} ${car.model}
Ano: ${car.year}
Levantamento: ${
    pickupDate && pickupTime
      ? `${pickupDate} às ${pickupTime}`
      : "por confirmar"
  }
Devolução: ${
    returnDate && returnTime
      ? `${returnDate} às ${returnTime}`
      : "por confirmar"
  }
Duração estimada: ${rentalHours ? `${rentalHours} hora(s)` : "por confirmar"}
Dias cobrados: ${totalDays || "por confirmar"}
Modalidade: ${modeLabel}
Preço base por dia: ${bookingCurrency}${car.pricePerDay}
Extra Premium por dia: ${
    mode === "premium"
      ? `${bookingCurrency}${premiumPricePerDay}`
      : "Não aplicado"
  }
Preço final por dia: ${bookingCurrency}${dailyRate}
Franquia: ${bookingCurrency}${appliedExcess}
Caução reembolsável: ${bookingCurrency}${refundableDeposit}
Total estimado: ${
    totalDays ? `${bookingCurrency}${estimatedTotal}` : "por confirmar"
  }

Nome: ${name || "por confirmar"}
Contacto: ${phone || "por confirmar"}
Email: ${email || "por confirmar"}`;

  async function checkAvailability() {
    if (
      !pickupDate ||
      !pickupTime ||
      !returnDate ||
      !returnTime ||
      !pickupAt ||
      !returnAt ||
      totalDays <= 0
    ) {
      setAvailabilityState("unavailable");
      setAvailabilityMessage(
        "Escolhe datas e horas de levantamento e devolução válidas.",
      );
      return false;
    }

    const snapshot = await getDocs(
      query(collection(db, "availabilityLocks"), where("carId", "==", car.id)),
    );

    const locks = snapshot.docs.map((item) => item.data() as AvailabilityLock);

    const blocked = locks.some((lock) => {
      if (!lock.pickupDate || !lock.returnDate) return false;

      return datesOverlap(
        pickupDate,
        pickupTime,
        returnDate,
        returnTime,
        lock.pickupDate,
        lock.pickupTime || "00:00",
        lock.returnDate,
        lock.returnTime || "23:59",
      );
    });

    if (blocked) {
      setAvailabilityState("unavailable");
      setAvailabilityMessage(
        "Este carro já está reservado nesse período. Escolhe outras datas ou horas.",
      );
      return false;
    }

    setAvailabilityState("available");
    setAvailabilityMessage(
      "Datas disponíveis para pedido. A equipa 7Go fará a confirmação final.",
    );

    return true;
  }

  async function handlePickupDate(value: string) {
    setPickupDate(value);
    setAvailabilityState("idle");
    setAvailabilityMessage("");
  }

  async function handlePickupTime(value: string) {
    setPickupTime(value);
    setAvailabilityState("idle");
    setAvailabilityMessage("");
  }

  async function handleReturnDate(value: string) {
    setReturnDate(value);
    setAvailabilityState("idle");
    setAvailabilityMessage("");
  }

  async function handleReturnTime(value: string) {
    setReturnTime(value);
    setAvailabilityState("idle");
    setAvailabilityMessage("");
  }

  async function submitBooking() {
    if (!basicFieldsValid || isSubmitting) {
      alert("Preenche corretamente todos os campos obrigatórios.");
      return;
    }

    if (availabilityState !== "available") {
      alert("Verifica primeiro a disponibilidade das datas.");
      return;
    }

    setIsSubmitting(true);

    try {
      const available = await checkAvailability();

      if (!available) {
        return;
      }

      const reference = createReference();

      const customerResponse = await fetch("/api/customers/upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          phone,
        }),
      });

      const customerResult = (await customerResponse.json()) as {
        customerId?: string;
        error?: string;
      };

      if (!customerResponse.ok || !customerResult.customerId) {
        throw new Error(
          customerResult.error || "Não foi possível criar o perfil do cliente.",
        );
      }

      const customerId = customerResult.customerId;
      const isStripePayment = paymentChoice === "stripe";

      const paymentMethod = isStripePayment ? "stripe" : "cash";
      const paymentChoiceValue = isStripePayment ? "pay_now" : "pay_later";

      const payLaterFee = isStripePayment ? 0 : cashPayLaterFee;
      const finalAmount = estimatedTotal + payLaterFee;

      const reservationStatus = isStripePayment ? "pending_payment" : "pending";

      const bookingData = {
        reference,
        status: reservationStatus,

        carId: car.id,
        carBrand: car.brand,
        carModel: car.model,
        carYear: car.year,
        carRegistrationPlate: car.registrationPlate ?? "",
        carVehicleColor: car.vehicleColor ?? "",
        carVin: car.vin ?? "",
        carInsurer: car.insurer ?? "",
        carInsurancePolicyNumber: car.insurancePolicyNumber ?? "",
        carInsuranceExpiry: car.insuranceExpiry ?? "",

        pickupDate,
        pickupTime,
        pickupAt,
        returnDate,
        returnTime,
        returnAt,
        rentalHours,
        totalDays,

        rentalMode: mode,
        rentalModeLabel: modeLabel,

        pricePerDay: car.pricePerDay,
        premiumPricePerDay,
        dailyRate,

        normalExcess,
        appliedExcess,
        refundableDeposit,

        baseAmount: estimatedTotal,
        payLaterFee,
        finalAmount,
        estimatedTotal: finalAmount,

        currency: bookingCurrency,
        currencyCode: bookingCurrencyCode,

        customerId,
        authUid: auth.currentUser?.uid ?? "",
        customerName: name,
        customerPhone: phone,
        customerEmail: email,

        paymentChoice: paymentChoiceValue,
        paymentMethod,
        paymentStatus: "pending",

        message,
        createdAt: serverTimestamp(),
      };

      const bookingDocument = await addDoc(
        collection(db, "bookings"),
        bookingData,
      );

      await setDoc(doc(db, "bookingStatus", reference), {
        reference,
        status: reservationStatus,

        carId: car.id,
        carBrand: car.brand,
        carModel: car.model,

        pickupDate,
        pickupTime,
        returnDate,
        returnTime,
        totalDays,

        rentalModeLabel: modeLabel,
        pricePerDay: car.pricePerDay,
        premiumPricePerDay,
        dailyRate,
        normalExcess,
        appliedExcess,
        refundableDeposit,
        estimatedTotal: finalAmount,

        currency: bookingCurrency,
        paymentStatus: "pending",
        depositStatus: "pending",
      });

      if (isStripePayment) {
        const checkoutResponse = await fetch("/api/payments/create-checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            bookingId: bookingDocument.id,
          }),
        });

        const checkoutResult = (await checkoutResponse.json()) as {
          url?: string;
          error?: string;
        };

        if (!checkoutResponse.ok || !checkoutResult.url) {
          throw new Error(
            checkoutResult.error ||
              "Não foi possível abrir o pagamento Stripe.",
          );
        }

        sessionStorage.removeItem(bookingDraftKey);

        window.location.href = checkoutResult.url;
        return;
      }

      const cashMessage = `${message}

Método de pagamento: Dinheiro na recolha
Valor base: ${bookingCurrency}${estimatedTotal}
Taxa de pagamento posterior: ${bookingCurrency}${cashPayLaterFee}
Total final: ${bookingCurrency}${finalAmount}

Referência da reserva: ${reference}`;

      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        cashMessage,
      )}`;

      window.open(whatsappUrl, "_blank", "noopener,noreferrer");

      sessionStorage.removeItem(bookingDraftKey);

      window.location.href = `/reserva/sucesso?ref=${encodeURIComponent(
        reference,
      )}&payment=cash`;
    } catch (error) {
      console.error("ERRO AO CRIAR RESERVA:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível enviar o pedido: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  function openPaymentModal() {
    if (!canSubmit || isSubmitting) {
      return;
    }

    if (!auth.currentUser) {
      const returnTo = window.location.pathname + window.location.search;

      sessionStorage.setItem(
        bookingDraftKey,
        JSON.stringify({
          pickupDate,
          pickupTime,
          returnDate,
          returnTime,
          mode,
          name,
          phone,
          email,
          paymentChoice,
        }),
      );

      window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;

      return;
    }

    setPaymentModalOpen(true);
  }

  function continueWithPaymentChoice() {
    setPaymentModalOpen(false);
    void submitBooking();
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    alert("Mensagem copiada.");
  }

  return (
    <div className="availability-box">
      <div className="availability-ui-header">
        <div>
          <span className="availability-ui-eyebrow">Reserva 7Go</span>

          <h2>Pedido de disponibilidade</h2>

          <p>Preenche os dados e verifica as datas para este carro.</p>
        </div>

        <span className="availability-ui-status">Pedido online</span>
      </div>

      <div className="availability-ui-section">
        <div className="availability-ui-section-heading">
          <span>01</span>

          <div>
            <strong>Dados do pedido</strong>
            <small>Cliente e período do aluguer</small>
          </div>
        </div>

        <div className="availability-fields">
          <label>
            Nome
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="O teu nome"
              required
              minLength={3}
              aria-required="true"
            />
            {!nameValid && name.length > 0 && (
              <small className="field-error">Introduz o nome completo.</small>
            )}
          </label>

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@email.com"
              required
              aria-required="true"
            />
            {!emailValid && email.length > 0 && (
              <small className="field-error">Introduz um email válido.</small>
            )}
          </label>

          <label>
            Contacto
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex.: +239 990 00 00"
              required
              inputMode="tel"
              aria-required="true"
            />
            {!phoneValid && phone.length > 0 && (
              <small className="field-error">
                Introduz um contacto válido.
              </small>
            )}
          </label>

          <label>
            Data de levantamento
            <input
              type="date"
              min={today}
              value={pickupDate}
              onChange={(e) => handlePickupDate(e.target.value)}
              required
              aria-required="true"
            />
          </label>

          <label>
            Hora de levantamento
            <select
              value={pickupTime}
              onChange={(e) => handlePickupTime(e.target.value)}
              required
              aria-required="true"
            >
              <option value="">Escolher hora</option>
              {operatingHours.map((time) => (
                <option key={`pickup-${time}`} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </label>

          <label>
            Data de devolução
            <input
              type="date"
              min={pickupDate || today}
              value={returnDate}
              onChange={(e) => handleReturnDate(e.target.value)}
              required
              aria-required="true"
            />
          </label>

          <label>
            Hora de devolução
            <select
              value={returnTime}
              onChange={(e) => handleReturnTime(e.target.value)}
              required
              aria-required="true"
            >
              <option value="">Escolher hora</option>
              {operatingHours.map((time) => (
                <option key={`return-${time}`} value={time}>
                  {time}
                </option>
              ))}
            </select>
            {returnDate && returnTime && !returnValid && (
              <small className="field-error">
                A devolução deve acontecer depois do levantamento.
              </small>
            )}
          </label>
        </div>
      </div>

      <div className="availability-ui-section">
        <div className="availability-ui-section-heading">
          <span>02</span>

          <div>
            <strong>Modalidade</strong>
            <small>Escolhe como queres viajar</small>
          </div>
        </div>

        <div className="availability-mode-field">
          <label>
            Modalidade
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as RentalMode)}
              required
              aria-required="true"
            >
              <option value="normal">Aluguer normal</option>
              <option value="premium">7Go Premium — franquia 0</option>
            </select>
          </label>

          <div className={`rental-protection rental-protection-${mode}`}>
            <div className="rental-protection-top">
              <span>
                {mode === "premium" ? "7Go Premium" : "Aluguer normal"}
              </span>

              <strong>
                Franquia{" "}
                {mode === "premium"
                  ? `${bookingCurrency}0`
                  : `${bookingCurrency}${normalExcess}`}
              </strong>
            </div>

            <p>
              {mode === "premium"
                ? `Acrescenta ${bookingCurrency}${premiumPricePerDay} por dia. Em caso de dano coberto pelas condições 7Go Premium, não pagas franquia.`
                : "Em caso de dano coberto, a responsabilidade fica limitada ao valor da franquia indicada."}
            </p>
          </div>
        </div>
      </div>

      <div className="availability-ui-section availability-ui-summary-section">
        <div className="availability-ui-section-heading">
          <span>03</span>

          <div>
            <strong>Resumo do aluguer</strong>
            <small>Valores calculados para este pedido</small>
          </div>
        </div>

        <div className="booking-summary">
          <div>
            <span>Dias</span>
            <strong>{totalDays || "-"}</strong>
          </div>

          <div>
            <span>Preço final/dia</span>
            <strong>
              {bookingCurrency}
              {dailyRate}
            </strong>
          </div>

          <div>
            <span>Total estimado</span>
            <strong>
              {totalDays ? `${bookingCurrency}${estimatedTotal}` : "-"}
            </strong>
          </div>

          <div>
            <span>Franquia</span>
            <strong>
              {mode === "premium"
                ? `${bookingCurrency}0`
                : `${bookingCurrency}${normalExcess}`}
            </strong>
          </div>

          <div>
            <span>Caução reembolsável</span>
            <strong>
              {bookingCurrency}
              {refundableDeposit}
            </strong>
          </div>
        </div>
      </div>

      <div className="availability-ui-action-zone">
        {pickupDate &&
          pickupTime &&
          returnDate &&
          returnTime &&
          totalDays > 0 && (
            <button
              type="button"
              className="check-availability-button"
              onClick={checkAvailability}
              disabled={isSubmitting}
            >
              Verificar este período
            </button>
          )}

        {availabilityMessage && (
          <div
            className={`availability-result availability-result-${availabilityState}`}
          >
            {availabilityMessage}
          </div>
        )}

        <div className="availability-actions">
          <button
            type="button"
            disabled={!canSubmit || isSubmitting}
            onClick={openPaymentModal}
          >
            {isSubmitting
              ? "A verificar e enviar..."
              : "Continuar para pagamento"}
          </button>

          <button type="button" onClick={copyMessage}>
            Copiar mensagem
          </button>
        </div>

        {!basicFieldsValid && (
          <p className="form-warning">
            * Todos os campos são obrigatórios. Preenche os dados, datas e horas
            válidas.
          </p>
        )}

        {basicFieldsValid && availabilityState === "idle" && (
          <p className="form-warning">
            Verifica a disponibilidade do período antes de enviar o pedido.
          </p>
        )}

        <p className="availability-ui-legal-note">
          Este pedido ainda não confirma a reserva. A equipa 7Go irá validar
          carro, datas, caução e entrega.
        </p>
      </div>

      <PaymentMethodModal
        open={paymentModalOpen}
        currency={bookingCurrency}
        baseAmount={estimatedTotal}
        cashFee={cashPayLaterFee}
        selected={paymentChoice}
        onSelect={setPaymentChoice}
        onClose={() => setPaymentModalOpen(false)}
        onContinue={continueWithPaymentChoice}
        loading={isSubmitting}
      />
    </div>
  );
}
