"use client";

import { createPortal } from "react-dom";

import { useState } from "react";
import SignaturePad from "./SignaturePad";
import { InspectionWizard } from "@/components/admin/inspection";
import CarDamageMap, { type DamageZone } from "./CarDamageMap";
import styles from "./AdminInspectionPanel.module.css";

type BookingStatus =
  "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

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

export type AdminVehicleInspection = {
  registrationPlate?: string;
  mileage?: number;
  fuelLevel?: FuelLevel;
  condition?: VehicleCondition;
  notes?: string;
  photoUrls?: string[];

  inspectionPhotos?: {
    front?: string;
    rear?: string;
    left?: string;
    right?: string;
    interior?: string;
    dashboard?: string;
  };

  customerSignatureUrl?: string;
  customerSignedAt?: string;
  staffSignatureUrl?: string;
  staffSignedAt?: string;
  hasDamage?: boolean;
  damageDescription?: string;
  damageAmount?: number;
  damageZones?: DamageZone[];
  fuelCharge?: number;
  cleaningRequired?: boolean;
  cleaningNotes?: string;
  cleaningAmount?: number;
  depositReceived?: boolean;
  depositPaymentMethod?: "cash" | "transfer" | "pos";
  depositAmount?: number;
  depositRefundAmount?: number;
  depositRetainedAmount?: number;
  additionalAmountDue?: number;
  completed?: boolean;
};

type InspectionBookingBase = {
  id: string;
  currency?: string;
  refundableDeposit?: number;
  checkout?: AdminVehicleInspection;
  checkin?: AdminVehicleInspection;
};

type InspectionType = "checkout" | "checkin";

type InspectionWizardBooking = {
  reference?: string;
  customerName?: string;
  carBrand?: string;
  carModel?: string;
};

type AdminInspectionPanelProps<T extends InspectionBookingBase> = {
  booking: T;
  status: BookingStatus;
  updatingId: string;
  getInspectionDraft: (
    booking: T,
    type: InspectionType,
  ) => AdminVehicleInspection;
  updateInspectionDraft: (
    booking: T,
    type: InspectionType,
    values: Partial<AdminVehicleInspection>,
  ) => void;
  uploadInspectionPhotos: (
    booking: T,
    type: InspectionType,
    files: FileList | null,
  ) => Promise<void>;
  deleteInspectionPhoto: (
    booking: T,
    type: InspectionType,
    photoUrl: string,
  ) => Promise<void>;
  uploadInspectionSignature: (
    booking: T,
    type: InspectionType,
    signer: "customer" | "staff",
    signatureBlob: Blob,
  ) => Promise<void>;
  deleteInspectionSignature: (
    booking: T,
    type: InspectionType,
    signer: "customer" | "staff",
  ) => Promise<void>;
  saveInspection: (booking: T, type: InspectionType) => Promise<void>;
};

const fuelLevelLabel: Record<FuelLevel, string> = {
  empty: "Vazio",
  one_eighth: "1/8",
  quarter: "1/4",
  three_eighths: "3/8",
  half: "1/2",
  five_eighths: "5/8",
  three_quarters: "3/4",
  seven_eighths: "7/8",
  full: "Cheio",
};

const fuelGaugeLevels: Array<{
  value: FuelLevel;
  label: string;
  percentage: number;
}> = [
  { value: "empty", label: "E", percentage: 0 },
  { value: "one_eighth", label: "1/8", percentage: 12.5 },
  { value: "quarter", label: "1/4", percentage: 25 },
  { value: "three_eighths", label: "3/8", percentage: 37.5 },
  { value: "half", label: "1/2", percentage: 50 },
  { value: "five_eighths", label: "5/8", percentage: 62.5 },
  { value: "three_quarters", label: "3/4", percentage: 75 },
  { value: "seven_eighths", label: "7/8", percentage: 87.5 },
  { value: "full", label: "F", percentage: 100 },
];

const vehicleConditionLabel: Record<VehicleCondition, string> = {
  good: "Bom estado",
  observations: "Com observações",
};

export default function AdminInspectionPanel<T extends InspectionBookingBase>({
  booking,
  status,
  updatingId,
  getInspectionDraft,
  updateInspectionDraft,
  uploadInspectionPhotos,
  deleteInspectionPhoto,
  uploadInspectionSignature,
  deleteInspectionSignature,
  saveInspection,
}: AdminInspectionPanelProps<T>) {
  const [wizardOpen, setWizardOpen] = useState<{
    type: InspectionType;
  } | null>(null);
  function validateInspectionBeforeSave(
    type: InspectionType,
    inspection: AdminVehicleInspection,
  ) {
    const warnings: string[] = [];

    if (inspection.mileage == null) {
      warnings.push("Falta registar a quilometragem.");
    }

    if (!inspection.fuelLevel) {
      warnings.push("Falta indicar o nível de combustível.");
    }

    const photoCount = (inspection.photoUrls ?? []).length;

    if (photoCount < 6) {
      warnings.push(
        `Existem apenas ${photoCount} fotografia(s). Recomendamos pelo menos 6.`,
      );
    }

    if (!inspection.customerSignatureUrl) {
      warnings.push("Falta a assinatura do cliente.");
    }

    if (!inspection.staffSignatureUrl) {
      warnings.push("Falta a assinatura do funcionário.");
    }

    if (
      type === "checkout" &&
      Number(booking.refundableDeposit || 0) > 0 &&
      !inspection.depositReceived
    ) {
      warnings.push("A caução ainda não está marcada como recebida.");
    }

    if (warnings.length === 0) {
      return true;
    }

    const message =
      `Antes de finalizar:\n\n` +
      warnings.map((warning) => `• ${warning}`).join("\n") +
      `\n\nPretendes continuar mesmo assim?`;

    return window.confirm(message);
  }

  function openInspectionWizard(type: InspectionType) {
    const current = getInspectionDraft(booking, type);

    // Garante que existe um draft estável
    // enquanto o Wizard está aberto.
    updateInspectionDraft(booking, type, { ...current });

    setWizardOpen({ type });
  }

  function handleInspectionSave(
    type: InspectionType,
    inspection: AdminVehicleInspection,
  ) {
    if (!validateInspectionBeforeSave(type, inspection)) {
      return;
    }

    void saveInspection(booking, type);
  }
  return (
    <div className={`admin-vehicle-inspections ${styles.inspections}`}>
      {(["checkout", "checkin"] as const)
        .filter(
          (type) =>
            type === "checkout" ||
            Boolean(booking.checkout?.completed) ||
            status === "in_progress" ||
            status === "completed",
        )
        .map((type) => {
          const inspection = getInspectionDraft(booking, type);
          const isCheckin = type === "checkin";

          const wizardBooking = booking as T & InspectionWizardBooking;

          return (
            <details
              key={type}
              className={`admin-inspection-panel ${styles.panel}`}
            >
              <summary className={styles.summary}>
                <span>
                  {isCheckin ? "Devolução do carro" : "Entrega do carro"}
                </span>

                <small>
                  {inspection.completed ? "Registada" : "Por registar"}
                </small>
              </summary>

              <div className={`admin-vehicle-inspection ${styles.body}`}>
                <button
                  type="button"
                  className="admin-open-inspection-wizard"
                  onClick={() => openInspectionWizard(type)}
                >
                  {isCheckin
                    ? "📥 Iniciar devolução guiada"
                    : "🚗 Iniciar entrega guiada"}
                </button>
                {(() => {
                  const progressItems = [
                    {
                      label: "Quilómetros",
                      ready: inspection.mileage != null,
                    },
                    {
                      label: "Combustível",
                      ready: Boolean(inspection.fuelLevel),
                    },
                    {
                      label: "Fotografias",
                      ready: (inspection.photoUrls ?? []).length >= 6,
                    },
                    {
                      label: "Assinatura cliente",
                      ready: Boolean(inspection.customerSignatureUrl),
                    },
                    {
                      label: "Assinatura funcionário",
                      ready: Boolean(inspection.staffSignatureUrl),
                    },
                    ...(!isCheckin && Number(booking.refundableDeposit || 0) > 0
                      ? [
                          {
                            label: "Caução",
                            ready: Boolean(inspection.depositReceived),
                          },
                        ]
                      : []),
                  ];

                  const completedItems = progressItems.filter(
                    (item) => item.ready,
                  ).length;

                  const percentage =
                    progressItems.length > 0
                      ? Math.round(
                          (completedItems / progressItems.length) * 100,
                        )
                      : 0;

                  return (
                    <section className="admin-inspection-progress">
                      <div className="admin-inspection-progress-heading">
                        <div>
                          <span>
                            {isCheckin
                              ? "Preparação da devolução"
                              : "Preparação da entrega"}
                          </span>

                          <strong>
                            {completedItems}/{progressItems.length} concluído(s)
                          </strong>
                        </div>

                        <strong>{percentage}%</strong>
                      </div>

                      <div className="admin-inspection-progress-bar">
                        <span style={{ width: `${percentage}%` }} />
                      </div>

                      <div className="admin-inspection-progress-items">
                        {progressItems.map((item) => (
                          <div
                            key={item.label}
                            className={
                              item.ready
                                ? "admin-inspection-progress-item is-ready"
                                : "admin-inspection-progress-item"
                            }
                          >
                            <i>{item.ready ? "✓" : "!"}</i>
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })()}
                <label>
                  Matrícula da viatura
                  <input
                    type="text"
                    value={inspection.registrationPlate ?? ""}
                    onChange={(e) =>
                      updateInspectionDraft(booking, type, {
                        registrationPlate: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="Ex.: ST-00-00"
                    autoComplete="off"
                  />
                </label>

                {!isCheckin && (
                  <div className={`admin-deposit-box ${styles.financialCard}`}>
                    <strong>Caução da viatura</strong>

                    <p>
                      Valor a receber:{" "}
                      <strong>
                        {booking.currency || "€"}{" "}
                        {Number(booking.refundableDeposit || 0).toFixed(2)}
                      </strong>
                    </p>

                    {Number(booking.refundableDeposit || 0) > 0 ? (
                      <>
                        <label className="admin-damage-check">
                          <input
                            type="checkbox"
                            checked={Boolean(inspection.depositReceived)}
                            onChange={(e) =>
                              updateInspectionDraft(booking, type, {
                                depositReceived: e.target.checked,
                              })
                            }
                          />
                          Caução recebida
                        </label>

                        <label>
                          Método de pagamento
                          <select
                            value={inspection.depositPaymentMethod ?? ""}
                            onChange={(e) =>
                              updateInspectionDraft(booking, type, {
                                depositPaymentMethod:
                                  e.target.value === ""
                                    ? undefined
                                    : (e.target.value as
                                        "cash" | "transfer" | "pos"),
                              })
                            }
                          >
                            <option value="">Selecionar</option>
                            <option value="cash">Dinheiro</option>
                            <option value="transfer">Transferência</option>
                            <option value="pos">POS</option>
                          </select>
                        </label>
                      </>
                    ) : (
                      <p>Esta reserva não tem caução configurada.</p>
                    )}
                  </div>
                )}

                <label>
                  Quilometragem
                  <input
                    type="number"
                    min="0"
                    value={inspection.mileage ?? ""}
                    onChange={(e) =>
                      updateInspectionDraft(booking, type, {
                        mileage:
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                      })
                    }
                    placeholder="Ex.: 82500"
                  />
                </label>

                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "8px",
                    }}
                  >
                    <strong>⛽ Combustível</strong>

                    <strong>
                      {fuelGaugeLevels.find(
                        (level) =>
                          level.value === (inspection.fuelLevel ?? "full"),
                      )?.percentage ?? 100}
                      %
                    </strong>
                  </div>

                  <div
                    role="group"
                    aria-label="Nível de combustível"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(9, minmax(30px, 1fr))",
                      gap: "4px",
                      padding: "10px",
                      border: "1px solid #d1d5db",
                      borderRadius: "10px",
                      background: "#f8fafc",
                    }}
                  >
                    {fuelGaugeLevels.map((level, index) => {
                      const selectedLevel = inspection.fuelLevel ?? "full";

                      const selectedIndex = fuelGaugeLevels.findIndex(
                        (item) => item.value === selectedLevel,
                      );

                      const filled = index <= selectedIndex;

                      const selected = selectedLevel === level.value;

                      return (
                        <button
                          key={level.value}
                          type="button"
                          title={`${level.percentage}%`}
                          aria-label={`Combustível ${level.percentage}%`}
                          aria-pressed={selected}
                          onClick={() =>
                            updateInspectionDraft(booking, type, {
                              fuelLevel: level.value,
                            })
                          }
                          style={{
                            minWidth: 0,
                            height: `${38 + index * 3}px`,
                            padding: "4px 1px",
                            alignSelf: "end",
                            borderRadius: "5px 5px 2px 2px",
                            border: selected
                              ? "3px solid #111827"
                              : "1px solid #94a3b8",
                            background: filled ? "#22c55e" : "#e2e8f0",
                            color: filled ? "#052e16" : "#475569",
                            fontSize: "11px",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {level.label}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginTop: "5px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    <span>E — Vazio</span>
                    <span>
                      {fuelLevelLabel[inspection.fuelLevel ?? "full"]}
                    </span>
                    <span>F — Cheio</span>
                  </div>
                </div>

                <label>
                  Estado do carro
                  <select
                    value={inspection.condition ?? "good"}
                    onChange={(e) =>
                      updateInspectionDraft(booking, type, {
                        condition: e.target.value as VehicleCondition,
                      })
                    }
                  >
                    {Object.entries(vehicleConditionLabel).map(
                      ([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label>
                  Observações
                  <textarea
                    value={inspection.notes ?? ""}
                    onChange={(e) =>
                      updateInspectionDraft(booking, type, {
                        notes: e.target.value,
                      })
                    }
                    placeholder={
                      isCheckin
                        ? "Estado geral na devolução..."
                        : "Riscos ou marcas já existentes..."
                    }
                  />
                </label>

                {isCheckin &&
                  booking.checkout?.fuelLevel &&
                  inspection.fuelLevel &&
                  (() => {
                    const fuelRank: Record<FuelLevel, number> = {
                      empty: 0,
                      one_eighth: 1,
                      quarter: 2,
                      three_eighths: 3,
                      half: 4,
                      five_eighths: 5,
                      three_quarters: 6,
                      seven_eighths: 7,
                      full: 8,
                    };

                    const returnedWithLessFuel =
                      fuelRank[inspection.fuelLevel] <
                      fuelRank[booking.checkout!.fuelLevel!];

                    if (!returnedWithLessFuel) {
                      return null;
                    }

                    return (
                      <div
                        className={`admin-fuel-warning ${styles.warningCard}`}
                      >
                        <strong>Combustível em falta</strong>
                        <p>
                          Entregue com{" "}
                          {fuelLevelLabel[booking.checkout!.fuelLevel!]} e
                          devolvido com {fuelLevelLabel[inspection.fuelLevel]}.
                        </p>

                        <label>
                          Valor a cobrar pela reposição
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={inspection.fuelCharge ?? 0}
                            onChange={(e) =>
                              updateInspectionDraft(booking, type, {
                                fuelCharge: Number(e.target.value) || 0,
                              })
                            }
                          />
                        </label>
                      </div>
                    );
                  })()}

                {isCheckin &&
                  (() => {
                    const caução = Math.max(
                      0,
                      Number(
                        booking.checkout?.depositAmount ??
                          booking.refundableDeposit ??
                          0,
                      ) || 0,
                    );

                    const combustível = Math.max(
                      0,
                      Number(inspection.fuelCharge) || 0,
                    );

                    const danos = inspection.hasDamage
                      ? Math.max(0, Number(inspection.damageAmount) || 0)
                      : 0;

                    const limpeza = inspection.cleaningRequired
                      ? Math.max(0, Number(inspection.cleaningAmount) || 0)
                      : 0;

                    const deduções = combustível + danos + limpeza;

                    const devolver = Math.max(0, caução - deduções);

                    const adicional = Math.max(0, deduções - caução);

                    return (
                      <div
                        className={`admin-deposit-box ${styles.financialCard}`}
                      >
                        <strong>Liquidação da caução</strong>

                        <p>
                          Caução recebida:{" "}
                          <strong>
                            {booking.currency || "€"} {caução.toFixed(2)}
                          </strong>
                        </p>

                        <p>
                          Combustível: {booking.currency || "€"}{" "}
                          {combustível.toFixed(2)}
                        </p>

                        <p>
                          Danos: {booking.currency || "€"} {danos.toFixed(2)}
                        </p>

                        <p>
                          Limpeza especial: {booking.currency || "€"}{" "}
                          {limpeza.toFixed(2)}
                        </p>

                        <p>
                          Total das deduções:{" "}
                          <strong>
                            {booking.currency || "€"} {deduções.toFixed(2)}
                          </strong>
                        </p>

                        {adicional > 0 ? (
                          <p>
                            Cliente deve pagar:{" "}
                            <strong>
                              {booking.currency || "€"} {adicional.toFixed(2)}
                            </strong>
                          </p>
                        ) : (
                          <p>
                            Devolver ao cliente:{" "}
                            <strong>
                              {booking.currency || "€"} {devolver.toFixed(2)}
                            </strong>
                          </p>
                        )}
                      </div>
                    );
                  })()}

                {!isCheckin && (
                  <>
                    <label
                      className={`admin-premium-toggle admin-premium-toggle-damage ${
                        inspection.hasDamage ? "is-active" : ""
                      }`}
                    >
                      <span className="admin-premium-toggle-icon">⚠</span>

                      <span className="admin-premium-toggle-content">
                        <strong>Existem danos antes da entrega</strong>

                        <small>
                          Assinale e registe no mapa todos os riscos,
                          amolgadelas ou marcas existentes antes de entregar a
                          viatura ao cliente.
                        </small>
                      </span>

                      <span className="admin-premium-switch">
                        <input
                          type="checkbox"
                          checked={Boolean(inspection.hasDamage)}
                          onChange={(event) =>
                            updateInspectionDraft(booking, type, {
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

                        <span
                          className="admin-premium-switch-track"
                          aria-hidden="true"
                        >
                          <span className="admin-premium-switch-thumb" />
                        </span>
                      </span>
                    </label>

                    {inspection.hasDamage && (
                      <CarDamageMap
                        mode="checkout"
                        selectedZones={inspection.damageZones ?? []}
                        onChange={(damageZones) =>
                          updateInspectionDraft(booking, type, {
                            damageZones,
                          })
                        }
                      />
                    )}
                  </>
                )}

                {isCheckin && (
                  <>
                    <label
                      className={`admin-premium-toggle admin-premium-toggle-damage ${
                        inspection.hasDamage ? "is-active" : ""
                      }`}
                    >
                      <span className="admin-premium-toggle-icon">⚠</span>

                      <span className="admin-premium-toggle-content">
                        <strong>Foram encontrados novos danos</strong>

                        <small>
                          Assinale quando forem identificados danos que não
                          estavam registados na inspeção anterior.
                        </small>
                      </span>

                      <span className="admin-premium-switch">
                        <input
                          type="checkbox"
                          checked={Boolean(inspection.hasDamage)}
                          onChange={(e) =>
                            updateInspectionDraft(booking, type, {
                              hasDamage: e.target.checked,
                            })
                          }
                        />

                        <span
                          className="admin-premium-switch-track"
                          aria-hidden="true"
                        >
                          <span className="admin-premium-switch-thumb" />
                        </span>
                      </span>
                    </label>

                    {inspection.hasDamage && (
                      <CarDamageMap
                        mode="checkin"
                        existingZones={booking.checkout?.damageZones ?? []}
                        selectedZones={inspection.damageZones ?? []}
                        onChange={(damageZones) =>
                          updateInspectionDraft(booking, type, {
                            damageZones,
                          })
                        }
                      />
                    )}

                    {inspection.hasDamage && (
                      <>
                        <label>
                          Descrição dos danos
                          <textarea
                            value={inspection.damageDescription ?? ""}
                            onChange={(e) =>
                              updateInspectionDraft(booking, type, {
                                damageDescription: e.target.value,
                              })
                            }
                            placeholder="Descreve os danos encontrados..."
                          />
                        </label>

                        <label>
                          Valor associado
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={inspection.damageAmount ?? ""}
                            onChange={(e) =>
                              updateInspectionDraft(booking, type, {
                                damageAmount:
                                  e.target.value === ""
                                    ? undefined
                                    : Math.max(0, Number(e.target.value)),
                              })
                            }
                          />
                        </label>
                      </>
                    )}

                    <div className="admin-premium-cleaning-section">
                      <label
                        className={`admin-premium-toggle admin-premium-toggle-cleaning ${
                          inspection.cleaningRequired ? "is-active" : ""
                        }`}
                      >
                        <span className="admin-premium-toggle-icon">✦</span>

                        <span className="admin-premium-toggle-content">
                          <strong>Necessita limpeza especial</strong>

                          <small>
                            Assinale quando o veículo necessita de limpeza
                            adicional além da limpeza padrão.
                          </small>
                        </span>

                        <span className="admin-premium-switch">
                          <input
                            type="checkbox"
                            checked={Boolean(inspection.cleaningRequired)}
                            onChange={(e) =>
                              updateInspectionDraft(booking, type, {
                                cleaningRequired: e.target.checked,
                                cleaningNotes: e.target.checked
                                  ? inspection.cleaningNotes
                                  : "",
                                cleaningAmount: e.target.checked
                                  ? inspection.cleaningAmount
                                  : 0,
                              })
                            }
                          />

                          <span
                            className="admin-premium-switch-track"
                            aria-hidden="true"
                          >
                            <span className="admin-premium-switch-thumb" />
                          </span>
                        </span>
                      </label>

                      {inspection.cleaningRequired && (
                        <>
                          <label>
                            Motivo da limpeza
                            <textarea
                              value={inspection.cleaningNotes ?? ""}
                              placeholder="Ex.: areia excessiva, bancos manchados ou interior muito sujo"
                              onChange={(e) =>
                                updateInspectionDraft(booking, type, {
                                  cleaningNotes: e.target.value,
                                })
                              }
                            />
                          </label>

                          <label>
                            Valor da limpeza
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={inspection.cleaningAmount ?? ""}
                              onChange={(e) =>
                                updateInspectionDraft(booking, type, {
                                  cleaningAmount:
                                    e.target.value === ""
                                      ? undefined
                                      : Math.max(0, Number(e.target.value)),
                                })
                              }
                            />
                          </label>
                        </>
                      )}
                    </div>
                  </>
                )}

                <section
                  className={`admin-inspection-photos ${styles.section}`}
                >
                  <div className="admin-inspection-photos-header">
                    <div>
                      <strong>Fotografias da inspeção</strong>
                      <small>
                        {(inspection.photoUrls ?? []).length}
                        /12 fotografias
                      </small>
                    </div>

                    <label className="admin-photo-upload-button">
                      📷 Adicionar fotografias
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        capture="environment"
                        disabled={updatingId === booking.id}
                        onChange={(event) => {
                          void uploadInspectionPhotos(
                            booking,
                            type,
                            event.target.files,
                          );

                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <p className="admin-photo-help">
                    Fotografa a frente, traseira, laterais, interior, painel e
                    quilometragem. Máximo de 10 MB por imagem.
                  </p>

                  {(inspection.photoUrls ?? []).length > 0 ? (
                    <div className="admin-inspection-photo-grid">
                      {(inspection.photoUrls ?? []).map(
                        (photoUrl, photoIndex) => (
                          <figure
                            key={photoUrl}
                            className="admin-inspection-photo"
                          >
                            <a
                              href={photoUrl}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Abrir fotografia ${photoIndex + 1}`}
                            >
                              <img
                                src={photoUrl}
                                alt={`${isCheckin ? "Devolução" : "Entrega"} — fotografia ${photoIndex + 1}`}
                                loading="lazy"
                              />
                            </a>

                            <figcaption>
                              <span>Foto {photoIndex + 1}</span>

                              <button
                                type="button"
                                className="admin-photo-delete"
                                disabled={updatingId === booking.id}
                                onClick={() =>
                                  void deleteInspectionPhoto(
                                    booking,
                                    type,
                                    photoUrl,
                                  )
                                }
                              >
                                Eliminar
                              </button>
                            </figcaption>
                          </figure>
                        ),
                      )}
                    </div>
                  ) : (
                    <p className="admin-photo-empty">
                      Nenhuma fotografia adicionada.
                    </p>
                  )}
                </section>

                <section
                  className={`admin-inspection-signatures ${styles.section}`}
                >
                  <div className="admin-inspection-signatures-title">
                    <div>
                      <strong>Assinaturas digitais</strong>
                      <small>
                        As assinaturas ficam associadas a esta inspeção e
                        aparecem na ficha final do aluguer.
                      </small>
                    </div>
                  </div>

                  <div className="admin-signature-grid">
                    <SignaturePad
                      title="Assinatura do cliente"
                      existingUrl={inspection.customerSignatureUrl}
                      disabled={updatingId === booking.id}
                      onSave={(blob) =>
                        uploadInspectionSignature(
                          booking,
                          type,
                          "customer",
                          blob,
                        )
                      }
                      onDelete={() =>
                        deleteInspectionSignature(booking, type, "customer")
                      }
                    />

                    <SignaturePad
                      title="Assinatura do funcionário"
                      existingUrl={inspection.staffSignatureUrl}
                      disabled={updatingId === booking.id}
                      onSave={(blob) =>
                        uploadInspectionSignature(booking, type, "staff", blob)
                      }
                      onDelete={() =>
                        deleteInspectionSignature(booking, type, "staff")
                      }
                    />
                  </div>
                </section>

                <button
                  type="button"
                  className={styles.saveButton}
                  onClick={() => handleInspectionSave(type, inspection)}
                  disabled={updatingId === booking.id}
                >
                  {inspection.completed
                    ? "✓ ATUALIZAR REGISTO"
                    : isCheckin
                      ? "📥 RECEBER VIATURA"
                      : "🚗 ENTREGAR VIATURA"}
                </button>
              </div>
            </details>
          );
        })}
      {wizardOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="inspection-wizard-overlay">
            <div className="inspection-wizard-modal">
              <InspectionWizard
                mode={wizardOpen.type}
                reference={(booking as T & InspectionWizardBooking).reference}
                customerName={
                  (booking as T & InspectionWizardBooking).customerName
                }
                carName={`${(booking as T & InspectionWizardBooking).carBrand || "Viatura"} ${
                  (booking as T & InspectionWizardBooking).carModel || ""
                }`.trim()}
                inspection={getInspectionDraft(booking, wizardOpen.type)}
                existingDamageZones={
                  wizardOpen.type === "checkin"
                    ? (booking.checkout?.damageZones ?? [])
                    : []
                }
                refundableDeposit={Number(booking.refundableDeposit || 0)}
                currency={booking.currency || "€"}
                busy={updatingId === booking.id}
                onUpdate={(values) =>
                  updateInspectionDraft(booking, wizardOpen.type, values)
                }
                onUploadPhotos={(files) =>
                  uploadInspectionPhotos(booking, wizardOpen.type, files)
                }
                onDeletePhoto={(photoUrl) =>
                  deleteInspectionPhoto(booking, wizardOpen.type, photoUrl)
                }
                onUploadSignature={(role, blob) =>
                  uploadInspectionSignature(
                    booking,
                    wizardOpen.type,
                    role,
                    blob,
                  )
                }
                onDeleteSignature={(role) =>
                  deleteInspectionSignature(booking, wizardOpen.type, role)
                }
                onFinalize={() =>
                  handleInspectionSave(
                    wizardOpen.type,
                    getInspectionDraft(booking, wizardOpen.type),
                  )
                }
                onClose={() => setWizardOpen(null)}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
