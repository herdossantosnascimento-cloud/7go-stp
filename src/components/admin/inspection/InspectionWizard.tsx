"use client";

import {
  Camera,
  CarFront,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Fuel,
  Gauge,
  PenLine,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState } from "react";

import CarDamageMap, { type DamageZone } from "../CarDamageMap";
import SignaturePad from "../SignaturePad";

type FuelLevel =
  | "empty"
  | "one_eighth"
  | "quarter"
  | "three_eighths"
  | "half"
  | "five_eighths"
  | "three_quarters"
  | "seven_eighths"
  | "full";

type VehicleCondition = "good" | "observations";

type WizardInspection = {
  mileage?: number;
  fuelLevel?: FuelLevel;
  condition?: VehicleCondition;
  notes?: string;

  photoUrls?: string[];

  hasDamage?: boolean;
  damageZones?: DamageZone[];
  damageDescription?: string;
  damageAmount?: number;

  customerSignatureUrl?: string;
  staffSignatureUrl?: string;

  depositReceived?: boolean;
  depositPaymentMethod?: "cash" | "transfer" | "pos";

  completed?: boolean;
};

type InspectionWizardProps = {
  mode: "checkout" | "checkin";

  reference?: string;
  customerName?: string;
  carName?: string;

  inspection: WizardInspection;

  existingDamageZones?: DamageZone[];

  refundableDeposit?: number;
  currency?: string;

  busy?: boolean;

  onUpdate: (values: Partial<WizardInspection>) => void;

  onUploadPhotos: (files: FileList | null) => Promise<void>;

  onDeletePhoto: (photoUrl: string) => Promise<void>;

  onUploadSignature: (role: "customer" | "staff", blob: Blob) => Promise<void>;

  onDeleteSignature: (role: "customer" | "staff") => Promise<void>;

  onFinalize: () => void;

  onClose: () => void;
};

const steps = [
  {
    id: "photos",
    label: "Fotografias",
    icon: Camera,
  },
  {
    id: "fuel",
    label: "Combustível",
    icon: Fuel,
  },
  {
    id: "mileage",
    label: "Quilómetros",
    icon: Gauge,
  },
  {
    id: "damage",
    label: "Danos",
    icon: ShieldAlert,
  },
  {
    id: "signatures",
    label: "Assinaturas",
    icon: PenLine,
  },
  {
    id: "summary",
    label: "Resumo",
    icon: CheckCircle2,
  },
] as const;

const fuelLevels: Array<{
  value: FuelLevel;
  label: string;
  percentage: number;
}> = [
  {
    value: "empty",
    label: "E",
    percentage: 0,
  },
  {
    value: "one_eighth",
    label: "1/8",
    percentage: 12.5,
  },
  {
    value: "quarter",
    label: "1/4",
    percentage: 25,
  },
  {
    value: "three_eighths",
    label: "3/8",
    percentage: 37.5,
  },
  {
    value: "half",
    label: "1/2",
    percentage: 50,
  },
  {
    value: "five_eighths",
    label: "5/8",
    percentage: 62.5,
  },
  {
    value: "three_quarters",
    label: "3/4",
    percentage: 75,
  },
  {
    value: "seven_eighths",
    label: "7/8",
    percentage: 87.5,
  },
  {
    value: "full",
    label: "F",
    percentage: 100,
  },
];

export function InspectionWizard({
  mode,
  reference,
  customerName,
  carName,
  inspection,
  existingDamageZones = [],
  refundableDeposit = 0,
  currency = "€",
  busy = false,
  onUpdate,
  onUploadPhotos,
  onDeletePhoto,
  onUploadSignature,
  onDeleteSignature,
  onFinalize,
  onClose,
}: InspectionWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);

  const step = steps[stepIndex];
  const Icon = step.icon;

  const isCheckin = mode === "checkin";

  const photoUrls = inspection.photoUrls ?? [];

  const fuelLevel = inspection.fuelLevel ?? "full";

  const progress = useMemo(
    () => Math.round(((stepIndex + 1) / steps.length) * 100),
    [stepIndex],
  );

  const checklist = useMemo(
    () => [
      {
        label: "Fotografias",
        ready: photoUrls.length >= 6,
      },
      {
        label: "Combustível",
        ready: Boolean(inspection.fuelLevel),
      },
      {
        label: "Quilómetros",
        ready: inspection.mileage != null,
      },
      {
        label: "Danos",
        ready:
          inspection.hasDamage === false ||
          Boolean(
            inspection.damageDescription ||
            (inspection.damageZones ?? []).length,
          ),
      },
      {
        label: "Assinatura cliente",
        ready: Boolean(inspection.customerSignatureUrl),
      },
      {
        label: "Assinatura funcionário",
        ready: Boolean(inspection.staffSignatureUrl),
      },
    ],
    [inspection, photoUrls.length],
  );

  const completedItems = checklist.filter((item) => item.ready).length;

  const readiness = Math.round((completedItems / checklist.length) * 100);

  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;

  function next() {
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  }

  function previous() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  return (
    <section className="inspection-wizard-shell">
      <header className="inspection-wizard-header">
        <div className="inspection-wizard-header-main">
          <div className="inspection-wizard-brand">
            <CarFront aria-hidden="true" />
          </div>

          <div>
            <span>
              {isCheckin ? "Devolução da viatura" : "Entrega da viatura"}
            </span>

            <h2>{carName || "Viatura"}</h2>

            <p>
              {customerName || "Cliente"}
              {reference ? ` · ${reference}` : ""}
            </p>
          </div>
        </div>

        <button type="button" onClick={onClose} disabled={busy}>
          Fechar
        </button>
      </header>

      <div className="inspection-wizard-progress">
        <div className="inspection-wizard-progress-top">
          <span>
            Passo {stepIndex + 1} de {steps.length}
          </span>

          <strong>{progress}%</strong>
        </div>

        <div className="inspection-wizard-progress-bar">
          <span
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

        <div className="inspection-wizard-steps">
          {steps.map((item, index) => {
            const StepIcon = item.icon;

            const active = index === stepIndex;

            const done = index < stepIndex;

            return (
              <button
                key={item.id}
                type="button"
                className={[
                  "inspection-wizard-step",
                  active ? "is-active" : "",
                  done ? "is-done" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => setStepIndex(index)}
              >
                <i>
                  <StepIcon aria-hidden="true" />
                </i>

                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="inspection-wizard-content">
        <div className="inspection-wizard-step-heading">
          <i>
            <Icon aria-hidden="true" />
          </i>

          <div>
            <span>Passo {stepIndex + 1}</span>

            <h3>{step.label}</h3>
          </div>
        </div>

        {step.id === "photos" && (
          <section className="inspection-wizard-photo-step">
            <div className="inspection-wizard-photo-toolbar">
              <div>
                <strong>Fotografias da viatura</strong>

                <span>{photoUrls.length}/12</span>
              </div>

              <label className="inspection-wizard-photo-upload">
                📷 Adicionar fotografias
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  disabled={busy}
                  onChange={(event) => {
                    void onUploadPhotos(event.target.files);

                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            <div className="inspection-wizard-photo-guide">
              <span>Frente</span>
              <span>Traseira</span>
              <span>Lado esquerdo</span>
              <span>Lado direito</span>
              <span>Interior</span>
              <span>Painel / KM</span>
            </div>

            {photoUrls.length ? (
              <div className="inspection-wizard-photo-grid">
                {photoUrls.map((photoUrl, photoIndex) => (
                  <figure key={photoUrl} className="inspection-wizard-photo">
                    <a href={photoUrl} target="_blank" rel="noreferrer">
                      <img
                        src={photoUrl}
                        alt={`Fotografia ${photoIndex + 1}`}
                      />
                    </a>

                    <figcaption>
                      <span>Foto {photoIndex + 1}</span>

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void onDeletePhoto(photoUrl)}
                      >
                        Eliminar
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <div className="inspection-wizard-photo-empty">
                <strong>Nenhuma fotografia</strong>

                <p>Recomendamos pelo menos seis imagens da viatura.</p>
              </div>
            )}
          </section>
        )}

        {step.id === "fuel" && (
          <section className="inspection-wizard-work-card">
            <div className="inspection-wizard-value-heading">
              <div>
                <span>Nível atual</span>

                <strong>
                  {
                    fuelLevels.find((item) => item.value === fuelLevel)
                      ?.percentage
                  }
                  %
                </strong>
              </div>

              <Fuel aria-hidden="true" />
            </div>

            <div className="inspection-wizard-fuel-grid">
              {fuelLevels.map((level, index) => {
                const currentIndex = fuelLevels.findIndex(
                  (item) => item.value === fuelLevel,
                );

                const filled = index <= currentIndex;

                const selected = fuelLevel === level.value;

                return (
                  <button
                    key={level.value}
                    type="button"
                    disabled={busy}
                    className={[
                      "inspection-wizard-fuel-level",
                      filled ? "is-filled" : "",
                      selected ? "is-selected" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onClick={() =>
                      onUpdate({
                        fuelLevel: level.value,
                      })
                    }
                  >
                    <i
                      style={{
                        height: `${34 + index * 4}px`,
                      }}
                    />

                    <span>{level.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="inspection-wizard-helper">
              Regista exatamente o combustível existente no momento da{" "}
              {isCheckin ? "devolução" : "entrega"}.
            </div>
          </section>
        )}

        {step.id === "mileage" && (
          <section className="inspection-wizard-work-card">
            <label className="inspection-wizard-large-field">
              <span>Quilometragem atual</span>

              <div>
                <input
                  type="number"
                  min="0"
                  value={inspection.mileage ?? ""}
                  disabled={busy}
                  placeholder="82500"
                  onChange={(event) =>
                    onUpdate({
                      mileage:
                        event.target.value === ""
                          ? undefined
                          : Number(event.target.value),
                    })
                  }
                />

                <strong>KM</strong>
              </div>
            </label>

            <div className="inspection-wizard-helper">
              Confirma o valor diretamente no painel da viatura.
            </div>
          </section>
        )}

        {step.id === "damage" && (
          <section className="inspection-wizard-work-card">
            <label className="inspection-wizard-damage-toggle">
              <input
                type="checkbox"
                checked={Boolean(inspection.hasDamage)}
                disabled={busy}
                onChange={(event) =>
                  onUpdate({
                    hasDamage: event.target.checked,
                    damageZones: event.target.checked
                      ? inspection.damageZones
                      : [],
                    damageDescription: event.target.checked
                      ? inspection.damageDescription
                      : "",
                    damageAmount: event.target.checked
                      ? inspection.damageAmount
                      : 0,
                  })
                }
              />

              <span>
                <strong>
                  {isCheckin
                    ? "Foram encontrados novos danos"
                    : "Existem danos antes da entrega"}
                </strong>

                <small>
                  {isCheckin
                    ? "Assinala apenas danos novos encontrados na devolução."
                    : "Regista riscos, mossas e outras marcas já existentes."}
                </small>
              </span>
            </label>

            {inspection.hasDamage ? (
              <>
                <CarDamageMap
                  mode={mode}
                  existingZones={isCheckin ? existingDamageZones : []}
                  selectedZones={inspection.damageZones ?? []}
                  onChange={(damageZones) =>
                    onUpdate({
                      damageZones,
                    })
                  }
                />

                <label className="inspection-wizard-text-field">
                  <span>Descrição</span>

                  <textarea
                    value={inspection.damageDescription ?? ""}
                    disabled={busy}
                    placeholder="Descreve os danos..."
                    onChange={(event) =>
                      onUpdate({
                        damageDescription: event.target.value,
                      })
                    }
                  />
                </label>

                {isCheckin && (
                  <label className="inspection-wizard-text-field">
                    <span>Valor associado</span>

                    <div className="inspection-wizard-money-field">
                      <strong>{currency}</strong>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={busy}
                        value={inspection.damageAmount ?? ""}
                        onChange={(event) =>
                          onUpdate({
                            damageAmount:
                              event.target.value === ""
                                ? undefined
                                : Math.max(0, Number(event.target.value)),
                          })
                        }
                      />
                    </div>
                  </label>
                )}
              </>
            ) : (
              <div className="inspection-wizard-good-condition">
                <CheckCircle2 aria-hidden="true" />

                <div>
                  <strong>Nenhum dano a acrescentar</strong>

                  <span>Podes continuar para as assinaturas.</span>
                </div>
              </div>
            )}
          </section>
        )}

        {step.id === "signatures" && (
          <section className="inspection-wizard-work-card">
            <div className="inspection-wizard-signature-grid">
              <SignaturePad
                title="Assinatura do cliente"
                existingUrl={inspection.customerSignatureUrl}
                disabled={busy}
                onSave={(blob) => onUploadSignature("customer", blob)}
                onDelete={() => onDeleteSignature("customer")}
              />

              <SignaturePad
                title="Assinatura do funcionário"
                existingUrl={inspection.staffSignatureUrl}
                disabled={busy}
                onSave={(blob) => onUploadSignature("staff", blob)}
                onDelete={() => onDeleteSignature("staff")}
              />
            </div>
          </section>
        )}

        {step.id === "summary" && (
          <section className="inspection-wizard-summary">
            <div className="inspection-wizard-summary-score">
              <div>
                <span>Preparação da inspeção</span>

                <strong>
                  {completedItems}/{checklist.length}
                </strong>
              </div>

              <strong>{readiness}%</strong>
            </div>

            <div className="inspection-wizard-summary-bar">
              <span
                style={{
                  width: `${readiness}%`,
                }}
              />
            </div>

            <div className="inspection-wizard-summary-grid">
              {checklist.map((item) => (
                <article
                  key={item.label}
                  className={item.ready ? "is-ready" : ""}
                >
                  <i>{item.ready ? "✓" : "!"}</i>

                  <span>{item.label}</span>
                </article>
              ))}
            </div>

            <div className="inspection-wizard-summary-details">
              <article>
                <span>Quilometragem</span>

                <strong>
                  {inspection.mileage != null
                    ? `${inspection.mileage.toLocaleString("pt-PT")} km`
                    : "Por registar"}
                </strong>
              </article>

              <article>
                <span>Combustível</span>

                <strong>
                  {fuelLevels.find((item) => item.value === fuelLevel)?.label}
                </strong>
              </article>

              <article>
                <span>Fotografias</span>

                <strong>{photoUrls.length}</strong>
              </article>

              <article>
                <span>Danos</span>

                <strong>
                  {inspection.hasDamage
                    ? `${(inspection.damageZones ?? []).length} marcado(s)`
                    : "Não"}
                </strong>
              </article>
            </div>

            {!isCheckin && refundableDeposit > 0 && (
              <div className="inspection-wizard-deposit">
                <div>
                  <span>Caução da viatura</span>

                  <strong>
                    {currency}
                    {Number(refundableDeposit).toFixed(2)}
                  </strong>
                </div>

                <label>
                  <input
                    type="checkbox"
                    checked={Boolean(inspection.depositReceived)}
                    disabled={busy}
                    onChange={(event) =>
                      onUpdate({
                        depositReceived: event.target.checked,
                      })
                    }
                  />
                  Caução recebida
                </label>

                {inspection.depositReceived && (
                  <select
                    value={inspection.depositPaymentMethod ?? ""}
                    disabled={busy}
                    onChange={(event) =>
                      onUpdate({
                        depositPaymentMethod:
                          event.target.value === ""
                            ? undefined
                            : (event.target.value as
                                "cash" | "transfer" | "pos"),
                      })
                    }
                  >
                    <option value="">Método de pagamento</option>
                    <option value="cash">Dinheiro</option>
                    <option value="transfer">Transferência</option>
                    <option value="pos">POS</option>
                  </select>
                )}
              </div>
            )}

            <label className="inspection-wizard-text-field">
              <span>Estado geral</span>

              <select
                value={inspection.condition ?? "good"}
                disabled={busy}
                onChange={(event) =>
                  onUpdate({
                    condition: event.target.value as VehicleCondition,
                  })
                }
              >
                <option value="good">Bom estado</option>
                <option value="observations">Com observações</option>
              </select>
            </label>

            <label className="inspection-wizard-text-field">
              <span>Observações finais</span>

              <textarea
                value={inspection.notes ?? ""}
                disabled={busy}
                placeholder={
                  isCheckin
                    ? "Estado geral na devolução..."
                    : "Notas sobre a entrega..."
                }
                onChange={(event) =>
                  onUpdate({
                    notes: event.target.value,
                  })
                }
              />
            </label>

            <button
              type="button"
              className={
                isCheckin
                  ? "inspection-wizard-final-button is-checkin"
                  : "inspection-wizard-final-button"
              }
              disabled={busy}
              onClick={onFinalize}
            >
              {busy
                ? "A guardar..."
                : inspection.completed
                  ? "✓ ATUALIZAR REGISTO"
                  : isCheckin
                    ? "📥 RECEBER VIATURA"
                    : "🚗 ENTREGAR VIATURA"}
            </button>
          </section>
        )}
      </main>

      <footer className="inspection-wizard-footer">
        <button type="button" onClick={previous} disabled={isFirst || busy}>
          <ChevronLeft aria-hidden="true" />
          Anterior
        </button>

        <div>
          <span>{step.label}</span>

          <strong>
            {stepIndex + 1}/{steps.length}
          </strong>
        </div>

        {!isLast ? (
          <button type="button" onClick={next} disabled={busy}>
            Seguinte
            <ChevronRight aria-hidden="true" />
          </button>
        ) : (
          <button type="button" onClick={onFinalize} disabled={busy}>
            Finalizar
            <CheckCircle2 aria-hidden="true" />
          </button>
        )}
      </footer>
    </section>
  );
}
