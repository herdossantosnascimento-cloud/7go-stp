"use client";

import {
  doc,
  getDoc,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase/client";

type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

type PaymentStatus = "pending" | "partial" | "paid";

type DepositStatus =
  | "pending"
  | "received"
  | "returned"
  | "retained";

type FuelLevel =
  | "empty"
  | "quarter"
  | "half"
  | "three_quarters"
  | "full";

type VehicleCondition = "good" | "observations";

type VehicleInspection = {
  mileage?: number;
  fuelLevel?: FuelLevel;
  condition?: VehicleCondition;
  notes?: string;
  hasDamage?: boolean;
  damageDescription?: string;
  damageAmount?: number;
  completed?: boolean;
};

type DriverDetails = {
  documentNumber?: string;
  drivingLicenceNumber?: string;
  drivingLicenceExpiry?: string;
  nationality?: string;
  address?: string;
  secondDriverEnabled?: boolean;
  secondDriverName?: string;
  secondDriverDocumentNumber?: string;
  secondDriverLicenceNumber?: string;
  secondDriverLicenceExpiry?: string;
};

type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "card"
  | "other";

type FinancialDetails = {
  amountPaid?: number;
  paymentMethod?: PaymentMethod;
  paymentDate?: string;
  depositReceivedAmount?: number;
  depositReceivedDate?: string;
};

type Booking = {
  id: string;
  reference?: string;
  status?: BookingStatus;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  carYear?: number;
  carRegistrationPlate?: string;
  carVehicleColor?: string;
  carVin?: string;
  carInsurer?: string;
  carInsurancePolicyNumber?: string;
  carInsuranceExpiry?: string;
  pickupDate?: string;
  returnDate?: string;
  totalDays?: number;
  rentalModeLabel?: string;
  pricePerDay?: number;
  premiumPricePerDay?: number;
  dailyRate?: number;
  normalExcess?: number;
  appliedExcess?: number;
  refundableDeposit?: number;
  estimatedTotal?: number;
  currency?: string;
  customerName?: string;
  customerPhone?: string;
  message?: string;
  paymentStatus?: PaymentStatus;
  depositStatus?: DepositStatus;
  internalNotes?: string;
  driverDetails?: DriverDetails;
  financialDetails?: FinancialDetails;
  checkout?: VehicleInspection;
  checkin?: VehicleInspection;
};

type CatalogVehicle = {
  registrationPlate?: string;
  vehicleColor?: string;
  vin?: string;
  insurer?: string;
  insurancePolicyNumber?: string;
  insuranceExpiry?: string;
};

const statusLabel: Record<BookingStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  in_progress: "Em curso",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const paymentStatusLabel: Record<PaymentStatus, string> = {
  pending: "Pendente",
  partial: "Parcial",
  paid: "Pago",
};

const depositStatusLabel: Record<DepositStatus, string> = {
  pending: "Pendente",
  received: "Recebida / bloqueada",
  returned: "Devolvida",
  retained: "Retida",
};

const paymentMethodLabel: Record<PaymentMethod, string> = {
  cash: "Dinheiro",
  bank_transfer: "Transferência bancária",
  card: "Cartão",
  other: "Outro",
};

const fuelLevelLabel: Record<FuelLevel, string> = {
  empty: "Vazio",
  quarter: "1/4",
  half: "1/2",
  three_quarters: "3/4",
  full: "Cheio",
};

const vehicleConditionLabel: Record<VehicleCondition, string> = {
  good: "Bom estado",
  observations: "Com observações",
};

function showValue(
  value: string | number | null | undefined,
  fallback = "Não registado",
) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value);
}

function money(
  currency: string,
  value: number | null | undefined,
) {
  if (value === undefined || value === null) {
    return "Não registado";
  }

  return `${currency}${value}`;
}

function InspectionSection({
  title,
  inspection,
  currency,
  isReturn = false,
}: {
  title: string;
  inspection?: VehicleInspection;
  currency: string;
  isReturn?: boolean;
}) {
  if (!inspection?.completed) {
    return (
      <section className="rental-sheet-section">
        <div className="rental-sheet-section-title">
          <h2>{title}</h2>
          <span className="rental-sheet-badge rental-sheet-badge-pending">
            Por registar
          </span>
        </div>

        <p className="rental-sheet-empty">
          Este registo ainda não foi preenchido no Admin 7Go.
        </p>
      </section>
    );
  }

  return (
    <section className="rental-sheet-section">
      <div className="rental-sheet-section-title">
        <h2>{title}</h2>
        <span className="rental-sheet-badge">
          Registada
        </span>
      </div>

      <div className="rental-sheet-data-grid">
        <div>
          <span>Quilometragem</span>
          <strong>
            {inspection.mileage != null
              ? `${inspection.mileage} km`
              : "Não registada"}
          </strong>
        </div>

        <div>
          <span>Combustível</span>
          <strong>
            {inspection.fuelLevel
              ? fuelLevelLabel[inspection.fuelLevel]
              : "Não registado"}
          </strong>
        </div>

        <div>
          <span>Estado do carro</span>
          <strong>
            {inspection.condition
              ? vehicleConditionLabel[inspection.condition]
              : "Não registado"}
          </strong>
        </div>

        {isReturn && (
          <div>
            <span>Novos danos</span>
            <strong>
              {inspection.hasDamage ? "Sim" : "Não"}
            </strong>
          </div>
        )}
      </div>

      <div className="rental-sheet-note">
        <span>Observações</span>
        <p>
          {inspection.notes?.trim() ||
            "Sem observações registadas."}
        </p>
      </div>

      {isReturn && inspection.hasDamage && (
        <div className="rental-sheet-damage">
          <div>
            <span>Descrição dos danos</span>
            <p>
              {inspection.damageDescription?.trim() ||
                "Sem descrição registada."}
            </p>
          </div>

          <div>
            <span>Valor associado</span>
            <strong>
              {money(currency, inspection.damageAmount)}
            </strong>
          </div>
        </div>
      )}
    </section>
  );
}

export function RentalSheet({
  bookingId,
}: {
  bookingId: string;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [catalogVehicle, setCatalogVehicle] =
    useState<CatalogVehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthChecked(true);
    });
  }, []);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }

    async function loadBooking() {
      setLoading(true);
      setError("");

      try {
        const snapshot = await getDoc(
          doc(db, "bookings", bookingId),
        );

        if (!snapshot.exists()) {
          setError("Reserva não encontrada.");
          setBooking(null);
          return;
        }

        setBooking({
          id: snapshot.id,
          ...snapshot.data(),
        } as Booking);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Erro desconhecido.";

        setError(
          `Não foi possível carregar a ficha: ${message}`,
        );
      } finally {
        setLoading(false);
      }
    }

    loadBooking();
  }, [authChecked, bookingId, user]);

  useEffect(() => {
    if (!user || !booking?.carId) {
      setCatalogVehicle(null);
      return;
    }

    const carId = booking.carId;
    let active = true;

    async function loadCatalogVehicle() {
      try {
        const snapshot = await getDoc(
          doc(db, "carCatalog", carId),
        );

        if (!active) {
          return;
        }

        if (!snapshot.exists()) {
          setCatalogVehicle(null);
          return;
        }

        const data = snapshot.data();

        setCatalogVehicle({
          registrationPlate:
            typeof data.registrationPlate === "string"
              ? data.registrationPlate
              : "",
          vehicleColor:
            typeof data.vehicleColor === "string"
              ? data.vehicleColor
              : "",
          vin:
            typeof data.vin === "string"
              ? data.vin
              : "",
          insurer:
            typeof data.insurer === "string"
              ? data.insurer
              : "",
          insurancePolicyNumber:
            typeof data.insurancePolicyNumber === "string"
              ? data.insurancePolicyNumber
              : "",
          insuranceExpiry:
            typeof data.insuranceExpiry === "string"
              ? data.insuranceExpiry
              : "",
        });
      } catch (catalogError) {
        console.error(
          "ERRO AO CARREGAR DADOS DA VIATURA:",
          catalogError,
        );

        if (active) {
          setCatalogVehicle(null);
        }
      }
    }

    loadCatalogVehicle();

    return () => {
      active = false;
    };
  }, [booking?.carId, user]);

  if (!authChecked || loading) {
    return (
      <main className="rental-sheet-state">
        <p>A carregar ficha de aluguer...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="rental-sheet-state">
        <h1>Acesso privado 7Go</h1>
        <p>
          Inicia sessão no Admin antes de abrir esta ficha.
        </p>

        <a href="/admin/reservas">
          Voltar ao Admin
        </a>
      </main>
    );
  }

  if (error || !booking) {
    return (
      <main className="rental-sheet-state">
        <h1>Ficha indisponível</h1>
        <p>{error || "Reserva não encontrada."}</p>

        <a href="/admin/reservas">
          Voltar ao Admin
        </a>
      </main>
    );
  }

  const currency = booking.currency || "£";
  const status = booking.status || "pending";
  const appliedExcess =
    booking.appliedExcess ?? booking.normalExcess;

  const registrationPlate =
    booking.carRegistrationPlate?.trim() ||
    catalogVehicle?.registrationPlate?.trim() ||
    "";

  const vehicleColor =
    booking.carVehicleColor?.trim() ||
    catalogVehicle?.vehicleColor?.trim() ||
    "";

  const vehicleVin =
    booking.carVin?.trim() ||
    catalogVehicle?.vin?.trim() ||
    "";

  const vehicleInsurer =
    booking.carInsurer?.trim() ||
    catalogVehicle?.insurer?.trim() ||
    "";

  const vehicleInsurancePolicyNumber =
    booking.carInsurancePolicyNumber?.trim() ||
    catalogVehicle?.insurancePolicyNumber?.trim() ||
    "";

  const vehicleInsuranceExpiry =
    booking.carInsuranceExpiry?.trim() ||
    catalogVehicle?.insuranceExpiry?.trim() ||
    "";

  function handlePrint() {
    window.focus();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.print();
        }, 150);
      });
    });
  }

  return (
    <main className="rental-sheet-page">
      <div className="rental-sheet-toolbar">
        <a href="/admin/reservas">
          ← Voltar ao Admin
        </a>

        <button
          type="button"
          onClick={handlePrint}
        >
          Imprimir / Guardar PDF
        </button>
      </div>

      <article className="rental-sheet-document">
        <header className="rental-sheet-header">
          <div>
            <span className="rental-sheet-brand">
              7GO
            </span>
            <p>DRIVE YOUR WAY</p>
          </div>

          <div className="rental-sheet-reference">
            <span>Contrato / Ficha de aluguer</span>
            <strong>
              {booking.reference || "Sem referência"}
            </strong>
            <small>{statusLabel[status]}</small>
          </div>
        </header>

        <section className="rental-sheet-document-intro">
          <strong>CONTRATO / FICHA DE ALUGUER DE VEÍCULO</strong>
          <p>
            Documento associado à reserva{" "}
            {booking.reference || booking.id}.
          </p>
        </section>

        <section className="rental-sheet-section rental-sheet-lessor">
          <div className="rental-sheet-section-title">
            <h2>Identificação da locadora</h2>
          </div>

          <div className="rental-sheet-data-grid">
            <div>
              <span>Nome legal / Denominação</span>
              <strong className="rental-sheet-blank-field">
                &nbsp;
              </strong>
            </div>

            <div>
              <span>NIF</span>
              <strong className="rental-sheet-blank-field">
                &nbsp;
              </strong>
            </div>

            <div>
              <span>Licença / Alvará</span>
              <strong className="rental-sheet-blank-field">
                &nbsp;
              </strong>
            </div>

            <div>
              <span>Representante</span>
              <strong className="rental-sheet-blank-field">
                &nbsp;
              </strong>
            </div>

            <div>
              <span>Telefone</span>
              <strong className="rental-sheet-blank-field">
                &nbsp;
              </strong>
            </div>

            <div>
              <span>Email</span>
              <strong className="rental-sheet-blank-field">
                &nbsp;
              </strong>
            </div>
          </div>

          <div className="rental-sheet-note">
            <span>Sede / Morada</span>
            <p className="rental-sheet-blank-line">&nbsp;</p>
          </div>
        </section>

        <section className="rental-sheet-section">
          <div className="rental-sheet-section-title">
            <h2>Reserva e cliente</h2>
          </div>

          <div className="rental-sheet-data-grid">
            <div>
              <span>Cliente</span>
              <strong>
                {showValue(booking.customerName)}
              </strong>
            </div>

            <div>
              <span>Contacto</span>
              <strong>
                {showValue(booking.customerPhone)}
              </strong>
            </div>

            <div>
              <span>Viatura</span>
              <strong>
                {showValue(
                  [booking.carBrand, booking.carModel]
                    .filter(Boolean)
                    .join(" "),
                )}
              </strong>
            </div>

            <div>
              <span>Ano</span>
              <strong>
                {showValue(booking.carYear)}
              </strong>
            </div>

            <div>
              <span>Matrícula</span>
              <strong>
                {showValue(registrationPlate)}
              </strong>
            </div>

            <div>
              <span>Cor</span>
              <strong>
                {showValue(vehicleColor)}
              </strong>
            </div>

            <div>
              <span>VIN / Número do chassis</span>
              <strong>
                {showValue(vehicleVin)}
              </strong>
            </div>

            <div>
              <span>Seguradora</span>
              <strong>
                {showValue(vehicleInsurer)}
              </strong>
            </div>

            <div>
              <span>Nº da apólice</span>
              <strong>
                {showValue(vehicleInsurancePolicyNumber)}
              </strong>
            </div>

            <div>
              <span>Validade do seguro</span>
              <strong>
                {showValue(vehicleInsuranceExpiry)}
              </strong>
            </div>

            <div>
              <span>Modalidade</span>
              <strong>
                {showValue(booking.rentalModeLabel)}
              </strong>
            </div>

            <div>
              <span>Data de entrega</span>
              <strong>
                {showValue(booking.pickupDate)}
              </strong>
            </div>

            <div>
              <span>Data de devolução</span>
              <strong>
                {showValue(booking.returnDate)}
              </strong>
            </div>

            <div>
              <span>Dias</span>
              <strong>
                {showValue(booking.totalDays)}
              </strong>
            </div>

            <div>
              <span>Estado da reserva</span>
              <strong>{statusLabel[status]}</strong>
            </div>
          </div>
        </section>

        <section className="rental-sheet-section">
          <div className="rental-sheet-section-title">
            <h2>Dados do condutor</h2>
          </div>

          <div className="rental-sheet-data-grid">
            <div>
              <span>Documento / Passaporte</span>
              <strong>
                {showValue(
                  booking.driverDetails?.documentNumber,
                )}
              </strong>
            </div>

            <div>
              <span>Carta de condução</span>
              <strong>
                {showValue(
                  booking.driverDetails?.drivingLicenceNumber,
                )}
              </strong>
            </div>

            <div>
              <span>Validade da carta</span>
              <strong>
                {showValue(
                  booking.driverDetails?.drivingLicenceExpiry,
                )}
              </strong>
            </div>

            <div>
              <span>Nacionalidade</span>
              <strong>
                {showValue(
                  booking.driverDetails?.nationality,
                )}
              </strong>
            </div>
          </div>

          <div className="rental-sheet-note">
            <span>Morada</span>
            <p>
              {showValue(
                booking.driverDetails?.address,
              )}
            </p>
          </div>

          {booking.driverDetails?.secondDriverEnabled && (
            <div className="rental-sheet-second-driver">
              <h3>Segundo condutor</h3>

              <div className="rental-sheet-data-grid">
                <div>
                  <span>Nome</span>
                  <strong>
                    {showValue(
                      booking.driverDetails?.secondDriverName,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Documento / Passaporte</span>
                  <strong>
                    {showValue(
                      booking.driverDetails
                        ?.secondDriverDocumentNumber,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Carta de condução</span>
                  <strong>
                    {showValue(
                      booking.driverDetails
                        ?.secondDriverLicenceNumber,
                    )}
                  </strong>
                </div>

                <div>
                  <span>Validade da carta</span>
                  <strong>
                    {showValue(
                      booking.driverDetails
                        ?.secondDriverLicenceExpiry,
                    )}
                  </strong>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="rental-sheet-section">
          <div className="rental-sheet-section-title">
            <h2>Condições comerciais</h2>
          </div>

          <div className="rental-sheet-data-grid">
            <div>
              <span>Preço base/dia</span>
              <strong>
                {money(currency, booking.pricePerDay)}
              </strong>
            </div>

            <div>
              <span>Preço final/dia</span>
              <strong>
                {money(
                  currency,
                  booking.dailyRate ??
                    booking.pricePerDay,
                )}
              </strong>
            </div>

            <div>
              <span>Franquia aplicada</span>
              <strong>
                {money(currency, appliedExcess)}
              </strong>
            </div>

            <div>
              <span>Caução reembolsável</span>
              <strong>
                {money(
                  currency,
                  booking.refundableDeposit,
                )}
              </strong>
            </div>

            <div>
              <span>Pagamento</span>
              <strong>
                {
                  paymentStatusLabel[
                    booking.paymentStatus ?? "pending"
                  ]
                }
              </strong>
            </div>

            <div>
              <span>Estado da caução</span>
              <strong>
                {
                  depositStatusLabel[
                    booking.depositStatus ?? "pending"
                  ]
                }
              </strong>
            </div>

            <div>
              <span>Valor pago</span>
              <strong>
                {booking.financialDetails?.amountPaid != null
                  ? money(
                      currency,
                      booking.financialDetails.amountPaid,
                    )
                  : "Não registado"}
              </strong>
            </div>

            <div>
              <span>Saldo em falta</span>
              <strong>
                {booking.financialDetails?.amountPaid != null
                  ? money(
                      currency,
                      Math.max(
                        (booking.estimatedTotal ?? 0) -
                          booking.financialDetails.amountPaid,
                        0,
                      ),
                    )
                  : "Não registado"}
              </strong>
            </div>

            <div>
              <span>Método de pagamento</span>
              <strong>
                {booking.financialDetails?.paymentMethod
                  ? paymentMethodLabel[
                      booking.financialDetails.paymentMethod
                    ]
                  : "Não registado"}
              </strong>
            </div>

            <div>
              <span>Data do pagamento</span>
              <strong>
                {showValue(
                  booking.financialDetails?.paymentDate,
                )}
              </strong>
            </div>

            <div>
              <span>Caução recebida</span>
              <strong>
                {booking.financialDetails
                  ?.depositReceivedAmount != null
                  ? money(
                      currency,
                      booking.financialDetails
                        .depositReceivedAmount,
                    )
                  : "Não registada"}
              </strong>
            </div>

            <div>
              <span>Data da caução</span>
              <strong>
                {showValue(
                  booking.financialDetails
                    ?.depositReceivedDate,
                )}
              </strong>
            </div>
          </div>

          <div className="rental-sheet-total">
            <span>Total estimado da reserva</span>
            <strong>
              {money(currency, booking.estimatedTotal)}
            </strong>
          </div>

          <div className="rental-sheet-rental-terms">
            <strong>Condições da modalidade</strong>

            {booking.rentalModeLabel
              ?.toLowerCase()
              .includes("premium") ? (
              <p>
                Modalidade 7Go Premium: franquia de £0 para danos
                cobertos pelas condições do aluguer. A caução
                reembolsável continua obrigatória. Danos ou situações
                excluídas das condições de proteção podem originar
                custos adicionais.
              </p>
            ) : (
              <p>
                Modalidade Aluguer Normal: aplica-se a franquia
                indicada nesta ficha para danos abrangidos. A caução
                reembolsável é obrigatória e será tratada de acordo
                com o estado da viatura e as condições do aluguer.
              </p>
            )}
          </div>
        </section>

        <InspectionSection
          title="Entrega do veículo"
          inspection={booking.checkout}
          currency={currency}
        />

        <InspectionSection
          title="Devolução do veículo"
          inspection={booking.checkin}
          currency={currency}
          isReturn
        />

        <section className="rental-sheet-contract">
          <div className="rental-sheet-section-title">
            <h2>Condições gerais do aluguer</h2>
          </div>

          <div className="rental-sheet-contract-clauses">
            <article>
              <h3>1. Objeto do contrato</h3>
              <p>
                A locadora entrega ao cliente, para utilização temporária,
                a viatura identificada neste documento, nas condições,
                datas, modalidade e valores aqui registados. A viatura
                permanece propriedade da locadora durante todo o aluguer.
              </p>
            </article>

            <article>
              <h3>2. Condutor autorizado</h3>
              <p>
                A viatura apenas pode ser conduzida pelo cliente ou pelos
                condutores adicionais registados neste contrato, desde que
                possuam documento de identificação e carta de condução
                válidos para a categoria da viatura.
              </p>
            </article>

            <article>
              <h3>3. Utilização da viatura</h3>
              <p>
                O cliente compromete-se a utilizar a viatura com prudência,
                respeitando as regras de circulação, capacidade de
                passageiros, sinalização, limitações da via e instruções
                fornecidas pela 7Go.
              </p>

              <p>
                É proibida a utilização em corridas, competições, testes,
                reboque não autorizado, transporte ilícito, subaluguer,
                condução sob efeito de álcool, drogas ou substâncias que
                reduzam a capacidade de condução.
              </p>
            </article>

            <article>
              <h3>4. Área de circulação</h3>
              <p>
                A viatura deve circular apenas nas zonas autorizadas pela
                locadora. A saída do território ou transporte da viatura
                por barco, navio ou outro meio exige autorização prévia e
                escrita da 7Go.
              </p>
            </article>

            <article>
              <h3>5. Preço e pagamento</h3>
              <p>
                O cliente obriga-se a pagar o preço total indicado neste
                contrato, bem como extras, prolongamentos, combustível em
                falta, limpeza extraordinária, multas, portagens, danos e
                outros valores comprovadamente resultantes da utilização
                da viatura.
              </p>
            </article>

            <article>
              <h3>6. Caução reembolsável</h3>
              <p>
                A caução serve como garantia das obrigações do cliente.
                Será devolvida após a verificação da viatura, deduzindo-se,
                quando aplicável, valores relativos a danos, combustível,
                atrasos, multas, limpeza, perda de chaves, documentos ou
                outros incumprimentos devidamente registados.
              </p>
            </article>

            <article>
              <h3>7. Franquia e 7Go Premium</h3>
              <p>
                No Aluguer Normal aplica-se a franquia indicada neste
                documento. Na modalidade 7Go Premium, a franquia é de
                £0 apenas para danos abrangidos pelas condições de
                proteção.
              </p>

              <p>
                A franquia £0 não abrange conduta intencional ou
                negligência grave, condução não autorizada, uso proibido,
                combustível errado, danos em pneus ou interior quando
                excluídos, perda de chaves ou documentos, multas,
                combustível em falta ou outras exclusões expressamente
                comunicadas ao cliente.
              </p>
            </article>

            <article>
              <h3>8. Entrega e verificação</h3>
              <p>
                O cliente deve verificar a viatura no momento da entrega.
                Quilometragem, combustível, estado exterior e interior,
                riscos, marcas e observações serão registados na secção de
                entrega deste documento.
              </p>
            </article>

            <article>
              <h3>9. Combustível</h3>
              <p>
                A viatura deve ser devolvida com o nível de combustível
                acordado e registado na entrega. A diferença de combustível
                e os custos razoáveis de reposição poderão ser cobrados ao
                cliente.
              </p>
            </article>

            <article>
              <h3>10. Manutenção e avarias</h3>
              <p>
                O cliente deve interromper a utilização e contactar
                imediatamente a 7Go quando surgir aviso de avaria,
                sobreaquecimento, perda de óleo, problema nos pneus ou
                qualquer situação que possa agravar danos na viatura.
              </p>

              <p>
                Reparações ou substituições apenas podem ser realizadas
                com autorização prévia da locadora, salvo situação de
                emergência destinada a evitar perigo imediato.
              </p>
            </article>

            <article>
              <h3>11. Acidente, furto ou dano</h3>
              <p>
                Em caso de acidente, dano, furto ou tentativa de furto, o
                cliente deve proteger a viatura, contactar a 7Go, recolher
                dados das pessoas e veículos envolvidos e comunicar a
                ocorrência às autoridades quando necessário.
              </p>

              <p>
                O cliente não deve assumir responsabilidade, negociar ou
                pagar indemnizações a terceiros sem autorização da
                locadora ou da seguradora.
              </p>
            </article>

            <article>
              <h3>12. Multas e infrações</h3>
              <p>
                O cliente é responsável pelas multas, infrações, despesas
                e consequências resultantes da sua condução durante o
                período em que teve a viatura sob sua responsabilidade.
              </p>
            </article>

            <article>
              <h3>13. Chaves e documentos</h3>
              <p>
                A perda, destruição ou não devolução de chaves,
                documentos, acessórios ou equipamentos da viatura poderá
                originar a cobrança dos custos de substituição e das
                despesas diretamente relacionadas.
              </p>
            </article>

            <article>
              <h3>14. Prolongamento do aluguer</h3>
              <p>
                Qualquer prolongamento depende de pedido e confirmação
                prévia da 7Go. A permanência com a viatura além da data
                acordada, sem autorização, constitui incumprimento e pode
                originar cobrança adicional.
              </p>
            </article>

            <article>
              <h3>15. Devolução</h3>
              <p>
                A viatura deve ser devolvida na data, hora e local
                acordados, com chaves, documentos e acessórios. O estado
                de devolução será comparado com o registo da entrega.
              </p>
            </article>

            <article>
              <h3>16. Danos e avaliação</h3>
              <p>
                Novos danos serão descritos no registo de devolução. O
                valor indicado poderá ser ajustado após orçamento,
                avaliação técnica ou comunicação da seguradora, sendo o
                cliente informado do fundamento da cobrança.
              </p>
            </article>

            <article>
              <h3>17. Cancelamento e não comparência</h3>
              <p>
                Cancelamentos, alterações de datas e não comparência serão
                tratados de acordo com as condições comunicadas na reserva.
                Valores já pagos poderão ser utilizados para cobrir custos
                ou perdas diretamente resultantes do cancelamento, quando
                permitido e previamente informado.
              </p>
            </article>

            <article>
              <h3>18. Dados pessoais</h3>
              <p>
                Os dados pessoais e documentos do cliente são recolhidos
                para gerir a reserva, verificar a habilitação para
                conduzir, cumprir obrigações legais, tratar pagamentos,
                acidentes, danos, reclamações e comunicações relacionadas
                com o aluguer.
              </p>

              <p>
                A 7Go deve limitar o acesso aos dados, conservar apenas o
                necessário e adotar medidas adequadas de segurança e
                confidencialidade.
              </p>
            </article>

            <article>
              <h3>19. Incumprimento</h3>
              <p>
                A locadora pode terminar o aluguer e solicitar a devolução
                imediata da viatura quando existir utilização proibida,
                informação falsa, falta de pagamento, risco para a
                viatura, condução não autorizada ou violação grave deste
                contrato.
              </p>
            </article>

            <article>
              <h3>20. Lei aplicável e resolução de conflitos</h3>
              <p>
                O contrato rege-se pela legislação aplicável na República
                Democrática de São Tomé e Príncipe. As partes procurarão
                resolver qualquer divergência de forma amigável antes de
                recorrer às entidades ou tribunais competentes.
              </p>
            </article>

            <article>
              <h3>21. Integração documental</h3>
              <p>
                Fazem parte deste contrato os dados da reserva, identificação
                dos condutores, condições comerciais, registos de entrega
                e devolução, observações, danos e demais documentos
                expressamente associados à reserva.
              </p>
            </article>
          </div>
        </section>

        <section className="rental-sheet-acceptance">
          <h2>Declaração de entrega e aceitação</h2>

          <p>
            O cliente declara que recebeu ou receberá a viatura
            identificada nesta ficha nas condições registadas pela
            equipa 7Go e confirma que os dados da reserva, modalidade,
            franquia e caução apresentados neste documento correspondem
            às condições do aluguer.
          </p>

          <p>
            Na devolução, o estado da viatura poderá ser comparado com
            o registo de entrega. Quilometragem, combustível,
            observações e eventuais novos danos serão registados na
            ficha da reserva.
          </p>

          <p>
            O cliente declara que leu e compreendeu as condições gerais,
            recebeu oportunidade para esclarecer dúvidas e aceita os
            dados, valores, responsabilidades e registos apresentados
            neste documento.
          </p>

          <div className="rental-sheet-acceptance-fields">
            <div>
              <span>Local</span>
              <strong>São Tomé</strong>
            </div>

            <div>
              <span>Data</span>
              <strong className="rental-sheet-blank-field">
                &nbsp;
              </strong>
            </div>

            <div>
              <span>Hora</span>
              <strong className="rental-sheet-blank-field">
                &nbsp;
              </strong>
            </div>
          </div>
        </section>

        <section className="rental-sheet-section rental-sheet-signatures">
          <div>
            <span>Assinatura e carimbo da locadora</span>
            <div className="rental-sheet-signature-line" />

            <small>
              Nome do representante:
              __________________________________
            </small>
          </div>

          <div>
            <span>Assinatura do cliente / condutor principal</span>
            <div className="rental-sheet-signature-line" />

            <small>
              Nome:
              __________________________________
            </small>
          </div>

          {booking.driverDetails?.secondDriverEnabled && (
            <div>
              <span>Assinatura do segundo condutor</span>
              <div className="rental-sheet-signature-line" />

              <small>
                Nome:
                __________________________________
              </small>
            </div>
          )}
        </section>

        <footer className="rental-sheet-footer">
          <strong>7Go — Drive your way</strong>
          <p>São Tomé e Príncipe</p>
          <small>
            Contrato / ficha operacional associado à reserva{" "}
            {booking.reference || booking.id}. Documento gerado a
            partir dos dados registados no sistema 7Go.
          </small>
        </footer>
      </article>
    </main>
  );
}
