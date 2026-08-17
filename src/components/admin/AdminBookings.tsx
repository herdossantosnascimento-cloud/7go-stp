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
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import { auth, db, storage } from "@/lib/firebase/client";

import AdminInspectionPanel from "./AdminInspectionPanel";
import styles from "./AdminBookings.module.css";

const ADMIN_EMAIL = "her.dos.santos.nascimento@gmail.com";

type AdminRole = "admin" | "staff";

function removeUndefinedValues<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedValues(item)) as T;
  }

  if (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefinedValues(item)]),
    ) as T;
  }

  return value;
}

type BookingStatus =
  "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
type FilterStatus = "all" | BookingStatus;
type PaymentStatus = "pending" | "partial" | "paid";
type DepositStatus = "pending" | "received" | "returned" | "retained";
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

type VehicleInspection = {
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
  damageZones?: Array<{
    id: string;
    x: number;
    y: number;
    description: string;
    severity: "light" | "medium" | "severe";
    createdAt?: string;
  }>;
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
  pickupTime?: string;
  pickupAt?: unknown;
  returnDate?: string;
  returnTime?: string;
  returnAt?: unknown;
  rentalHours?: number;
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
  customerId?: string;
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

function normalisePhone(phone = "") {
  return phone.replace(/[^\d]/g, "");
}

function getAdminCarImage(booking: Booking) {
  const vehicle = `${booking.carBrand ?? ""} ${booking.carModel ?? ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const imageMap: Array<[string[], string]> = [
    [["ford", "kuga"], "/images/cars/ford-kuga-2010.png"],
    [["toyota", "rav4"], "/images/cars/toyota-rav4-hybrid-2024.png"],
    [["daihatsu", "terios"], "/images/cars/daihatsu-terios-2010.png"],
    [["honda", "cr-v"], "/images/cars/honda-crv.png"],
    [["honda", "crv"], "/images/cars/honda-crv.png"],
    [["honda", "hr-v"], "/images/cars/honda-hrv.png"],
    [["honda", "hrv"], "/images/cars/honda-hrv.png"],
    [["hyundai", "tucson"], "/images/cars/hyundai-tucson.png"],
    [["mitsubishi", "pajero"], "/images/cars/mitsubishi-pajero.png"],
    [["nissan", "qashqai"], "/images/cars/nissan-qashqai.png"],
    [["suzuki", "jimny"], "/images/cars/suzuki-jimny.png"],
    [["toyota", "hilux"], "/images/cars/toyota-hilux.png"],
    [["toyota", "urban cruiser"], "/images/cars/toyota-urban-cruiser.png"],
    [["toyota", "prado txl"], "/images/cars/toyota-prado-txl.png"],
    [
      ["toyota", "land cruiser prado"],
      "/images/cars/toyota-land-cruiser-prado-2006.png",
    ],
    [["toyota", "prado"], "/images/cars/toyota-prado.png"],
  ];

  const match = imageMap.find(([terms]) =>
    terms.every((term) => vehicle.includes(term)),
  );

  return match?.[1] ?? "/images/7go-icon.png";
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

function createBookingDateTime(date?: string, time?: string) {
  if (!date) return null;
  const value = new Date(`${date}T${time || "00:00"}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function formatBookingDateTime(date?: string, time?: string) {
  if (!date) return "Sem data";
  return `${date}${time ? ` às ${time}` : ""}`;
}

function buildBookingMessage(booking: Booking) {
  return `Pedido 7Go STP

Referência: ${booking.reference || "Sem referência"}
Estado: ${statusLabel[booking.status || "pending"]}

Carro: ${booking.carBrand || ""} ${booking.carModel || ""}
Período: ${formatBookingDateTime(booking.pickupDate, booking.pickupTime)} → ${formatBookingDateTime(booking.returnDate, booking.returnTime)}
Dias: ${booking.totalDays || "-"}
Modalidade: ${booking.rentalModeLabel || "-"}
Preço base/dia: ${booking.currency || "€"}${booking.pricePerDay || "-"}
Preço final/dia: ${booking.currency || "€"}${booking.dailyRate || booking.pricePerDay || "-"}
Franquia: ${booking.currency || "€"}${booking.appliedExcess ?? booking.normalExcess ?? "-"}
Caução reembolsável: ${booking.currency || "€"}${booking.refundableDeposit ?? "-"}
Total estimado: ${booking.currency || "€"}${booking.estimatedTotal || "-"}

Cliente: ${booking.customerName || ""}
Contacto: ${booking.customerPhone || ""}`;
}

export function AdminBookings({
  authContext = "admin",
}: {
  authContext?: "admin" | "staff";
}) {
  const loginPath = authContext === "staff" ? "/staff/login" : "/admin/login";
  const [user, setUser] = useState<User | null>(null);
  const [adminRole, setAdminRole] = useState<AdminRole | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
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
    return onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setAdminRole(null);
        setBookings([]);
        setLoading(false);
        setAuthChecking(false);

        window.location.replace(loginPath);
        return;
      }

      try {
        let role: AdminRole | null = null;

        if (currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          role = "admin";
        } else {
          const token = await currentUser.getIdTokenResult(true);

          const claimRole = token.claims.role;

          if (claimRole === "admin" || claimRole === "staff") {
            role = claimRole;
          }
        }

        if (!role) {
          setUser(null);
          setAdminRole(null);
          setBookings([]);
          setLoading(false);
          setAuthChecking(false);

          await signOut(auth);

          window.location.replace(loginPath);
          return;
        }

        setAdminRole(role);
        setUser(currentUser);
        setAuthChecking(false);
      } catch (error) {
        console.error("ERRO AO VALIDAR ACESSO ADMIN:", error);

        setUser(null);
        setAdminRole(null);
        setBookings([]);
        setLoading(false);
        setAuthChecking(false);

        await signOut(auth);

        window.location.replace(loginPath);
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
      pending: bookings.filter((booking) => booking.status === "pending")
        .length,
      confirmed: bookings.filter((booking) => booking.status === "confirmed")
        .length,
      inProgress: bookings.filter((booking) => booking.status === "in_progress")
        .length,
      completed: bookings.filter((booking) => booking.status === "completed")
        .length,
      cancelled: bookings.filter((booking) => booking.status === "cancelled")
        .length,
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

  async function updateStatus(id: string, status: BookingStatus) {
    setUpdatingId(id);

    try {
      const booking = bookings.find((item) => item.id === id);

      if (!booking) {
        throw new Error("Reserva não encontrada.");
      }

      const now = new Date();
      const pickupAt = createBookingDateTime(
        booking.pickupDate,
        booking.pickupTime,
      );
      const returnAt = createBookingDateTime(
        booking.returnDate,
        booking.returnTime || "23:59",
      );

      if (status === "in_progress") {
        if (!pickupAt || !returnAt) {
          alert(
            "Não é possível colocar esta reserva em curso porque as datas não estão registadas.",
          );
          return;
        }

        if (now < pickupAt) {
          alert(
            `O aluguer só pode ficar Em curso a partir de ${formatBookingDateTime(booking.pickupDate, booking.pickupTime)}.`,
          );
          return;
        }

        if (now >= returnAt) {
          alert(
            `O período do aluguer terminou em ${formatBookingDateTime(booking.returnDate, booking.returnTime)}. Regista a devolução.`,
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
        if (!returnAt) {
          alert(
            "Não é possível concluir esta reserva porque a data de devolução não está registada.",
          );
          return;
        }

        if (!booking.checkin?.completed) {
          alert(
            "Regista primeiro a devolução do carro antes de concluir a reserva.",
          );
          return;
        }

        if (now < returnAt) {
          const confirmedEarlyReturn = window.confirm(
            `Esta reserva termina em ${formatBookingDateTime(
              booking.returnDate,
              booking.returnTime,
            )}.

Confirma que o cliente devolveu a viatura antecipadamente?

Ao continuar, a reserva será marcada como Concluída e a viatura ficará disponível.`,
          );

          if (!confirmedEarlyReturn) {
            return;
          }
        }
      }

      const lockRef = doc(db, "availabilityLocks", id);

      if (status === "confirmed" || status === "in_progress") {
        if (!booking.carId || !booking.pickupDate || !booking.returnDate) {
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
            pickupTime?: string;
            returnDate?: string;
            returnTime?: string;
          };

          const currentPickup = createBookingDateTime(
            booking.pickupDate,
            booking.pickupTime,
          );
          const currentReturn = createBookingDateTime(
            booking.returnDate,
            booking.returnTime || "23:59",
          );
          const lockedPickup = createBookingDateTime(
            lock.pickupDate,
            lock.pickupTime,
          );
          const lockedReturn = createBookingDateTime(
            lock.returnDate,
            lock.returnTime || "23:59",
          );

          if (
            !currentPickup ||
            !currentReturn ||
            !lockedPickup ||
            !lockedReturn
          )
            return false;
          return currentPickup < lockedReturn && currentReturn > lockedPickup;
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
          pickupTime: booking.pickupTime || "00:00",
          returnDate: booking.returnDate,
          returnTime: booking.returnTime || "23:59",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(lockRef);
      }

      await updateDoc(doc(db, "bookings", id), {
        status,
        ...(status === "completed"
          ? {
              actualReturnAt: serverTimestamp(),
              completedAt: serverTimestamp(),
            }
          : {}),
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

  function updateDriverDraft(booking: Booking, values: Partial<DriverDetails>) {
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
      drivingLicenceNumber: driver.drivingLicenceNumber?.trim() || "",
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

  function getInspectionDraft(booking: Booking, type: "checkout" | "checkin") {
    const key = `${booking.id}-${type}`;

    return (
      inspectionDrafts[key] ??
      booking[type] ?? {
        registrationPlate: booking.carRegistrationPlate ?? "",
        mileage: undefined,
        fuelLevel: "full",
        condition: "good",
        notes: "",
        photoUrls: [],
        inspectionPhotos: {},
        customerSignatureUrl: "",
        customerSignedAt: "",
        staffSignatureUrl: "",
        staffSignedAt: "",
        hasDamage: false,
        damageDescription: "",
        damageAmount: 0,
        damageZones: [],
        fuelCharge: 0,
        cleaningRequired: false,
        cleaningNotes: "",
        cleaningAmount: 0,
        depositReceived: false,
        depositPaymentMethod: undefined,
        depositAmount: Math.max(0, Number(booking.refundableDeposit) || 0),
        depositRefundAmount: 0,
        depositRetainedAmount: 0,
        additionalAmountDue: 0,
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

  async function uploadInspectionSignature(
    booking: Booking,
    type: "checkout" | "checkin",
    signer: "customer" | "staff",
    signatureBlob: Blob,
  ) {
    const inspection = getInspectionDraft(booking, type);
    const fieldName =
      signer === "customer" ? "customerSignatureUrl" : "staffSignatureUrl";
    const signedAtField =
      signer === "customer" ? "customerSignedAt" : "staffSignedAt";

    setUpdatingId(booking.id);

    try {
      const previousUrl = inspection[fieldName];

      if (previousUrl) {
        try {
          await deleteObject(ref(storage, previousUrl));
        } catch {
          // A nova assinatura pode substituir um ficheiro antigo
          // mesmo que o anterior já não exista no Storage.
        }
      }

      const signatureRef = ref(
        storage,
        `booking-inspections/${booking.id}/${type}/signature-${signer}-${Date.now()}.png`,
      );

      await uploadBytes(signatureRef, signatureBlob, {
        contentType: "image/png",
        customMetadata: {
          bookingId: booking.id,
          inspectionType: type,
          signer,
        },
      });

      const signatureUrl = await getDownloadURL(signatureRef);
      const signedAt = new Date().toISOString();

      const signatureUpdate = {
        [fieldName]: signatureUrl,
        [signedAtField]: signedAt,
      };

      updateInspectionDraft(booking, type, signatureUpdate);

      await updateDoc(doc(db, "bookings", booking.id), {
        [`${type}.${fieldName}`]: signatureUrl,
        [`${type}.${signedAtField}`]: signedAt,
        updatedAt: serverTimestamp(),
      });

      alert(
        signer === "customer"
          ? "Assinatura do cliente guardada."
          : "Assinatura do funcionário guardada.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível guardar a assinatura: ${message}`);
      throw error;
    } finally {
      setUpdatingId("");
    }
  }

  async function deleteInspectionSignature(
    booking: Booking,
    type: "checkout" | "checkin",
    signer: "customer" | "staff",
  ) {
    const inspection = getInspectionDraft(booking, type);
    const fieldName =
      signer === "customer" ? "customerSignatureUrl" : "staffSignatureUrl";
    const signedAtField =
      signer === "customer" ? "customerSignedAt" : "staffSignedAt";
    const signatureUrl = inspection[fieldName];

    if (!signatureUrl) {
      return;
    }

    setUpdatingId(booking.id);

    try {
      await deleteObject(ref(storage, signatureUrl));

      const signatureUpdate = {
        [fieldName]: "",
        [signedAtField]: "",
      };

      updateInspectionDraft(booking, type, signatureUpdate);

      await updateDoc(doc(db, "bookings", booking.id), {
        [`${type}.${fieldName}`]: "",
        [`${type}.${signedAtField}`]: "",
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível eliminar a assinatura: ${message}`);
      throw error;
    } finally {
      setUpdatingId("");
    }
  }

  async function uploadInspectionPhotos(
    booking: Booking,
    type: "checkout" | "checkin",
    files: FileList | null,
  ) {
    if (!files || files.length === 0) {
      return;
    }

    const inspection = getInspectionDraft(booking, type);
    const currentPhotoUrls = inspection.photoUrls ?? [];
    const selectedFiles = Array.from(files);

    if (currentPhotoUrls.length + selectedFiles.length > 12) {
      alert(
        `Cada inspeção pode ter no máximo 12 fotografias. Já existem ${currentPhotoUrls.length}.`,
      );
      return;
    }

    const invalidType = selectedFiles.find(
      (file) => !file.type.startsWith("image/"),
    );

    if (invalidType) {
      alert(`O ficheiro "${invalidType.name}" não é uma imagem válida.`);
      return;
    }

    const oversizedFile = selectedFiles.find(
      (file) => file.size > 10 * 1024 * 1024,
    );

    if (oversizedFile) {
      alert(
        `A fotografia "${oversizedFile.name}" ultrapassa o limite de 10 MB.`,
      );
      return;
    }

    setUpdatingId(booking.id);

    try {
      const uploadedUrls: string[] = [];

      for (const file of selectedFiles) {
        const safeName = file.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-zA-Z0-9._-]/g, "-")
          .replace(/-+/g, "-");

        const uniqueId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

        const photoRef = ref(
          storage,
          `booking-inspections/${booking.id}/${type}/${uniqueId}-${safeName}`,
        );

        await uploadBytes(photoRef, file, {
          contentType: file.type,
          customMetadata: {
            bookingId: booking.id,
            inspectionType: type,
          },
        });

        uploadedUrls.push(await getDownloadURL(photoRef));
      }

      updateInspectionDraft(booking, type, {
        photoUrls: [...currentPhotoUrls, ...uploadedUrls],
      });

      alert(
        uploadedUrls.length === 1
          ? "Fotografia adicionada. Guarda a inspeção para confirmar o registo."
          : `${uploadedUrls.length} fotografias adicionadas. Guarda a inspeção para confirmar o registo.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível enviar as fotografias: ${message}`);
    } finally {
      setUpdatingId("");
    }
  }

  async function uploadInspectionPhotoSlot(
    booking: Booking,
    type: "checkout" | "checkin",
    slot: "front" | "rear" | "left" | "right" | "interior" | "dashboard",
    file: File | null,
  ) {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Seleciona uma imagem válida.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("A fotografia ultrapassa o limite de 10 MB.");
      return;
    }

    const inspection = getInspectionDraft(booking, type);

    const safeName = file.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-");

    const uniqueId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setUpdatingId(booking.id);

    try {
      const photoRef = ref(
        storage,
        `booking-inspections/${booking.id}/${type}/slots/${slot}/${uniqueId}-${safeName}`,
      );

      await uploadBytes(photoRef, file, {
        contentType: file.type,
        customMetadata: {
          bookingId: booking.id,
          inspectionType: type,
          photoSlot: slot,
        },
      });

      const url = await getDownloadURL(photoRef);

      const nextInspectionPhotos = {
        ...(inspection.inspectionPhotos ?? {}),
        [slot]: url,
      };

      const nextPhotoUrls = Array.from(
        new Set([...(inspection.photoUrls ?? []), url]),
      );

      updateInspectionDraft(booking, type, {
        inspectionPhotos: nextInspectionPhotos,
        photoUrls: nextPhotoUrls,
      });

      await updateDoc(doc(db, "bookings", booking.id), {
        [`${type}.inspectionPhotos.${slot}`]: url,
        [`${type}.photoUrls`]: nextPhotoUrls,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível guardar a fotografia: ${message}`);
    } finally {
      setUpdatingId("");
    }
  }

  async function deleteInspectionPhoto(
    booking: Booking,
    type: "checkout" | "checkin",
    photoUrl: string,
  ) {
    const confirmed = window.confirm(
      "Pretendes eliminar esta fotografia da inspeção?",
    );

    if (!confirmed) {
      return;
    }

    const inspection = getInspectionDraft(booking, type);

    setUpdatingId(booking.id);

    try {
      await deleteObject(ref(storage, photoUrl));

      const nextPhotoUrls = (inspection.photoUrls ?? []).filter(
        (url) => url !== photoUrl,
      );

      updateInspectionDraft(booking, type, {
        photoUrls: nextPhotoUrls,
      });

      await updateDoc(doc(db, "bookings", booking.id), {
        [`${type}.photoUrls`]: nextPhotoUrls,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível eliminar a fotografia: ${message}`);
    } finally {
      setUpdatingId("");
    }
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
      type === "checkout" &&
      Number(booking.refundableDeposit || 0) > 0 &&
      !inspection.depositReceived
    ) {
      alert("Confirma que a caução foi recebida antes de registar a entrega.");
      return;
    }

    if (
      type === "checkout" &&
      Number(booking.refundableDeposit || 0) > 0 &&
      !inspection.depositPaymentMethod
    ) {
      alert("Seleciona o método de pagamento da caução.");
      return;
    }

    if (!inspection.registrationPlate?.trim()) {
      alert(
        type === "checkout"
          ? "Introduz a matrícula da viatura antes de registar a entrega."
          : "Confirma a matrícula da viatura antes de registar a devolução.",
      );
      return;
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

    if (
      type === "checkin" &&
      inspection.cleaningRequired &&
      !inspection.cleaningNotes?.trim()
    ) {
      alert("Descreve o motivo da limpeza especial.");
      return;
    }

    if (
      type === "checkin" &&
      inspection.cleaningRequired &&
      (!Number.isFinite(Number(inspection.cleaningAmount)) ||
        Number(inspection.cleaningAmount) <= 0)
    ) {
      alert("Indica um valor válido para a limpeza especial.");
      return;
    }

    const returnedWithLessFuel =
      type === "checkin" &&
      Boolean(booking.checkout?.fuelLevel) &&
      Boolean(inspection.fuelLevel) &&
      fuelRank[inspection.fuelLevel!] < fuelRank[booking.checkout!.fuelLevel!];

    if (
      returnedWithLessFuel &&
      (!Number.isFinite(inspection.fuelCharge) ||
        Number(inspection.fuelCharge) <= 0)
    ) {
      alert(
        "O veículo foi devolvido com menos combustível. Introduz o valor a cobrar pela reposição.",
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

    const depositAmount = Math.max(
      0,
      Number(
        booking.checkout?.depositAmount ?? booking.refundableDeposit ?? 0,
      ) || 0,
    );

    const fuelDeduction =
      type === "checkin" ? Math.max(0, Number(inspection.fuelCharge) || 0) : 0;

    const damageDeduction =
      type === "checkin" && inspection.hasDamage
        ? Math.max(0, Number(inspection.damageAmount) || 0)
        : 0;

    const cleaningDeduction =
      type === "checkin" && inspection.cleaningRequired
        ? Math.max(0, Number(inspection.cleaningAmount) || 0)
        : 0;

    const totalDeductions = fuelDeduction + damageDeduction + cleaningDeduction;

    const depositRetainedAmount =
      type === "checkin" ? Math.min(depositAmount, totalDeductions) : 0;

    const depositRefundAmount =
      type === "checkin" ? Math.max(0, depositAmount - totalDeductions) : 0;

    const additionalAmountDue =
      type === "checkin" ? Math.max(0, totalDeductions - depositAmount) : 0;

    const savedInspection: VehicleInspection = {
      registrationPlate: inspection.registrationPlate.trim().toUpperCase(),
      mileage: inspection.mileage,
      fuelLevel: inspection.fuelLevel,
      condition: inspection.condition,
      notes: inspection.notes?.trim() || "",
      photoUrls: inspection.photoUrls ?? [],
      inspectionPhotos: inspection.inspectionPhotos ?? {},
      customerSignatureUrl: inspection.customerSignatureUrl || "",
      customerSignedAt: inspection.customerSignedAt || "",
      staffSignatureUrl: inspection.staffSignatureUrl || "",
      staffSignedAt: inspection.staffSignedAt || "",
      hasDamage: type === "checkin" ? Boolean(inspection.hasDamage) : false,
      damageDescription:
        type === "checkin" && inspection.hasDamage
          ? inspection.damageDescription?.trim() || ""
          : "",
      damageAmount:
        type === "checkin" && inspection.hasDamage
          ? Math.max(0, Number(inspection.damageAmount) || 0)
          : 0,
      damageZones: inspection.hasDamage ? (inspection.damageZones ?? []) : [],
      cleaningRequired:
        type === "checkin" ? Boolean(inspection.cleaningRequired) : false,
      cleaningNotes:
        type === "checkin" && inspection.cleaningRequired
          ? inspection.cleaningNotes?.trim() || ""
          : "",
      cleaningAmount:
        type === "checkin" && inspection.cleaningRequired
          ? Math.max(0, Number(inspection.cleaningAmount) || 0)
          : 0,
      fuelCharge:
        type === "checkin"
          ? Math.max(0, Number(inspection.fuelCharge) || 0)
          : 0,
      depositReceived:
        type === "checkout"
          ? Boolean(inspection.depositReceived)
          : Boolean(booking.checkout?.depositReceived),
      depositPaymentMethod:
        type === "checkout"
          ? inspection.depositPaymentMethod
          : booking.checkout?.depositPaymentMethod,
      depositAmount,
      depositRefundAmount,
      depositRetainedAmount,
      additionalAmountDue,
      completed: true,
    };

    setUpdatingId(booking.id);

    try {
      const bookingUpdate: Record<string, unknown> = {
        [type]: savedInspection,
        updatedAt: serverTimestamp(),
      };

      if (type === "checkout") {
        bookingUpdate.status = "in_progress";

        bookingUpdate.depositStatus =
          depositAmount > 0 ? "received" : "pending";

        bookingUpdate.deposit = {
          amount: depositAmount,
          received: Boolean(inspection.depositReceived),
          paymentMethod: inspection.depositPaymentMethod || "",
          receivedAt: serverTimestamp(),
          status: depositAmount > 0 ? "received" : "pending",
        };
      }

      if (type === "checkin") {
        bookingUpdate.status = "completed";

        bookingUpdate.depositStatus =
          depositRetainedAmount > 0 ? "retained" : "returned";

        bookingUpdate.depositSettlement = {
          depositAmount,
          fuelDeduction,
          damageDeduction,
          totalDeductions,
          retainedAmount: depositRetainedAmount,
          refundAmount: depositRefundAmount,
          additionalAmountDue,
          settledAt: serverTimestamp(),
          status: "settled",
        };
      }

      const cleanBookingUpdate = removeUndefinedValues(bookingUpdate);

      await updateDoc(doc(db, "bookings", booking.id), cleanBookingUpdate);

      const key = `${booking.id}-${type}`;

      setInspectionDrafts((drafts) => {
        const nextDrafts = { ...drafts };
        delete nextDrafts[key];
        return nextDrafts;
      });

      if (type === "checkin") {
        let finalSheetNotice = "";

        try {
          if (!user) {
            throw new Error("Sessão de Admin não disponível.");
          }

          const token = await user.getIdToken();

          const response = await fetch("/api/admin/send-final-rental-sheet", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              bookingId: booking.id,
            }),
          });

          const result = (await response.json()) as {
            error?: string;
            sentTo?: string;
          };

          if (!response.ok) {
            throw new Error(
              result.error || "Não foi possível enviar a ficha final.",
            );
          }

          finalSheetNotice = `\n\n✓ Ficha final enviada para: ${
            result.sentTo || booking.customerEmail || "cliente"
          }`;
        } catch (emailError) {
          const emailMessage =
            emailError instanceof Error
              ? emailError.message
              : "Erro desconhecido.";

          finalSheetNotice =
            "\n\n⚠ A devolução ficou concluída, " +
            "mas a ficha final não foi enviada. " +
            `Podes reenviar pela ficha da reserva.\n${emailMessage}`;
        }

        alert("Devolução do carro registada." + finalSheetNotice);
      } else {
        alert("Entrega do carro registada.");
      }
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
            pickupTime: booking.pickupTime || "",
            returnDate: booking.returnDate || "",
            returnTime: booking.returnTime || "",
            rentalHours: booking.rentalHours ?? 0,
            totalDays: booking.totalDays ?? 0,
            rentalModeLabel: booking.rentalModeLabel || "",
            pricePerDay: booking.pricePerDay ?? 0,
            premiumPricePerDay: booking.premiumPricePerDay ?? 0,
            dailyRate: booking.dailyRate ?? booking.pricePerDay ?? 0,
            normalExcess: booking.normalExcess ?? 0,
            appliedExcess: booking.appliedExcess ?? booking.normalExcess ?? 0,
            refundableDeposit: booking.refundableDeposit ?? 0,
            estimatedTotal: booking.estimatedTotal ?? 0,
            currency: booking.currency || "€",
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

  if (authChecking || !user || !adminRole) {
    return (
      <main className="site">
        <section className="admin-login">
          <p>A verificar acesso...</p>
        </section>
      </main>
    );
  }

  return (
    <main className="site">
      <section className="admin-page">
        <div className="admin-top">
          <div>
            <p className="eyebrow">
              {adminRole === "admin" ? "Admin 7Go" : "Funcionário 7Go"}
            </p>
            <h1>Reservas</h1>
          </div>

          <div className="admin-top-actions">
            {adminRole === "admin" && (
              <button type="button" onClick={syncPublicStatuses}>
                Sincronizar reservas
              </button>
            )}

            <button type="button" onClick={() => signOut(auth)}>
              Sair
            </button>
          </div>
        </div>

        <div className="admin-stats">
          <article>
            <span>Total</span>
            <strong>{stats.total}</strong>
          </article>
          <article>
            <span>Pendentes</span>
            <strong>{stats.pending}</strong>
          </article>
          <article>
            <span>Confirmadas</span>
            <strong>{stats.confirmed}</strong>
          </article>
          <article>
            <span>Em curso</span>
            <strong>{stats.inProgress}</strong>
          </article>
          <article>
            <span>Concluídas</span>
            <strong>{stats.completed}</strong>
          </article>
          <article>
            <span>Canceladas</span>
            <strong>{stats.cancelled}</strong>
          </article>
          {adminRole === "admin" && (
            <article>
              <span>Valor estimado</span>
              <strong>£{stats.estimated}</strong>
            </article>
          )}
        </div>

        <div className="admin-filters">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar por referência, cliente, carro ou contacto..."
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterStatus)}
          >
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
                <article
                  key={booking.id}
                  className={`admin-booking-card ${styles.bookingCard}`}
                >
                  <div className={`admin-booking-main ${styles.bookingMain}`}>
                    <section className="admin-reservation-hero">
                      <div className="admin-reservation-car">
                        <div className="admin-reservation-car-image">
                          <img
                            src={getAdminCarImage(booking)}
                            alt={`${booking.carBrand ?? ""} ${
                              booking.carModel ?? ""
                            }`}
                          />

                          <span className="admin-reservation-car-year">
                            {booking.carYear || "7GO"}
                          </span>
                        </div>

                        <div className="admin-reservation-car-caption">
                          <span>Veículo reservado</span>

                          <strong>
                            {booking.carBrand || "Veículo"}{" "}
                            {booking.carModel || ""}
                          </strong>

                          <small>
                            {booking.carRegistrationPlate ||
                              "Matrícula não registada"}
                          </small>
                        </div>
                      </div>

                      <div className="admin-reservation-information">
                        <div className="admin-reservation-heading">
                          <div>
                            <span className="admin-reservation-eyebrow">
                              Reserva
                            </span>

                            <h2>{booking.reference || "Sem referência"}</h2>
                          </div>

                          <small
                            className={`admin-reservation-status ${statusClass[status]}`}
                          >
                            {statusLabel[status]}
                          </small>
                        </div>

                        <div className="admin-reservation-data-grid">
                          <div>
                            <span>Cliente</span>
                            <strong>
                              {booking.customerName || "Não informado"}
                            </strong>
                          </div>

                          <div>
                            <span>Email</span>
                            <strong>
                              {booking.customerEmail || "Não informado"}
                            </strong>
                          </div>

                          <div>
                            <span>Contacto</span>
                            <strong>
                              {booking.customerPhone || "Não informado"}
                            </strong>
                          </div>

                          <div>
                            <span>Matrícula</span>
                            <strong>
                              {booking.carRegistrationPlate || "Não registada"}
                            </strong>
                          </div>

                          <div className="admin-reservation-period">
                            <span>Período do aluguer</span>

                            <strong>
                              {formatBookingDateTime(
                                booking.pickupDate,
                                booking.pickupTime,
                              )}{" "}
                              →{" "}
                              {formatBookingDateTime(
                                booking.returnDate,
                                booking.returnTime,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Duração</span>
                            <strong>
                              {booking.totalDays || 0}{" "}
                              {booking.totalDays === 1 ? "dia" : "dias"}
                            </strong>
                          </div>
                        </div>

                        <div className="admin-booking-actions">
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            WhatsApp
                          </a>

                          <button
                            type="button"
                            onClick={() => copyBooking(booking)}
                          >
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

                      <aside className="admin-reservation-finance">
                        <div className="admin-reservation-finance-card">
                          <span>Estado do pagamento</span>

                          <strong>
                            {
                              paymentStatusLabel[
                                booking.paymentStatus ?? "pending"
                              ]
                            }
                          </strong>
                        </div>

                        <div className="admin-reservation-finance-card">
                          <span>Estado da caução</span>

                          <strong>
                            {
                              depositStatusLabel[
                                booking.depositStatus ?? "pending"
                              ]
                            }
                          </strong>
                        </div>

                        <div className="admin-reservation-finance-card admin-reservation-total">
                          <span>Total da reserva</span>

                          <strong>
                            {booking.currency || "€"}{" "}
                            {Number(booking.estimatedTotal || 0).toFixed(2)}
                          </strong>
                        </div>
                      </aside>
                    </section>
                  </div>

                  <div
                    className={`admin-booking-middle ${styles.bookingMiddle}`}
                  >
                    <p>
                      <strong>Dias:</strong> {booking.totalDays}
                    </p>

                    <p>
                      <strong>Modalidade:</strong> {booking.rentalModeLabel}
                    </p>

                    <p>
                      <strong>Email:</strong>{" "}
                      {booking.customerEmail || "Não informado"}
                    </p>

                    <p>
                      <strong>Contacto:</strong> {booking.customerPhone}
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
                                checked={Boolean(driver.secondDriverEnabled)}
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
                          {
                            paymentStatusLabel[
                              booking.paymentStatus ?? "pending"
                            ]
                          }
                        </strong>
                      </span>

                      <span>
                        Caução:{" "}
                        <strong>
                          {
                            depositStatusLabel[
                              booking.depositStatus ?? "pending"
                            ]
                          }
                        </strong>
                      </span>
                    </div>

                    {adminRole === "admin" && (
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
                    )}
                  </div>

                  <div className={`admin-booking-side ${styles.bookingSide}`}>
                    <strong>
                      {booking.currency}
                      {booking.estimatedTotal}
                    </strong>

                    {(status === "confirmed" ||
                      status === "in_progress" ||
                      status === "completed") && (
                      <AdminInspectionPanel
                        booking={booking}
                        status={status}
                        updatingId={updatingId}
                        getInspectionDraft={getInspectionDraft}
                        updateInspectionDraft={updateInspectionDraft}
                        uploadInspectionPhotos={uploadInspectionPhotos}
                        deleteInspectionPhoto={deleteInspectionPhoto}
                        uploadInspectionSignature={uploadInspectionSignature}
                        deleteInspectionSignature={deleteInspectionSignature}
                        saveInspection={saveInspection}
                      />
                    )}
                    <select
                      value={status}
                      disabled={updatingId === booking.id}
                      onChange={(e) =>
                        updateStatus(
                          booking.id,
                          e.target.value as BookingStatus,
                        )
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
