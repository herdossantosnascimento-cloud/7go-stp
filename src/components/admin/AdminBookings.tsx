"use client";

import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase/client";

type BookingStatus =
  | "pending"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";
type FilterStatus = "all" | BookingStatus;
type PaymentStatus = "pending" | "partial" | "paid";
type DepositStatus = "pending" | "received" | "returned" | "retained";
type FuelLevel = "empty" | "quarter" | "half" | "three_quarters" | "full";
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
  customerEmail?: string;
  message?: string;
  paymentStatus?: PaymentStatus;
  depositStatus?: DepositStatus;
  internalNotes?: string;
  driverDetails?: DriverDetails;
  checkout?: VehicleInspection;
  checkin?: VehicleInspection;
};

const statusLabel: Record<BookingStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  in_progress: "Em curso",
  completed: "Concluída",
  cancelled: "Cancelada",
};

const statusClass: Record<BookingStatus, string> = {
  pending: "status-pending",
  confirmed: "status-confirmed",
  in_progress: "status-confirmed",
  completed: "status-confirmed",
  cancelled: "status-cancelled",
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

function normalisePhone(phone = "") {
  return phone.replace(/[^\d]/g, "");
}

function getSaoTomeToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Sao_Tome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return new Date().toISOString().split("T")[0];
  }

  return `${year}-${month}-${day}`;
}

function buildBookingMessage(booking: Booking) {
  return `Pedido 7Go STP

Referência: ${booking.reference || "Sem referência"}
Estado: ${statusLabel[booking.status || "pending"]}

Carro: ${booking.carBrand || ""} ${booking.carModel || ""}
Datas: ${booking.pickupDate || ""} → ${booking.returnDate || ""}
Dias: ${booking.totalDays || "-"}
Modalidade: ${booking.rentalModeLabel || "-"}
Preço base/dia: ${booking.currency || "£"}${booking.pricePerDay || "-"}
Preço final/dia: ${booking.currency || "£"}${booking.dailyRate || booking.pricePerDay || "-"}
Franquia: ${booking.currency || "£"}${booking.appliedExcess ?? booking.normalExcess ?? "-"}
Caução reembolsável: ${booking.currency || "£"}${booking.refundableDeposit ?? "-"}
Total estimado: ${booking.currency || "£"}${booking.estimatedTotal || "-"}

Cliente: ${booking.customerName || ""}
Contacto: ${booking.customerPhone || ""}`;
}

export function AdminBookings() {
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("her.dos.santos.nascimento@gmail.com");
  const [password, setPassword] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [notesDraft, setNotesDraft] = useState<Record<string, string>>({});
  const [inspectionDrafts, setInspectionDrafts] = useState<
    Record<string, VehicleInspection>
  >({});
  const [driverDrafts, setDriverDrafts] = useState<
    Record<string, DriverDetails>
  >({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setBookings([]);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const bookingsQuery = query(
      collection(db, "bookings"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        setBookings(
          snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          })) as Booking[],
        );
        setLoading(false);
      },
      (error) => {
        console.error("ERRO AO CARREGAR RESERVAS:", error);
        alert(`Erro ao carregar reservas: ${error.message}`);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [user]);

  const stats = useMemo(() => {
    return {
      total: bookings.length,
      pending: bookings.filter((booking) => booking.status === "pending").length,
      confirmed: bookings.filter((booking) => booking.status === "confirmed").length,
      inProgress: bookings.filter((booking) => booking.status === "in_progress").length,
      completed: bookings.filter((booking) => booking.status === "completed").length,
      cancelled: bookings.filter((booking) => booking.status === "cancelled").length,
      estimated: bookings.reduce(
        (sum, booking) => sum + (booking.estimatedTotal || 0),
        0,
      ),
    };
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const term = search.trim().toLowerCase();

    return bookings.filter((booking) => {
      const matchesFilter = filter === "all" || booking.status === filter;
      const searchable = [
        booking.reference,
        booking.customerName,
        booking.customerPhone,
        booking.customerEmail,
        booking.carBrand,
        booking.carModel,
      ]
        .join(" ")
        .toLowerCase();

      return matchesFilter && searchable.includes(term);
    });
  }, [bookings, filter, search]);

  async function login() {
    setAuthLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";
      alert(`Erro Firebase: ${message}`);
    } finally {
      setAuthLoading(false);
    }
  }

  async function updateStatus(id: string, status: BookingStatus) {
    setUpdatingId(id);

    try {
      const booking = bookings.find((item) => item.id === id);

      if (!booking) {
        throw new Error("Reserva não encontrada.");
      }

      const today = getSaoTomeToday();

      if (status === "in_progress") {
        if (!booking.pickupDate || !booking.returnDate) {
          alert(
            "Não é possível colocar esta reserva em curso porque as datas não estão registadas.",
          );
          return;
        }

        if (today < booking.pickupDate) {
          alert(
            `O aluguer só pode ficar Em curso a partir de ${booking.pickupDate}.`,
          );
          return;
        }

        if (today >= booking.returnDate) {
          alert(
            `O período do aluguer terminou em ${booking.returnDate}. Marca a reserva como Concluída.`,
          );
          return;
        }

        if (!booking.checkout?.completed) {
          alert(
            "Regista primeiro a entrega do carro antes de colocar o aluguer Em curso.",
          );
          return;
        }
      }

      if (status === "completed") {
        if (!booking.returnDate) {
          alert(
            "Não é possível concluir esta reserva porque a data de devolução não está registada.",
          );
          return;
        }

        if (today < booking.returnDate) {
          alert(
            `Esta reserva ainda está dentro do período de aluguer. Só pode ser concluída em ${booking.returnDate} ou depois.`,
          );
          return;
        }

        if (!booking.checkin?.completed) {
          alert(
            "Regista primeiro a devolução do carro antes de concluir a reserva.",
          );
          return;
        }
      }

      const lockRef = doc(db, "availabilityLocks", id);

      if (status === "confirmed" || status === "in_progress") {
        if (
          !booking.carId ||
          !booking.pickupDate ||
          !booking.returnDate
        ) {
          throw new Error("A reserva não tem carro ou datas válidas.");
        }

        const locksSnapshot = await getDocs(
          query(
            collection(db, "availabilityLocks"),
            where("carId", "==", booking.carId),
          ),
        );

        const hasConflict = locksSnapshot.docs.some((item) => {
          if (item.id === id) return false;

          const lock = item.data() as {
            pickupDate?: string;
            returnDate?: string;
          };

          if (!lock.pickupDate || !lock.returnDate) return false;

          return (
            booking.pickupDate! < lock.returnDate &&
            booking.returnDate! > lock.pickupDate
          );
        });

        if (hasConflict) {
          alert(
            "Não podes confirmar esta reserva. O carro já está confirmado para datas sobrepostas.",
          );
          return;
        }

        await setDoc(lockRef, {
          bookingId: id,
          reference: booking.reference || "",
          carId: booking.carId,
          pickupDate: booking.pickupDate,
          returnDate: booking.returnDate,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(lockRef);
      }

      await updateDoc(doc(db, "bookings", id), {
        status,
        updatedAt: serverTimestamp(),
      });

      if (booking.reference) {
        await updateDoc(doc(db, "bookingStatus", booking.reference), {
          status,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível atualizar a reserva: ${message}`);
    } finally {
      setUpdatingId("");
    }
  }


  async function updateOperationalField(
    booking: Booking,
    field: "paymentStatus" | "depositStatus",
    value: PaymentStatus | DepositStatus,
  ) {
    setUpdatingId(booking.id);

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        [field]: value,
        updatedAt: serverTimestamp(),
      });

      if (booking.reference) {
        await setDoc(
          doc(db, "bookingStatus", booking.reference),
          {
            [field]: value,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível atualizar: ${message}`);
    } finally {
      setUpdatingId("");
    }
  }

  async function saveInternalNotes(booking: Booking) {
    setUpdatingId(booking.id);

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        internalNotes: notesDraft[booking.id] ?? booking.internalNotes ?? "",
        updatedAt: serverTimestamp(),
      });

      alert("Observações internas guardadas.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível guardar as observações: ${message}`);
    } finally {
      setUpdatingId("");
    }
  }

  function getDriverDraft(booking: Booking) {
    return (
      driverDrafts[booking.id] ??
      booking.driverDetails ?? {
        documentNumber: "",
        drivingLicenceNumber: "",
        drivingLicenceExpiry: "",
        nationality: "",
        address: "",
        secondDriverEnabled: false,
        secondDriverName: "",
        secondDriverDocumentNumber: "",
        secondDriverLicenceNumber: "",
        secondDriverLicenceExpiry: "",
      }
    );
  }

  function updateDriverDraft(
    booking: Booking,
    values: Partial<DriverDetails>,
  ) {
    const current = getDriverDraft(booking);

    setDriverDrafts((drafts) => ({
      ...drafts,
      [booking.id]: {
        ...current,
        ...values,
      },
    }));
  }

  function validateDriverDetails(driver: DriverDetails) {
    if (!driver.documentNumber?.trim()) {
      return "Introduz o número do documento ou passaporte.";
    }

    if (!driver.drivingLicenceNumber?.trim()) {
      return "Introduz o número da carta de condução.";
    }

    if (!driver.drivingLicenceExpiry) {
      return "Introduz a validade da carta de condução.";
    }

    if (!driver.nationality?.trim()) {
      return "Introduz a nacionalidade do condutor.";
    }

    if (!driver.address?.trim()) {
      return "Introduz a morada do condutor.";
    }

    if (
      driver.secondDriverEnabled &&
      (!driver.secondDriverName?.trim() ||
        !driver.secondDriverDocumentNumber?.trim() ||
        !driver.secondDriverLicenceNumber?.trim() ||
        !driver.secondDriverLicenceExpiry)
    ) {
      return "Preenche todos os dados do segundo condutor.";
    }

    return "";
  }

  async function saveDriverDetails(booking: Booking) {
    const driver = getDriverDraft(booking);
    const validationError = validateDriverDetails(driver);

    if (validationError) {
      alert(validationError);
      return;
    }

    const savedDriver: DriverDetails = {
      documentNumber: driver.documentNumber?.trim() || "",
      drivingLicenceNumber:
        driver.drivingLicenceNumber?.trim() || "",
      drivingLicenceExpiry: driver.drivingLicenceExpiry || "",
      nationality: driver.nationality?.trim() || "",
      address: driver.address?.trim() || "",
      secondDriverEnabled: Boolean(driver.secondDriverEnabled),
      secondDriverName: driver.secondDriverEnabled
        ? driver.secondDriverName?.trim() || ""
        : "",
      secondDriverDocumentNumber: driver.secondDriverEnabled
        ? driver.secondDriverDocumentNumber?.trim() || ""
        : "",
      secondDriverLicenceNumber: driver.secondDriverEnabled
        ? driver.secondDriverLicenceNumber?.trim() || ""
        : "",
      secondDriverLicenceExpiry: driver.secondDriverEnabled
        ? driver.secondDriverLicenceExpiry || ""
        : "",
    };

    setUpdatingId(booking.id);

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        driverDetails: savedDriver,
        updatedAt: serverTimestamp(),
      });

      setDriverDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[booking.id];
        return nextDrafts;
      });

      alert("Dados do condutor guardados.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível guardar o condutor: ${message}`);
    } finally {
      setUpdatingId("");
    }
  }

  function getInspectionDraft(
    booking: Booking,
    type: "checkout" | "checkin",
  ) {
    const key = `${booking.id}-${type}`;

    return (
      inspectionDrafts[key] ??
      booking[type] ?? {
        mileage: undefined,
        fuelLevel: "full",
        condition: "good",
        notes: "",
        hasDamage: false,
        damageDescription: "",
        damageAmount: 0,
        completed: false,
      }
    );
  }

  function updateInspectionDraft(
    booking: Booking,
    type: "checkout" | "checkin",
    values: Partial<VehicleInspection>,
  ) {
    const key = `${booking.id}-${type}`;
    const current = getInspectionDraft(booking, type);

    setInspectionDrafts((drafts) => ({
      ...drafts,
      [key]: {
        ...current,
        ...values,
      },
    }));
  }

  async function saveInspection(
    booking: Booking,
    type: "checkout" | "checkin",
  ) {
    const inspection = getInspectionDraft(booking, type);

    if (type === "checkout") {
      const driver = booking.driverDetails;
      const driverValidationError = driver
        ? validateDriverDetails(driver)
        : "Regista e guarda primeiro os dados do condutor.";

      if (driverValidationError) {
        alert(driverValidationError);
        return;
      }
    }

    if (
      inspection.mileage == null ||
      !Number.isFinite(inspection.mileage) ||
      inspection.mileage < 0
    ) {
      alert("Introduz uma quilometragem válida.");
      return;
    }

    if (!inspection.fuelLevel) {
      alert("Seleciona o nível de combustível.");
      return;
    }

    if (!inspection.condition) {
      alert("Seleciona o estado do carro.");
      return;
    }

    if (
      type === "checkin" &&
      booking.checkout?.mileage != null &&
      inspection.mileage < booking.checkout.mileage
    ) {
      alert(
        `A quilometragem de devolução não pode ser inferior à quilometragem de entrega (${booking.checkout.mileage} km).`,
      );
      return;
    }

    if (
      type === "checkin" &&
      inspection.hasDamage &&
      !inspection.damageDescription?.trim()
    ) {
      alert("Descreve os danos registados na devolução.");
      return;
    }

    const savedInspection: VehicleInspection = {
      mileage: inspection.mileage,
      fuelLevel: inspection.fuelLevel,
      condition: inspection.condition,
      notes: inspection.notes?.trim() || "",
      hasDamage: type === "checkin" ? Boolean(inspection.hasDamage) : false,
      damageDescription:
        type === "checkin" && inspection.hasDamage
          ? inspection.damageDescription?.trim() || ""
          : "",
      damageAmount:
        type === "checkin" && inspection.hasDamage
          ? Math.max(0, Number(inspection.damageAmount) || 0)
          : 0,
      completed: true,
    };

    setUpdatingId(booking.id);

    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        [type]: savedInspection,
        updatedAt: serverTimestamp(),
      });

      const key = `${booking.id}-${type}`;

      setInspectionDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[key];
        return nextDrafts;
      });

      alert(
        type === "checkout"
          ? "Entrega do carro registada."
          : "Devolução do carro registada.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível guardar o registo: ${message}`);
    } finally {
      setUpdatingId("");
    }
  }

  async function syncPublicStatuses() {
    try {
      for (const booking of bookings) {
        if (!booking.reference) continue;

        await setDoc(
          doc(db, "bookingStatus", booking.reference),
          {
            reference: booking.reference,
            status: booking.status || "pending",
            carId: booking.carId || "",
            carBrand: booking.carBrand || "",
            carModel: booking.carModel || "",
            pickupDate: booking.pickupDate || "",
            returnDate: booking.returnDate || "",
            totalDays: booking.totalDays ?? 0,
            rentalModeLabel: booking.rentalModeLabel || "",
            pricePerDay: booking.pricePerDay ?? 0,
            premiumPricePerDay: booking.premiumPricePerDay ?? 0,
            dailyRate: booking.dailyRate ?? booking.pricePerDay ?? 0,
            normalExcess: booking.normalExcess ?? 0,
            appliedExcess:
              booking.appliedExcess ?? booking.normalExcess ?? 0,
            refundableDeposit: booking.refundableDeposit ?? 0,
            estimatedTotal: booking.estimatedTotal ?? 0,
            currency: booking.currency || "£",
            paymentStatus: booking.paymentStatus ?? "pending",
            depositStatus: booking.depositStatus ?? "pending",
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      alert("Reservas sincronizadas com Minha reserva.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Erro ao sincronizar reservas: ${message}`);
    }
  }

  async function copyBooking(booking: Booking) {
    await navigator.clipboard.writeText(buildBookingMessage(booking));
    alert("Pedido copiado.");
  }

  if (!user) {
    return (
      <main className="site">
        <section className="admin-login">
          <p className="eyebrow">Admin 7Go</p>
          <h1>Entrar no painel de reservas.</h1>

          <div className="admin-login-card">
            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <button onClick={login} disabled={authLoading}>
              {authLoading ? "A entrar..." : "Entrar"}
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="site">
      <section className="admin-page">
        <div className="admin-top">
          <div>
            <p className="eyebrow">Admin 7Go</p>
            <h1>Reservas</h1>
          </div>

          <div className="admin-top-actions">
            <button type="button" onClick={syncPublicStatuses}>
              Sincronizar reservas
            </button>

            <button type="button" onClick={() => signOut(auth)}>
              Sair
            </button>
          </div>
        </div>

        <div className="admin-stats">
          <article><span>Total</span><strong>{stats.total}</strong></article>
          <article><span>Pendentes</span><strong>{stats.pending}</strong></article>
          <article><span>Confirmadas</span><strong>{stats.confirmed}</strong></article>
          <article><span>Em curso</span><strong>{stats.inProgress}</strong></article>
          <article><span>Concluídas</span><strong>{stats.completed}</strong></article>
          <article><span>Canceladas</span><strong>{stats.cancelled}</strong></article>
          <article><span>Valor estimado</span><strong>£{stats.estimated}</strong></article>
        </div>

        <div className="admin-filters">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por referência, cliente, carro ou contacto..."
          />

          <select value={filter} onChange={(e) => setFilter(e.target.value as FilterStatus)}>
            <option value="all">Todas</option>
            <option value="pending">Pendentes</option>
            <option value="confirmed">Confirmadas</option>
            <option value="in_progress">Em curso</option>
            <option value="completed">Concluídas</option>
            <option value="cancelled">Canceladas</option>
          </select>
        </div>

        {loading ? (
          <p>A carregar reservas...</p>
        ) : (
          <div className="admin-bookings">
            {filteredBookings.map((booking) => {
              const status = booking.status || "pending";
              const phone = normalisePhone(booking.customerPhone);
              const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(
                buildBookingMessage(booking),
              )}`;

              return (
                <article key={booking.id} className="admin-booking-card">
                  <div className="admin-booking-main">
                    <div className="admin-booking-labels">
                      <span>{booking.reference || "Sem referência"}</span>
                      <small className={statusClass[status]}>{statusLabel[status]}</small>
                    </div>

                    <h2>{booking.carBrand} {booking.carModel}</h2>

                    <p><strong>Datas:</strong> {booking.pickupDate} → {booking.returnDate}</p>
                    <p><strong>Cliente:</strong> {booking.customerName}</p>
                    <p>
                      <strong>Preço base/dia:</strong>{" "}
                      {booking.currency}
                      {booking.pricePerDay}
                    </p>

                    <p>
                      <strong>Preço final/dia:</strong>{" "}
                      {booking.currency}
                      {booking.dailyRate || booking.pricePerDay}
                    </p>

                    <p>
                      <strong>Franquia:</strong>{" "}
                      {booking.currency}
                      {booking.appliedExcess ??
                        booking.normalExcess ??
                        "Não registada"}
                    </p>

                    <p>
                      <strong>Caução reembolsável:</strong>{" "}
                      {booking.currency}
                      {booking.refundableDeposit ?? "Não registada"}
                    </p>

                    <div className="admin-booking-actions">
                      <a href={whatsappUrl} target="_blank" rel="noreferrer">
                        Contactar no WhatsApp
                      </a>

                      <button type="button" onClick={() => copyBooking(booking)}>
                        Copiar pedido
                      </button>

                      <a
                        href={`/admin/reservas/${booking.id}/ficha`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ficha de aluguer
                      </a>
                    </div>
                  </div>

                  <div className="admin-booking-middle">
                    <p>
                      <strong>Dias:</strong> {booking.totalDays}
                    </p>

                    <p>
                      <strong>Modalidade:</strong>{" "}
                      {booking.rentalModeLabel}
                    </p>

                    <p>
                      <strong>Email:</strong>{" "}
                      {booking.customerEmail || "Não informado"}
                    </p>

                    <p>
                      <strong>Contacto:</strong>{" "}
                      {booking.customerPhone}
                    </p>

                    <details className="admin-management-panel admin-driver-panel">
                      <summary>Dados do condutor</summary>

                      {(() => {
                        const driver = getDriverDraft(booking);

                        return (
                          <div className="admin-driver-controls">
                            <label>
                              Documento / Passaporte
                              <input
                                type="text"
                                value={driver.documentNumber ?? ""}
                                onChange={(e) =>
                                  updateDriverDraft(booking, {
                                    documentNumber: e.target.value,
                                  })
                                }
                                placeholder="Número do documento"
                              />
                            </label>

                            <label>
                              Carta de condução
                              <input
                                type="text"
                                value={driver.drivingLicenceNumber ?? ""}
                                onChange={(e) =>
                                  updateDriverDraft(booking, {
                                    drivingLicenceNumber: e.target.value,
                                  })
                                }
                                placeholder="Número da carta"
                              />
                            </label>

                            <label>
                              Validade da carta
                              <input
                                type="date"
                                value={driver.drivingLicenceExpiry ?? ""}
                                onChange={(e) =>
                                  updateDriverDraft(booking, {
                                    drivingLicenceExpiry: e.target.value,
                                  })
                                }
                              />
                            </label>

                            <label>
                              Nacionalidade
                              <input
                                type="text"
                                value={driver.nationality ?? ""}
                                onChange={(e) =>
                                  updateDriverDraft(booking, {
                                    nationality: e.target.value,
                                  })
                                }
                                placeholder="Ex.: Portuguesa"
                              />
                            </label>

                            <label className="admin-driver-address">
                              Morada
                              <textarea
                                value={driver.address ?? ""}
                                onChange={(e) =>
                                  updateDriverDraft(booking, {
                                    address: e.target.value,
                                  })
                                }
                                placeholder="Morada completa do condutor"
                              />
                            </label>

                            <label className="admin-driver-check">
                              <input
                                type="checkbox"
                                checked={Boolean(
                                  driver.secondDriverEnabled,
                                )}
                                onChange={(e) =>
                                  updateDriverDraft(booking, {
                                    secondDriverEnabled: e.target.checked,
                                  })
                                }
                              />
                              Adicionar segundo condutor
                            </label>

                            {driver.secondDriverEnabled && (
                              <div className="admin-second-driver">
                                <label>
                                  Nome do segundo condutor
                                  <input
                                    type="text"
                                    value={driver.secondDriverName ?? ""}
                                    onChange={(e) =>
                                      updateDriverDraft(booking, {
                                        secondDriverName: e.target.value,
                                      })
                                    }
                                  />
                                </label>

                                <label>
                                  Documento / Passaporte
                                  <input
                                    type="text"
                                    value={
                                      driver.secondDriverDocumentNumber ?? ""
                                    }
                                    onChange={(e) =>
                                      updateDriverDraft(booking, {
                                        secondDriverDocumentNumber:
                                          e.target.value,
                                      })
                                    }
                                  />
                                </label>

                                <label>
                                  Carta de condução
                                  <input
                                    type="text"
                                    value={
                                      driver.secondDriverLicenceNumber ?? ""
                                    }
                                    onChange={(e) =>
                                      updateDriverDraft(booking, {
                                        secondDriverLicenceNumber:
                                          e.target.value,
                                      })
                                    }
                                  />
                                </label>

                                <label>
                                  Validade da carta
                                  <input
                                    type="date"
                                    value={
                                      driver.secondDriverLicenceExpiry ?? ""
                                    }
                                    onChange={(e) =>
                                      updateDriverDraft(booking, {
                                        secondDriverLicenceExpiry:
                                          e.target.value,
                                      })
                                    }
                                  />
                                </label>
                              </div>
                            )}

                            <button
                              type="button"
                              onClick={() => saveDriverDetails(booking)}
                              disabled={updatingId === booking.id}
                            >
                              Guardar dados do condutor
                            </button>
                          </div>
                        );
                      })()}
                    </details>

                    <div className="admin-operational-summary">
                      <span>
                        Pagamento:{" "}
                        <strong>
                          {paymentStatusLabel[
                            booking.paymentStatus ?? "pending"
                          ]}
                        </strong>
                      </span>

                      <span>
                        Caução:{" "}
                        <strong>
                          {depositStatusLabel[
                            booking.depositStatus ?? "pending"
                          ]}
                        </strong>
                      </span>
                    </div>

                    <details className="admin-management-panel">
                      <summary>Gerir pagamento, caução e notas</summary>

                      <div className="admin-operation-controls">
                        <label>
                          Pagamento
                          <select
                            value={booking.paymentStatus ?? "pending"}
                            disabled={updatingId === booking.id}
                            onChange={(e) =>
                              updateOperationalField(
                                booking,
                                "paymentStatus",
                                e.target.value as PaymentStatus,
                              )
                            }
                          >
                            <option value="pending">
                              {paymentStatusLabel.pending}
                            </option>
                            <option value="partial">
                              {paymentStatusLabel.partial}
                            </option>
                            <option value="paid">
                              {paymentStatusLabel.paid}
                            </option>
                          </select>
                        </label>

                        <label>
                          Caução
                          <select
                            value={booking.depositStatus ?? "pending"}
                            disabled={updatingId === booking.id}
                            onChange={(e) =>
                              updateOperationalField(
                                booking,
                                "depositStatus",
                                e.target.value as DepositStatus,
                              )
                            }
                          >
                            <option value="pending">
                              {depositStatusLabel.pending}
                            </option>
                            <option value="received">
                              {depositStatusLabel.received}
                            </option>
                            <option value="returned">
                              {depositStatusLabel.returned}
                            </option>
                            <option value="retained">
                              {depositStatusLabel.retained}
                            </option>
                          </select>
                        </label>

                        <label className="admin-internal-notes">
                          Observações internas
                          <textarea
                            value={
                              notesDraft[booking.id] ??
                              booking.internalNotes ??
                              ""
                            }
                            onChange={(e) =>
                              setNotesDraft((current) => ({
                                ...current,
                                [booking.id]: e.target.value,
                              }))
                            }
                            placeholder="Notas privadas da equipa 7Go..."
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => saveInternalNotes(booking)}
                          disabled={updatingId === booking.id}
                        >
                          Guardar observações
                        </button>
                      </div>
                    </details>
                  </div>

                  <div className="admin-booking-side">
                    <strong>{booking.currency}{booking.estimatedTotal}</strong>

                    {(status === "confirmed" ||
                      status === "in_progress" ||
                      status === "completed") && (
                      <div className="admin-vehicle-inspections">
                        {(["checkout", "checkin"] as const)
                          .filter(
                            (type) =>
                              type === "checkout" ||
                              status === "in_progress" ||
                              status === "completed",
                          )
                          .map((type) => {
                            const inspection = getInspectionDraft(
                              booking,
                              type,
                            );
                            const isCheckin = type === "checkin";

                            return (
                              <details
                                key={type}
                                className="admin-inspection-panel"
                              >
                                <summary>
                                  <span>
                                    {isCheckin
                                      ? "Devolução do carro"
                                      : "Entrega do carro"}
                                  </span>

                                  <small>
                                    {inspection.completed
                                      ? "Registada"
                                      : "Por registar"}
                                  </small>
                                </summary>

                                <div className="admin-vehicle-inspection">

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

                            <label>
                              Combustível
                              <select
                                value={inspection.fuelLevel ?? "full"}
                                onChange={(e) =>
                                  updateInspectionDraft(booking, type, {
                                    fuelLevel: e.target.value as FuelLevel,
                                  })
                                }
                              >
                                {Object.entries(fuelLevelLabel).map(
                                  ([value, label]) => (
                                    <option key={value} value={value}>
                                      {label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>

                            <label>
                              Estado do carro
                              <select
                                value={inspection.condition ?? "good"}
                                onChange={(e) =>
                                  updateInspectionDraft(booking, type, {
                                    condition:
                                      e.target.value as VehicleCondition,
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

                            {isCheckin && (
                              <>
                                <label className="admin-damage-check">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(inspection.hasDamage)}
                                    onChange={(e) =>
                                      updateInspectionDraft(booking, type, {
                                        hasDamage: e.target.checked,
                                      })
                                    }
                                  />
                                  Foram encontrados novos danos
                                </label>

                                {inspection.hasDamage && (
                                  <>
                                    <label>
                                      Descrição dos danos
                                      <textarea
                                        value={
                                          inspection.damageDescription ?? ""
                                        }
                                        onChange={(e) =>
                                          updateInspectionDraft(
                                            booking,
                                            type,
                                            {
                                              damageDescription:
                                                e.target.value,
                                            },
                                          )
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
                                        value={
                                          inspection.damageAmount ?? 0
                                        }
                                        onChange={(e) =>
                                          updateInspectionDraft(
                                            booking,
                                            type,
                                            {
                                              damageAmount:
                                                Number(e.target.value) || 0,
                                            },
                                          )
                                        }
                                      />
                                    </label>
                                  </>
                                )}
                              </>
                            )}

                            <button
                              type="button"
                              onClick={() =>
                                saveInspection(booking, type)
                              }
                              disabled={updatingId === booking.id}
                            >
                              {inspection.completed
                                ? "Atualizar registo"
                                : isCheckin
                                  ? "Registar devolução"
                                  : "Registar entrega"}
                            </button>
                                </div>
                              </details>
                            );
                          })}
                      </div>
                    )}

                    <select
                      value={status}
                      disabled={updatingId === booking.id}
                      onChange={(e) =>
                        updateStatus(booking.id, e.target.value as BookingStatus)
                      }
                    >
                      <option value="pending">Pendente</option>
                      <option value="confirmed">Confirmada</option>
                      <option value="in_progress">Em curso</option>
                      <option value="completed">Concluída</option>
                      <option value="cancelled">Cancelada</option>
                    </select>

                    {updatingId === booking.id && <small>A atualizar...</small>}
                  </div>
                </article>
              );
            })}

            {filteredBookings.length === 0 && (
              <p>Nenhuma reserva encontrada.</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
