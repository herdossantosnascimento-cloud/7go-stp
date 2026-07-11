"use client";

import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { useMemo, useState } from "react";
import type { Car } from "@/data/cars";
import { db } from "@/lib/firebase/client";

type RentalMode = "normal" | "premium";

type AvailabilityLock = {
  carId?: string;
  pickupDate?: string;
  returnDate?: string;
};

const whatsappNumber = "41796600932";

function createReference() {
  return `7GO-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function datesOverlap(
  pickupDate: string,
  returnDate: string,
  lockedPickup: string,
  lockedReturn: string,
) {
  return pickupDate < lockedReturn && returnDate > lockedPickup;
}

export function AvailabilityForm({ car }: { car: Car }) {
  const [pickupDate, setPickupDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [mode, setMode] = useState<RentalMode>("normal");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [availabilityState, setAvailabilityState] = useState<
    "idle" | "available" | "unavailable"
  >("idle");

  const totalDays = useMemo(() => {
    if (!pickupDate || !returnDate) return 0;

    const start = new Date(`${pickupDate}T00:00:00`);
    const end = new Date(`${returnDate}T00:00:00`);
    const diff = end.getTime() - start.getTime();

    if (diff <= 0) return 0;

    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }, [pickupDate, returnDate]);

  const premiumPricePerDay = car.premiumPricePerDay ?? 0;
  const normalExcess = car.normalExcess ?? 0;
  const refundableDeposit = car.refundableDeposit ?? 0;
  const dailyRate =
    car.pricePerDay + (mode === "premium" ? premiumPricePerDay : 0);
  const estimatedTotal = totalDays * dailyRate;
  const appliedExcess = mode === "premium" ? 0 : normalExcess;
  const modeLabel = mode === "premium" ? "7Go Premium" : "Aluguer normal";

  const today = new Date().toISOString().split("T")[0];
  const cleanName = name.trim();
  const cleanPhone = phone.trim();
  const phoneDigits = cleanPhone.replace(/[^0-9]/g, "");

  const nameValid = cleanName.length >= 3;
  const phoneValid = phoneDigits.length >= 7;
  const emailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const pickupValid = Boolean(pickupDate && pickupDate >= today);
  const returnValid = Boolean(
    returnDate &&
    pickupDate &&
    returnDate > pickupDate,
  );

  const basicFieldsValid = Boolean(
    nameValid &&
    emailValid &&
    phoneValid &&
    pickupValid &&
    returnValid &&
    totalDays > 0,
  );

  const canSubmit =
    basicFieldsValid && availabilityState === "available";

  const message = `Olá 7Go STP, quero verificar disponibilidade.

Carro: ${car.brand} ${car.model}
Ano: ${car.year}
Levantamento: ${pickupDate || "por confirmar"}
Devolução: ${returnDate || "por confirmar"}
Dias: ${totalDays || "por confirmar"}
Modalidade: ${modeLabel}
Preço base por dia: ${car.currency}${car.pricePerDay}
Extra Premium por dia: ${
  mode === "premium" ? `${car.currency}${premiumPricePerDay}` : "Não aplicado"
}
Preço final por dia: ${car.currency}${dailyRate}
Franquia: ${car.currency}${appliedExcess}
Caução reembolsável: ${car.currency}${refundableDeposit}
Total estimado: ${
    totalDays ? `${car.currency}${estimatedTotal}` : "por confirmar"
  }

Nome: ${name || "por confirmar"}
Contacto: ${phone || "por confirmar"}
Email: ${email || "por confirmar"}`;

  async function checkAvailability() {
    if (!pickupDate || !returnDate || totalDays <= 0) {
      setAvailabilityState("unavailable");
      setAvailabilityMessage(
        "Escolhe uma data de levantamento e uma data de devolução válidas.",
      );
      return false;
    }

    const snapshot = await getDocs(
      query(
        collection(db, "availabilityLocks"),
        where("carId", "==", car.id),
      ),
    );

    const locks = snapshot.docs.map(
      (item) => item.data() as AvailabilityLock,
    );

    const blocked = locks.some((lock) => {
      if (!lock.pickupDate || !lock.returnDate) return false;

      return datesOverlap(
        pickupDate,
        returnDate,
        lock.pickupDate,
        lock.returnDate,
      );
    });

    if (blocked) {
      setAvailabilityState("unavailable");
      setAvailabilityMessage(
        "Este carro já está reservado nessas datas. Escolhe outras datas.",
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

  async function handleReturnDate(value: string) {
    setReturnDate(value);
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

      if (!available) return;

      const reference = createReference();

      await addDoc(collection(db, "bookings"), {
        reference,
        status: "pending",
        carId: car.id,
        carBrand: car.brand,
        carModel: car.model,
        carYear: car.year,
        carRegistrationPlate: car.registrationPlate ?? "",
        carVehicleColor: car.vehicleColor ?? "",
        carVin: car.vin ?? "",
        carInsurer: car.insurer ?? "",
        carInsurancePolicyNumber:
          car.insurancePolicyNumber ?? "",
        carInsuranceExpiry: car.insuranceExpiry ?? "",
        pickupDate,
        returnDate,
        totalDays,
        rentalMode: mode,
        rentalModeLabel: modeLabel,
        pricePerDay: car.pricePerDay,
        premiumPricePerDay,
        dailyRate,
        normalExcess,
        appliedExcess,
        refundableDeposit,
        estimatedTotal,
        currency: car.currency,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        message,
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, "bookingStatus", reference), {
        reference,
        status: "pending",
        carId: car.id,
        carBrand: car.brand,
        carModel: car.model,
        carYear: car.year,
        carRegistrationPlate: car.registrationPlate ?? "",
        carVehicleColor: car.vehicleColor ?? "",
        carVin: car.vin ?? "",
        carInsurer: car.insurer ?? "",
        carInsurancePolicyNumber:
          car.insurancePolicyNumber ?? "",
        carInsuranceExpiry: car.insuranceExpiry ?? "",
        pickupDate,
        returnDate,
        totalDays,
        rentalModeLabel: modeLabel,
        pricePerDay: car.pricePerDay,
        premiumPricePerDay,
        dailyRate,
        normalExcess,
        appliedExcess,
        refundableDeposit,
        estimatedTotal,
        currency: car.currency,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        createdAt: serverTimestamp(),
      });

      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
        `${message}

Referência da reserva: ${reference}`,
      )}`;

      window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      window.location.href = `/reserva/sucesso?ref=${reference}`;
    } catch (error) {
      console.error("ERRO AO CRIAR RESERVA:", error);

      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível enviar o pedido: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyMessage() {
    await navigator.clipboard.writeText(message);
    alert("Mensagem copiada.");
  }

  return (
    <div className="availability-box">
      <div className="availability-ui-header">
        <div>
          <span className="availability-ui-eyebrow">
            Reserva 7Go
          </span>

          <h2>Pedido de disponibilidade</h2>

          <p>
            Preenche os dados e verifica as datas para este carro.
          </p>
        </div>

        <span className="availability-ui-status">
          Pedido online
        </span>
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
            <small className="field-error">
              Introduz o nome completo.
            </small>
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
            <small className="field-error">
              Introduz um email válido.
            </small>
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
          Data de devolução
          <input
            type="date"
            min={pickupDate || today}
            value={returnDate}
            onChange={(e) => handleReturnDate(e.target.value)}
            required
            aria-required="true"
          />
          {returnDate && !returnValid && (
            <small className="field-error">
              A devolução deve ser depois do levantamento.
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

          <div
            className={`rental-protection rental-protection-${mode}`}
          >
            <div className="rental-protection-top">
              <span>
                {mode === "premium" ? "7Go Premium" : "Aluguer normal"}
              </span>

              <strong>
                Franquia{" "}
                {mode === "premium"
                  ? `${car.currency}0`
                  : `${car.currency}${normalExcess}`}
              </strong>
            </div>

            <p>
              {mode === "premium"
                ? `Acrescenta ${car.currency}${premiumPricePerDay} por dia. Em caso de dano coberto pelas condições 7Go Premium, não pagas franquia.`
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
            {car.currency}
            {dailyRate}
          </strong>
        </div>

        <div>
          <span>Total estimado</span>
          <strong>
            {totalDays ? `${car.currency}${estimatedTotal}` : "-"}
          </strong>
        </div>

        <div>
          <span>Franquia</span>
          <strong>
            {mode === "premium"
              ? `${car.currency}0`
              : `${car.currency}${normalExcess}`}
          </strong>
        </div>

        <div>
          <span>Caução reembolsável</span>
          <strong>
            {car.currency}
            {refundableDeposit}
          </strong>
        </div>
        </div>
      </div>

      <div className="availability-ui-action-zone">
      {pickupDate && returnDate && totalDays > 0 && (
        <button
          type="button"
          className="check-availability-button"
          onClick={checkAvailability}
          disabled={isSubmitting}
        >
          Verificar estas datas
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
          onClick={submitBooking}
        >
          {isSubmitting ? "A verificar e enviar..." : "Confirmar disponibilidade"}
        </button>

        <button type="button" onClick={copyMessage}>
          Copiar mensagem
        </button>
      </div>

      {!basicFieldsValid && (
        <p className="form-warning">
          * Todos os campos são obrigatórios. Preenche nome, contacto e datas válidas.
        </p>
      )}

      {basicFieldsValid && availabilityState === "idle" && (
        <p className="form-warning">
          Verifica a disponibilidade das datas antes de enviar o pedido.
        </p>
      )}

      <p className="availability-ui-legal-note">
        Este pedido ainda não confirma a reserva. A equipa 7Go irá validar
        carro, datas, caução e entrega.
      </p>
      </div>
    </div>
  );
}
