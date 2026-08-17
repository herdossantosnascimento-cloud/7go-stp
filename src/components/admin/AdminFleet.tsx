"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  CarFront,
  Check,
  ChevronDown,
  Fuel,
  Gauge,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Users,
  CalendarDays,
  Camera,
  CircleDollarSign,
  ExternalLink,
  FileText,
  History,
  MapPin,
  TriangleAlert,
  Plus,
  ReceiptText,
  TrendingUp,
  WalletCards,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cars } from "@/data/cars";
import { db } from "@/lib/firebase/client";

type FleetStatus = "available" | "limited" | "booked";

type FleetCar = {
  id: string;
  brand: string;
  model: string;
  year: number;
  category: string;
  image: string;
  seats: number;
  transmission: string;
  fuel: string;
  pricePerDay: number;
  premiumPricePerDay: number;
  normalExcess: number;
  refundableDeposit: number;
  currency: string;
  status: FleetStatus;
  registrationPlate?: string;
  vehicleColor?: string;
  vin?: string;
  insurer?: string;
  insurancePolicyNumber?: string;
  insuranceExpiry?: string;
  lastServiceMileage?: number;
  serviceIntervalKm?: number;
  lastServiceDate?: string;
  serviceNotes?: string;
};

type VehicleHistoryInspection = {
  mileage?: number;
  fuelLevel?: string;
  completed?: boolean;
  hasDamage?: boolean;
  damageDescription?: string;
  damageAmount?: number;
  damageZones?: unknown[];
  photoUrls?: string[];
  cleaningRequired?: boolean;
  cleaningAmount?: number;
  fuelCharge?: number;
};

type VehicleHistoryBooking = {
  id: string;
  reference?: string;
  status?: string;
  carId?: string;
  customerName?: string;
  customerEmail?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  estimatedTotal?: number;
  currency?: string;
  checkout?: VehicleHistoryInspection;
  checkin?: VehicleHistoryInspection;
};

type FleetMaintenanceCost = {
  id: string;
  carId?: string;
  date?: string;
  category?: string;
  cost?: number;
  currency?: string;
  garage?: string;
  notes?: string;
};

type FleetExpense = {
  id: string;
  carId: string;
  date: string;
  category: string;
  amount: number;
  currency: string;
  supplier?: string;
  notes?: string;
  createdAt?: unknown;
};

type FleetFinanceDraft = {
  date: string;
  category: string;
  amount: string;
  currency: string;
  supplier: string;
  notes: string;
};

type FleetDraft = {
  pricePerDay: string;
  premiumPricePerDay: string;
  normalExcess: string;
  refundableDeposit: string;
  status: FleetStatus;
  transmission: string;
  fuel: string;
  registrationPlate: string;
  vehicleColor: string;
  vin: string;
  insurer: string;
  insurancePolicyNumber: string;
  insuranceExpiry: string;
  lastServiceMileage: string;
  serviceIntervalKm: string;
  lastServiceDate: string;
  serviceNotes: string;
};

const statusLabel: Record<FleetStatus, string> = {
  available: "Disponível",
  limited: "Disponibilidade limitada",
  booked: "Indisponível",
};

function createFleetFinanceDraft(currency = "€"): FleetFinanceDraft {
  return {
    date: new Date().toISOString().slice(0, 10),
    category: "Seguro",
    amount: "",
    currency,
    supplier: "",
    notes: "",
  };
}

function createDraft(car: FleetCar): FleetDraft {
  return {
    pricePerDay: String(car.pricePerDay ?? 0),
    premiumPricePerDay: String(car.premiumPricePerDay ?? 0),
    normalExcess: String(car.normalExcess ?? 0),
    refundableDeposit: String(car.refundableDeposit ?? 0),
    status: car.status,
    transmission: car.transmission,
    fuel: car.fuel,
    registrationPlate: car.registrationPlate ?? "",
    vehicleColor: car.vehicleColor ?? "",
    vin: car.vin ?? "",
    insurer: car.insurer ?? "",
    insurancePolicyNumber: car.insurancePolicyNumber ?? "",
    insuranceExpiry: car.insuranceExpiry ?? "",
    lastServiceMileage: String(car.lastServiceMileage ?? 0),
    serviceIntervalKm: String(car.serviceIntervalKm ?? 10000),
    lastServiceDate: car.lastServiceDate ?? "",
    serviceNotes: car.serviceNotes ?? "",
  };
}

function normaliseMoneyInput(value: string) {
  return value.trim().replace(",", ".");
}

function isValidMoneyInput(value: string) {
  const normalised = normaliseMoneyInput(value);

  if (!normalised || !/^\d+(\.\d{0,2})?$/.test(normalised)) {
    return false;
  }

  const numericValue = Number(normalised);

  return Number.isFinite(numericValue) && numericValue >= 0;
}

function vehicleHistoryDateValue(booking: VehicleHistoryBooking) {
  const value = booking.returnDate || booking.pickupDate || "1970-01-01";

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function vehicleHistoryDate(date?: string, time?: string) {
  if (!date) {
    return "Data não registada";
  }

  const parsed = new Date(`${date}T${time || "00:00"}`);

  if (Number.isNaN(parsed.getTime())) {
    return time ? `${date} às ${time}` : date;
  }

  return parsed.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function vehicleHistoryMoney(
  currency: string | undefined,
  amount: number | undefined,
) {
  return `${currency || "€"} ${Number(amount || 0).toFixed(2)}`;
}

export function AdminFleet() {
  const [fleet, setFleet] = useState<FleetCar[]>([]);
  const [drafts, setDrafts] = useState<Record<string, FleetDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [vehicleHistories, setVehicleHistories] = useState<
    Record<string, VehicleHistoryBooking[]>
  >({});
  const [historyLoadingIds, setHistoryLoadingIds] = useState<
    Record<string, boolean>
  >({});
  const [historyErrors, setHistoryErrors] = useState<Record<string, string>>(
    {},
  );
  const [maintenanceCosts, setMaintenanceCosts] = useState<
    FleetMaintenanceCost[]
  >([]);
  const [fleetExpenses, setFleetExpenses] = useState<FleetExpense[]>([]);
  const [financeDrafts, setFinanceDrafts] = useState<
    Record<string, FleetFinanceDraft>
  >({});
  const [financeLoading, setFinanceLoading] = useState(true);
  const [financeSavingId, setFinanceSavingId] = useState("");
  const [editingExpenseIds, setEditingExpenseIds] = useState<
    Record<string, string>
  >({});
  const [financeError, setFinanceError] = useState("");

  async function loadFleetFinance() {
    setFinanceLoading(true);
    setFinanceError("");

    try {
      const [maintenanceSnapshot, expenseSnapshot] = await Promise.all([
        getDocs(collection(db, "maintenanceRecords")),
        getDocs(collection(db, "fleetExpenses")),
      ]);

      setMaintenanceCosts(
        maintenanceSnapshot.docs.map(
          (item) =>
            ({
              id: item.id,
              ...item.data(),
            }) as FleetMaintenanceCost,
        ),
      );

      setFleetExpenses(
        expenseSnapshot.docs
          .map(
            (item) =>
              ({
                id: item.id,
                ...item.data(),
              }) as FleetExpense,
          )
          .sort((first, second) =>
            (second.date || "").localeCompare(first.date || ""),
          ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      setFinanceError(message);
    } finally {
      setFinanceLoading(false);
    }
  }

  async function loadFleet() {
    setLoading(true);

    try {
      const snapshot = await getDocs(
        query(collection(db, "carCatalog"), orderBy("brand", "asc")),
      );

      const loadedFleet = snapshot.docs.map((item) => {
        const fallback = cars.find((car) => car.id === item.id);
        const data = item.data();

        return {
          ...fallback,
          id: item.id,
          ...data,
          premiumPricePerDay:
            data.premiumPricePerDay ?? fallback?.premiumPricePerDay ?? 0,
          normalExcess: data.normalExcess ?? fallback?.normalExcess ?? 0,
          refundableDeposit:
            data.refundableDeposit ?? fallback?.refundableDeposit ?? 0,
        };
      }) as FleetCar[];

      setFleet(loadedFleet);

      setDrafts(
        Object.fromEntries(
          loadedFleet.map((car) => [car.id, createDraft(car)]),
        ),
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Erro ao carregar frota: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  async function syncFleet() {
    setSavingId("sync");
    setSyncMessage("");

    try {
      let created = 0;
      let preserved = 0;
      let completed = 0;

      for (const car of cars) {
        const carRef = doc(db, "carCatalog", car.id);
        const snapshot = await getDoc(carRef);

        if (!snapshot.exists()) {
          await setDoc(carRef, {
            ...car,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          created += 1;
          continue;
        }

        const current = snapshot.data();
        const missingFields: Record<string, unknown> = {};

        for (const [field, value] of Object.entries(car)) {
          if (field === "id") {
            continue;
          }

          if (current[field] == null) {
            missingFields[field] = value;
          }
        }

        if (Object.keys(missingFields).length > 0) {
          await updateDoc(carRef, {
            ...missingFields,
            updatedAt: serverTimestamp(),
          });

          completed += 1;
        } else {
          preserved += 1;
        }
      }

      await loadFleet();

      setSyncMessage(
        `${created} novo(s) · ${completed} completado(s) · ${preserved} preservado(s)`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Erro ao sincronizar frota: ${message}`);
    } finally {
      setSavingId("");
    }
  }

  function updateDraft(carId: string, values: Partial<FleetDraft>) {
    setDrafts((current) => {
      const car = fleet.find((item) => item.id === carId);

      if (!car) {
        return current;
      }

      return {
        ...current,
        [carId]: {
          ...(current[carId] ?? createDraft(car)),
          ...values,
        },
      };
    });
  }

  async function saveFleetCar(car: FleetCar) {
    const draft = drafts[car.id] ?? createDraft(car);

    const numericFields = [
      {
        label: "Preço normal/dia",
        value: draft.pricePerDay,
      },
      {
        label: "Extra Premium/dia",
        value: draft.premiumPricePerDay,
      },
      {
        label: "Franquia normal",
        value: draft.normalExcess,
      },
      {
        label: "Caução reembolsável",
        value: draft.refundableDeposit,
      },
      {
        label: "Quilometragem da última revisão",
        value: draft.lastServiceMileage,
      },
      {
        label: "Intervalo da revisão",
        value: draft.serviceIntervalKm,
      },
    ];

    const invalidField = numericFields.find(
      (field) => !isValidMoneyInput(field.value),
    );

    if (invalidField) {
      alert(
        `${invalidField.label} deve ter um valor válido igual ou superior a 0.`,
      );
      return;
    }

    if (Number(normaliseMoneyInput(draft.serviceIntervalKm)) <= 0) {
      alert("O intervalo da revisão deve ser superior a 0 km.");
      return;
    }

    const pricePerDay = Number(normaliseMoneyInput(draft.pricePerDay));
    const premiumPricePerDay = Number(
      normaliseMoneyInput(draft.premiumPricePerDay),
    );
    const normalExcess = Number(normaliseMoneyInput(draft.normalExcess));
    const refundableDeposit = Number(
      normaliseMoneyInput(draft.refundableDeposit),
    );

    const lastServiceMileage = Number(
      normaliseMoneyInput(draft.lastServiceMileage),
    );

    const serviceIntervalKm = Number(
      normaliseMoneyInput(draft.serviceIntervalKm),
    );

    if (
      draft.transmission !== "Manual" &&
      draft.transmission !== "Automático"
    ) {
      alert("Seleciona uma transmissão válida.");
      return;
    }

    if (draft.fuel !== "Diesel" && draft.fuel !== "Gasolina") {
      alert("Seleciona um combustível válido.");
      return;
    }

    setSavingId(car.id);

    try {
      await updateDoc(doc(db, "carCatalog", car.id), {
        pricePerDay,
        premiumPricePerDay,
        normalExcess,
        refundableDeposit,
        status: draft.status,
        transmission: draft.transmission,
        fuel: draft.fuel,
        registrationPlate: draft.registrationPlate.trim().toUpperCase(),
        vehicleColor: draft.vehicleColor.trim(),
        vin: draft.vin.trim().toUpperCase(),
        insurer: draft.insurer.trim(),
        insurancePolicyNumber: draft.insurancePolicyNumber.trim(),
        insuranceExpiry: draft.insuranceExpiry,
        lastServiceMileage,
        serviceIntervalKm,
        lastServiceDate: draft.lastServiceDate,
        serviceNotes: draft.serviceNotes.trim(),
        updatedAt: serverTimestamp(),
      });

      await loadFleet();

      alert(`${car.brand} ${car.model} atualizado com sucesso.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Erro ao atualizar carro: ${message}`);
    } finally {
      setSavingId("");
    }
  }

  async function registerCompletedService(
    car: FleetCar,
    currentMileage: number | null,
  ) {
    if (currentMileage == null) {
      alert(
        "Não existe quilometragem atual registada. Regista primeiro os KM na entrega ou devolução da viatura.",
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirmar revisão concluída aos ${currentMileage.toLocaleString(
        "pt-PT",
      )} km?`,
    );

    if (!confirmed) {
      return;
    }

    const today = new Date().toISOString().slice(0, 10);

    setSavingId(car.id);

    try {
      await updateDoc(doc(db, "carCatalog", car.id), {
        lastServiceMileage: currentMileage,
        lastServiceDate: today,
        updatedAt: serverTimestamp(),
      });

      setDrafts((current) => ({
        ...current,
        [car.id]: {
          ...(current[car.id] ?? createDraft(car)),
          lastServiceMileage: String(currentMileage),
          lastServiceDate: today,
        },
      }));

      setFleet((current) =>
        current.map((item) =>
          item.id === car.id
            ? {
                ...item,
                lastServiceMileage: currentMileage,
                lastServiceDate: today,
              }
            : item,
        ),
      );

      alert(
        `Revisão registada aos ${currentMileage.toLocaleString(
          "pt-PT",
        )} km. A próxima revisão foi recalculada.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível registar a revisão: ${message}`);
    } finally {
      setSavingId("");
    }
  }

  function updateFinanceDraft(
    car: FleetCar,
    values: Partial<FleetFinanceDraft>,
  ) {
    setFinanceDrafts((current) => ({
      ...current,
      [car.id]: {
        ...(current[car.id] ?? createFleetFinanceDraft(car.currency)),
        ...values,
      },
    }));
  }

  function startEditingFleetExpense(car: FleetCar, expense: FleetExpense) {
    setEditingExpenseIds((current) => ({
      ...current,
      [car.id]: expense.id,
    }));

    setFinanceDrafts((current) => ({
      ...current,
      [car.id]: {
        date: expense.date || new Date().toISOString().slice(0, 10),
        category: expense.category || "Outro",
        amount: String(expense.amount ?? ""),
        currency: expense.currency || car.currency || "€",
        supplier: expense.supplier || "",
        notes: expense.notes || "",
      },
    }));
  }

  function cancelEditingFleetExpense(car: FleetCar) {
    setEditingExpenseIds((current) => {
      const next = { ...current };
      delete next[car.id];
      return next;
    });

    setFinanceDrafts((current) => ({
      ...current,
      [car.id]: createFleetFinanceDraft(car.currency || "€"),
    }));
  }

  async function deleteFleetExpense(car: FleetCar, expense: FleetExpense) {
    const confirmed = window.confirm(
      `Eliminar a despesa "${expense.category}" no valor de ${vehicleHistoryMoney(
        expense.currency,
        expense.amount,
      )}?`,
    );

    if (!confirmed) {
      return;
    }

    setFinanceSavingId(car.id);

    try {
      await deleteDoc(doc(db, "fleetExpenses", expense.id));

      if (editingExpenseIds[car.id] === expense.id) {
        cancelEditingFleetExpense(car);
      }

      await loadFleetFinance();

      alert("Despesa eliminada com sucesso.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível eliminar a despesa: ${message}`);
    } finally {
      setFinanceSavingId("");
    }
  }

  async function saveFleetExpense(car: FleetCar) {
    const draft =
      financeDrafts[car.id] ?? createFleetFinanceDraft(car.currency);

    const amount = Number(String(draft.amount).replace(",", "."));

    if (!draft.date) {
      alert("Seleciona a data da despesa.");
      return;
    }

    if (!draft.category.trim()) {
      alert("Seleciona ou introduz a categoria da despesa.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert("Introduz um valor de despesa superior a zero.");
      return;
    }

    setFinanceSavingId(car.id);

    try {
      const editingExpenseId = editingExpenseIds[car.id];

      const expenseData = {
        carId: car.id,
        carBrand: car.brand,
        carModel: car.model,
        registrationPlate: car.registrationPlate ?? "",
        date: draft.date,
        category: draft.category.trim(),
        amount,
        currency: draft.currency || car.currency || "€",
        supplier: draft.supplier.trim(),
        notes: draft.notes.trim(),
        updatedAt: serverTimestamp(),
      };

      if (editingExpenseId) {
        await updateDoc(
          doc(db, "fleetExpenses", editingExpenseId),
          expenseData,
        );
      } else {
        await addDoc(collection(db, "fleetExpenses"), {
          ...expenseData,
          createdAt: serverTimestamp(),
        });
      }

      setFinanceDrafts((current) => ({
        ...current,
        [car.id]: createFleetFinanceDraft(
          draft.currency || car.currency || "€",
        ),
      }));

      setEditingExpenseIds((current) => {
        const next = { ...current };
        delete next[car.id];
        return next;
      });

      await loadFleetFinance();

      alert(
        editingExpenseId
          ? "Despesa atualizada com sucesso."
          : "Despesa registada com sucesso.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível guardar a despesa: ${message}`);
    } finally {
      setFinanceSavingId("");
    }
  }

  async function loadVehicleHistory(carId: string) {
    if (vehicleHistories[carId] || historyLoadingIds[carId]) {
      return;
    }

    setHistoryLoadingIds((current) => ({
      ...current,
      [carId]: true,
    }));

    setHistoryErrors((current) => ({
      ...current,
      [carId]: "",
    }));

    try {
      const snapshot = await getDocs(
        query(collection(db, "bookings"), where("carId", "==", carId)),
      );

      const history = snapshot.docs
        .map(
          (item) =>
            ({
              id: item.id,
              ...item.data(),
            }) as VehicleHistoryBooking,
        )
        .sort(
          (first, second) =>
            vehicleHistoryDateValue(second) - vehicleHistoryDateValue(first),
        );

      setVehicleHistories((current) => ({
        ...current,
        [carId]: history,
      }));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      setHistoryErrors((current) => ({
        ...current,
        [carId]: message,
      }));
    } finally {
      setHistoryLoadingIds((current) => ({
        ...current,
        [carId]: false,
      }));
    }
  }

  useEffect(() => {
    loadFleet();
    void loadFleetFinance();
  }, []);

  useEffect(() => {
    if (fleet.length === 0) {
      return;
    }

    for (const car of fleet) {
      if (!vehicleHistories[car.id] && !historyLoadingIds[car.id]) {
        void loadVehicleHistory(car.id);
      }
    }
  }, [fleet]);

  return (
    <section className="fleet-ui">
      <div className="fleet-ui-header">
        <div>
          <p className="eyebrow">Frota 7Go</p>
          <h2>Gestão dos carros</h2>
          <p className="fleet-ui-description">
            Preços, proteção e estado operacional da frota.
          </p>
        </div>

        <div className="fleet-ui-sync">
          <Button
            type="button"
            onClick={syncFleet}
            disabled={savingId === "sync"}
            className="fleet-ui-primary-button"
          >
            <RefreshCw
              aria-hidden="true"
              className={savingId === "sync" ? "fleet-ui-spin" : ""}
            />
            {savingId === "sync" ? "A sincronizar..." : "Sincronizar frota"}
          </Button>

          {syncMessage && (
            <div className="fleet-ui-sync-message">
              <Check aria-hidden="true" />
              <span>{syncMessage}</span>
            </div>
          )}
        </div>
      </div>

      <Card className="fleet-ui-notice">
        <CardContent>
          <ShieldCheck aria-hidden="true" />

          <div>
            <strong>Sincronização segura</strong>
            <p>
              Cria carros novos e preenche apenas campos em falta. Alterações
              feitas no Admin são preservadas.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="fleet-ui-state-card">
          <CardContent>
            <RefreshCw aria-hidden="true" className="fleet-ui-spin" />
            <p>A carregar frota...</p>
          </CardContent>
        </Card>
      ) : fleet.length === 0 ? (
        <Card className="fleet-ui-state-card">
          <CardContent>
            <CarFront aria-hidden="true" />
            <p>A frota ainda não está sincronizada no Firebase.</p>

            <Button
              type="button"
              onClick={syncFleet}
              disabled={savingId === "sync"}
              className="fleet-ui-primary-button"
            >
              {savingId === "sync"
                ? "A criar frota..."
                : "Criar frota no Firebase"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="fleet-ui-grid">
          {fleet.map((car) => {
            const draft = drafts[car.id] ?? createDraft(car);
            const history = vehicleHistories[car.id] ?? [];
            const historyLoading = Boolean(historyLoadingIds[car.id]);
            const historyError = historyErrors[car.id] || "";

            const completedHistory = history.filter(
              (booking) =>
                booking.status === "completed" || booking.checkin?.completed,
            );

            const latestCompletedBooking = completedHistory[0];

            const latestMileage =
              latestCompletedBooking?.checkin?.mileage ??
              latestCompletedBooking?.checkout?.mileage;

            const bookingsWithDamage = history.filter(
              (booking) =>
                booking.checkout?.hasDamage ||
                booking.checkin?.hasDamage ||
                (booking.checkout?.damageZones ?? []).length > 0 ||
                (booking.checkin?.damageZones ?? []).length > 0,
            ).length;

            const lastServiceMileage = Math.max(
              0,
              Number(draft.lastServiceMileage) || 0,
            );

            const serviceIntervalKm = Math.max(
              1,
              Number(draft.serviceIntervalKm) || 10000,
            );

            const nextServiceMileage = lastServiceMileage + serviceIntervalKm;

            const currentMileage =
              latestMileage != null
                ? Math.max(0, Number(latestMileage) || 0)
                : null;

            const serviceKmRemaining =
              currentMileage != null
                ? nextServiceMileage - currentMileage
                : null;

            const serviceLevel =
              serviceKmRemaining == null
                ? "unknown"
                : serviceKmRemaining <= 0
                  ? "overdue"
                  : serviceKmRemaining <= 500
                    ? "urgent"
                    : serviceKmRemaining <= 2000
                      ? "soon"
                      : "ok";

            const serviceStatusLabel =
              serviceLevel === "overdue"
                ? "Serviço necessário"
                : serviceLevel === "urgent"
                  ? "Revisão urgente"
                  : serviceLevel === "soon"
                    ? "Revisão em breve"
                    : serviceLevel === "ok"
                      ? "Manutenção em dia"
                      : "KM ainda não registados";

            const financeDraft =
              financeDrafts[car.id] ?? createFleetFinanceDraft(car.currency);

            const completedRevenueBookings = completedHistory.filter(
              (booking) => booking.status !== "cancelled",
            );

            const totalRevenue = completedRevenueBookings.reduce(
              (total, booking) => total + Number(booking.estimatedTotal || 0),
              0,
            );

            const maintenanceForCar = maintenanceCosts.filter(
              (record) => record.carId === car.id,
            );

            const maintenanceTotal = maintenanceForCar.reduce(
              (total, record) => total + Number(record.cost || 0),
              0,
            );

            const expensesForCar = fleetExpenses.filter(
              (expense) => expense.carId === car.id,
            );

            const otherExpensesTotal = expensesForCar.reduce(
              (total, expense) => total + Number(expense.amount || 0),
              0,
            );

            const totalCosts = maintenanceTotal + otherExpensesTotal;

            const netProfit = totalRevenue - totalCosts;

            const profitMargin =
              totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

            const averageRevenuePerRental =
              completedRevenueBookings.length > 0
                ? totalRevenue / completedRevenueBookings.length
                : 0;

            const financeCurrency =
              completedRevenueBookings.find((booking) => booking.currency)
                ?.currency ||
              expensesForCar.find((expense) => expense.currency)?.currency ||
              car.currency ||
              "€";

            return (
              <Card key={car.id} className="fleet-ui-car-card">
                <CardHeader className="fleet-ui-car-header">
                  <div className="fleet-ui-car-identity">
                    <div className="fleet-ui-car-icon">
                      <CarFront aria-hidden="true" />
                    </div>

                    <div>
                      <span>{car.brand}</span>
                      <h3>{car.model}</h3>
                      <p>
                        {car.year} · {car.category}
                      </p>
                    </div>
                  </div>

                  <Badge
                    className={`fleet-ui-status fleet-ui-status-${car.status}`}
                  >
                    {statusLabel[car.status]}
                  </Badge>
                </CardHeader>

                <CardContent className="fleet-ui-car-content">
                  <div className="fleet-ui-metrics">
                    <div className="fleet-ui-metric">
                      <small>Preço normal</small>
                      <strong>
                        {car.currency}
                        {car.pricePerDay}
                        <span>/dia</span>
                      </strong>
                    </div>

                    <div className="fleet-ui-metric">
                      <small>Premium</small>
                      <strong>
                        +{car.currency}
                        {car.premiumPricePerDay}
                        <span>/dia</span>
                      </strong>
                    </div>

                    <div className="fleet-ui-metric">
                      <small>Franquia normal</small>
                      <strong>
                        {car.currency}
                        {car.normalExcess}
                      </strong>
                    </div>

                    <div className="fleet-ui-metric">
                      <small>Caução</small>
                      <strong>
                        {car.currency}
                        {car.refundableDeposit}
                      </strong>
                    </div>
                  </div>

                  <div className="fleet-ui-specs">
                    <span>
                      <Users aria-hidden="true" />
                      {car.seats} lugares
                    </span>

                    <span>
                      <Gauge aria-hidden="true" />
                      {car.transmission}
                    </span>

                    <span>
                      <Fuel aria-hidden="true" />
                      {car.fuel}
                    </span>
                  </div>

                  <div
                    className={`fleet-service-card fleet-service-card-${serviceLevel}`}
                  >
                    <div className="fleet-service-card-heading">
                      <div>
                        <Gauge aria-hidden="true" />

                        <span>
                          <small>Manutenção por quilometragem</small>
                          <strong>{serviceStatusLabel}</strong>
                        </span>
                      </div>

                      <Badge
                        className={`fleet-service-badge fleet-service-badge-${serviceLevel}`}
                      >
                        {serviceLevel === "overdue"
                          ? "Vencida"
                          : serviceLevel === "urgent"
                            ? "Urgente"
                            : serviceLevel === "soon"
                              ? "Em breve"
                              : serviceLevel === "ok"
                                ? "Em dia"
                                : "Sem leitura"}
                      </Badge>
                    </div>

                    <div className="fleet-service-grid">
                      <div>
                        <span>KM atual</span>
                        <strong>
                          {currentMileage != null
                            ? `${currentMileage.toLocaleString("pt-PT")} km`
                            : "Não registado"}
                        </strong>
                      </div>

                      <div>
                        <span>Última revisão</span>
                        <strong>
                          {lastServiceMileage.toLocaleString("pt-PT")} km
                        </strong>
                      </div>

                      <div>
                        <span>Próxima revisão</span>
                        <strong>
                          {nextServiceMileage.toLocaleString("pt-PT")} km
                        </strong>
                      </div>

                      <div>
                        <span>Restante</span>
                        <strong>
                          {serviceKmRemaining == null
                            ? "Sem leitura"
                            : serviceKmRemaining <= 0
                              ? `${Math.abs(serviceKmRemaining).toLocaleString(
                                  "pt-PT",
                                )} km ultrapassados`
                              : `${serviceKmRemaining.toLocaleString(
                                  "pt-PT",
                                )} km`}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="fleet-service-complete-button"
                      disabled={currentMileage == null || savingId === car.id}
                      onClick={() =>
                        void registerCompletedService(car, currentMileage)
                      }
                    >
                      <Check aria-hidden="true" />

                      {savingId === car.id
                        ? "A registar..."
                        : "Registar revisão concluída"}
                    </button>

                    {serviceLevel === "overdue" && (
                      <div className="fleet-service-warning">
                        <TriangleAlert aria-hidden="true" />

                        <strong>
                          Esta viatura atingiu a quilometragem da revisão.
                          Agende o serviço imediatamente.
                        </strong>
                      </div>
                    )}
                  </div>

                  <Separator className="fleet-ui-separator" />

                  <Accordion
                    type="single"
                    collapsible
                    className="fleet-ui-accordion"
                    onValueChange={(value) => {
                      if (
                        value === `history-${car.id}` ||
                        value === `finance-${car.id}`
                      ) {
                        void loadVehicleHistory(car.id);
                      }

                      if (value === `finance-${car.id}`) {
                        void loadFleetFinance();
                      }
                    }}
                  >
                    <AccordionItem
                      value={`manage-${car.id}`}
                      className="fleet-ui-accordion-item"
                    >
                      <AccordionTrigger className="fleet-ui-accordion-trigger">
                        <span>
                          <Settings2 aria-hidden="true" />
                          Gerir carro
                        </span>

                        <small>Editar dados</small>
                      </AccordionTrigger>

                      <AccordionContent className="fleet-ui-accordion-content">
                        <div className="fleet-ui-form-grid">
                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-price`}>
                              Preço normal/dia
                            </Label>

                            <Input
                              id={`${car.id}-price`}
                              type="text"
                              inputMode="decimal"
                              value={draft.pricePerDay}
                              disabled={savingId === car.id}
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  pricePerDay: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-premium`}>
                              Extra Premium/dia
                            </Label>

                            <Input
                              id={`${car.id}-premium`}
                              type="text"
                              inputMode="decimal"
                              value={draft.premiumPricePerDay}
                              disabled={savingId === car.id}
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  premiumPricePerDay: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-excess`}>
                              Franquia normal
                            </Label>

                            <Input
                              id={`${car.id}-excess`}
                              type="text"
                              inputMode="decimal"
                              value={draft.normalExcess}
                              disabled={savingId === car.id}
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  normalExcess: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-deposit`}>
                              Caução reembolsável
                            </Label>

                            <Input
                              id={`${car.id}-deposit`}
                              type="text"
                              inputMode="decimal"
                              value={draft.refundableDeposit}
                              disabled={savingId === car.id}
                              onFocus={(event) => event.currentTarget.select()}
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  refundableDeposit: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-form-section-title">
                            <CarFront aria-hidden="true" />

                            <div>
                              <strong>Identificação da viatura</strong>
                              <small>
                                Dados usados na ficha e no contrato de aluguer.
                              </small>
                            </div>
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-plate`}>Matrícula</Label>

                            <Input
                              id={`${car.id}-plate`}
                              type="text"
                              value={draft.registrationPlate}
                              disabled={savingId === car.id}
                              placeholder="Ex.: ST-00-00"
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  registrationPlate: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-color`}>Cor</Label>

                            <Input
                              id={`${car.id}-color`}
                              type="text"
                              value={draft.vehicleColor}
                              disabled={savingId === car.id}
                              placeholder="Ex.: Branco"
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  vehicleColor: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-vin`}>
                              VIN / Número do chassis
                            </Label>

                            <Input
                              id={`${car.id}-vin`}
                              type="text"
                              value={draft.vin}
                              disabled={savingId === car.id}
                              placeholder="Número do chassis"
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  vin: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-insurer`}>
                              Seguradora
                            </Label>

                            <Input
                              id={`${car.id}-insurer`}
                              type="text"
                              value={draft.insurer}
                              disabled={savingId === car.id}
                              placeholder="Nome da seguradora"
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  insurer: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-policy`}>
                              Nº da apólice
                            </Label>

                            <Input
                              id={`${car.id}-policy`}
                              type="text"
                              value={draft.insurancePolicyNumber}
                              disabled={savingId === car.id}
                              placeholder="Número da apólice"
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  insurancePolicyNumber: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-insurance-expiry`}>
                              Validade do seguro
                            </Label>

                            <Input
                              id={`${car.id}-insurance-expiry`}
                              type="date"
                              value={draft.insuranceExpiry}
                              disabled={savingId === car.id}
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  insuranceExpiry: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-form-section-title fleet-service-form-title">
                            <Gauge aria-hidden="true" />

                            <div>
                              <strong>Manutenção por quilometragem</strong>

                              <small>
                                O sistema calcula automaticamente quando a
                                próxima revisão deve ser realizada.
                              </small>
                            </div>
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-last-service-mileage`}>
                              KM da última revisão
                            </Label>

                            <Input
                              id={`${car.id}-last-service-mileage`}
                              type="text"
                              inputMode="numeric"
                              value={draft.lastServiceMileage}
                              disabled={savingId === car.id}
                              placeholder="Ex.: 50000"
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  lastServiceMileage: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-service-interval`}>
                              Intervalo da revisão (km)
                            </Label>

                            <Input
                              id={`${car.id}-service-interval`}
                              type="text"
                              inputMode="numeric"
                              value={draft.serviceIntervalKm}
                              disabled={savingId === car.id}
                              placeholder="Ex.: 10000"
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  serviceIntervalKm: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label htmlFor={`${car.id}-last-service-date`}>
                              Data da última revisão
                            </Label>

                            <Input
                              id={`${car.id}-last-service-date`}
                              type="date"
                              value={draft.lastServiceDate}
                              disabled={savingId === car.id}
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  lastServiceDate: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field fleet-service-notes-field">
                            <Label htmlFor={`${car.id}-service-notes`}>
                              Observações da manutenção
                            </Label>

                            <textarea
                              id={`${car.id}-service-notes`}
                              value={draft.serviceNotes}
                              disabled={savingId === car.id}
                              placeholder="Óleo, filtros, pneus, oficina..."
                              onChange={(event) =>
                                updateDraft(car.id, {
                                  serviceNotes: event.target.value,
                                })
                              }
                            />
                          </div>

                          <div className="fleet-ui-field">
                            <Label>Estado</Label>

                            <Select
                              value={draft.status}
                              disabled={savingId === car.id}
                              onValueChange={(value) =>
                                updateDraft(car.id, {
                                  status: value as FleetStatus,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>

                              <SelectContent>
                                <SelectItem value="available">
                                  {statusLabel.available}
                                </SelectItem>

                                <SelectItem value="limited">
                                  {statusLabel.limited}
                                </SelectItem>

                                <SelectItem value="booked">
                                  {statusLabel.booked}
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="fleet-ui-field">
                            <Label>Transmissão</Label>

                            <Select
                              value={draft.transmission}
                              disabled={savingId === car.id}
                              onValueChange={(value) =>
                                updateDraft(car.id, {
                                  transmission: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>

                              <SelectContent>
                                <SelectItem value="Manual">Manual</SelectItem>

                                <SelectItem value="Automático">
                                  Automático
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="fleet-ui-field">
                            <Label>Combustível</Label>

                            <Select
                              value={draft.fuel}
                              disabled={savingId === car.id}
                              onValueChange={(value) =>
                                updateDraft(car.id, {
                                  fuel: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>

                              <SelectContent>
                                <SelectItem value="Diesel">Diesel</SelectItem>

                                <SelectItem value="Gasolina">
                                  Gasolina
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="fleet-ui-premium-note">
                          <ShieldCheck aria-hidden="true" />

                          <div>
                            <strong>7Go Premium</strong>
                            <p>
                              Franquia £0 para danos cobertos. O extra Premium é
                              acrescentado diariamente ao preço normal.
                            </p>
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={() => saveFleetCar(car)}
                          disabled={savingId === car.id}
                          className="fleet-ui-save-button"
                        >
                          {savingId === car.id ? (
                            <RefreshCw
                              aria-hidden="true"
                              className="fleet-ui-spin"
                            />
                          ) : (
                            <Save aria-hidden="true" />
                          )}

                          {savingId === car.id
                            ? "A guardar..."
                            : "Guardar alterações"}
                        </Button>
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem
                      value={`history-${car.id}`}
                      className="fleet-ui-accordion-item fleet-history-accordion-item"
                    >
                      <AccordionTrigger className="fleet-ui-accordion-trigger">
                        <span>
                          <History aria-hidden="true" />
                          Histórico da viatura
                        </span>

                        <small>
                          {vehicleHistories[car.id]
                            ? `${history.length} aluguer(es)`
                            : "Consultar"}
                        </small>
                      </AccordionTrigger>

                      <AccordionContent className="fleet-ui-accordion-content fleet-history-content">
                        {historyLoading ? (
                          <div className="fleet-history-state">
                            <RefreshCw
                              aria-hidden="true"
                              className="fleet-ui-spin"
                            />
                            <span>A carregar histórico...</span>
                          </div>
                        ) : historyError ? (
                          <div className="fleet-history-state fleet-history-state-error">
                            <TriangleAlert aria-hidden="true" />

                            <div>
                              <strong>
                                Não foi possível carregar o histórico
                              </strong>
                              <small>{historyError}</small>
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setVehicleHistories((current) => {
                                  const next = { ...current };
                                  delete next[car.id];
                                  return next;
                                });

                                void loadVehicleHistory(car.id);
                              }}
                            >
                              Tentar novamente
                            </Button>
                          </div>
                        ) : history.length === 0 ? (
                          <div className="fleet-history-state">
                            <History aria-hidden="true" />

                            <div>
                              <strong>Ainda não existem alugueres</strong>

                              <small>
                                As reservas deste carro aparecerão aqui
                                automaticamente.
                              </small>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="fleet-history-summary">
                              <div>
                                <History aria-hidden="true" />
                                <small>Total de alugueres</small>
                                <strong>{history.length}</strong>
                              </div>

                              <div>
                                <Check aria-hidden="true" />
                                <small>Concluídos</small>
                                <strong>{completedHistory.length}</strong>
                              </div>

                              <div>
                                <Gauge aria-hidden="true" />
                                <small>Última quilometragem</small>
                                <strong>
                                  {latestMileage != null
                                    ? `${latestMileage.toLocaleString(
                                        "pt-PT",
                                      )} km`
                                    : "Não registada"}
                                </strong>
                              </div>

                              <div>
                                <TriangleAlert aria-hidden="true" />
                                <small>Com danos registados</small>
                                <strong>{bookingsWithDamage}</strong>
                              </div>
                            </div>

                            <div className="fleet-history-list">
                              {history.map((booking) => {
                                const damageCount =
                                  (booking.checkout?.damageZones ?? []).length +
                                  (booking.checkin?.damageZones ?? []).length;

                                const photoCount =
                                  (booking.checkout?.photoUrls ?? []).length +
                                  (booking.checkin?.photoUrls ?? []).length;

                                const hasDamage =
                                  Boolean(
                                    booking.checkout?.hasDamage ||
                                    booking.checkin?.hasDamage,
                                  ) || damageCount > 0;

                                const latestBookingMileage =
                                  booking.checkin?.mileage ??
                                  booking.checkout?.mileage;

                                return (
                                  <article
                                    key={booking.id}
                                    className="fleet-history-booking"
                                  >
                                    <div className="fleet-history-booking-main">
                                      <div className="fleet-history-booking-heading">
                                        <div>
                                          <span>
                                            {booking.reference || booking.id}
                                          </span>

                                          <strong>
                                            {booking.customerName ||
                                              "Cliente não registado"}
                                          </strong>
                                        </div>

                                        <Badge
                                          className={`fleet-history-status fleet-history-status-${
                                            booking.status || "pending"
                                          }`}
                                        >
                                          {booking.status === "completed"
                                            ? "Concluído"
                                            : booking.status === "in_progress"
                                              ? "Em curso"
                                              : booking.status === "confirmed"
                                                ? "Confirmado"
                                                : booking.status === "cancelled"
                                                  ? "Cancelado"
                                                  : "Pendente"}
                                        </Badge>
                                      </div>

                                      <div className="fleet-history-booking-details">
                                        <span>
                                          <CalendarDays aria-hidden="true" />
                                          {vehicleHistoryDate(
                                            booking.pickupDate,
                                            booking.pickupTime,
                                          )}
                                          {" → "}
                                          {vehicleHistoryDate(
                                            booking.returnDate,
                                            booking.returnTime,
                                          )}
                                        </span>

                                        <span>
                                          <Gauge aria-hidden="true" />
                                          {latestBookingMileage != null
                                            ? `${latestBookingMileage.toLocaleString(
                                                "pt-PT",
                                              )} km`
                                            : "KM não registados"}
                                        </span>

                                        <span>
                                          <CircleDollarSign aria-hidden="true" />
                                          {vehicleHistoryMoney(
                                            booking.currency,
                                            booking.estimatedTotal,
                                          )}
                                        </span>
                                      </div>

                                      <div className="fleet-history-booking-tags">
                                        <span
                                          className={
                                            hasDamage
                                              ? "is-warning"
                                              : "is-success"
                                          }
                                        >
                                          <MapPin aria-hidden="true" />
                                          {hasDamage
                                            ? `${Math.max(
                                                damageCount,
                                                1,
                                              )} dano(s)`
                                            : "Sem danos novos"}
                                        </span>

                                        <span>
                                          <Camera aria-hidden="true" />
                                          {photoCount} fotografia(s)
                                        </span>

                                        {booking.checkin?.cleaningRequired && (
                                          <span className="is-warning">
                                            Limpeza especial
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <a
                                      href={`/admin/reservas/${booking.id}/ficha`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="fleet-history-open-sheet"
                                    >
                                      <FileText aria-hidden="true" />
                                      Abrir ficha
                                      <ExternalLink aria-hidden="true" />
                                    </a>
                                  </article>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </AccordionContent>
                    </AccordionItem>

                    <AccordionItem
                      value={`finance-${car.id}`}
                      className="fleet-ui-accordion-item fleet-finance-accordion-item"
                    >
                      <AccordionTrigger className="fleet-ui-accordion-trigger">
                        <span>
                          <WalletCards aria-hidden="true" />
                          Centro Financeiro
                        </span>

                        <small>
                          {financeLoading
                            ? "A calcular..."
                            : vehicleHistoryMoney(financeCurrency, netProfit)}
                        </small>
                      </AccordionTrigger>

                      <AccordionContent className="fleet-ui-accordion-content fleet-finance-content">
                        {financeError && (
                          <div className="fleet-finance-error">
                            <TriangleAlert aria-hidden="true" />

                            <span>
                              Não foi possível carregar todos os custos:{" "}
                              {financeError}
                            </span>
                          </div>
                        )}

                        <div className="fleet-finance-summary">
                          <article className="fleet-finance-summary-revenue">
                            <TrendingUp aria-hidden="true" />
                            <span>Receita concluída</span>
                            <strong>
                              {vehicleHistoryMoney(
                                financeCurrency,
                                totalRevenue,
                              )}
                            </strong>
                            <small>
                              {completedRevenueBookings.length} aluguer(es)
                              concluído(s)
                            </small>
                          </article>

                          <article className="fleet-finance-summary-costs">
                            <ReceiptText aria-hidden="true" />
                            <span>Custos totais</span>
                            <strong>
                              {vehicleHistoryMoney(financeCurrency, totalCosts)}
                            </strong>
                            <small>Oficina + outras despesas</small>
                          </article>

                          <article
                            className={
                              netProfit >= 0
                                ? "fleet-finance-summary-profit"
                                : "fleet-finance-summary-loss"
                            }
                          >
                            <CircleDollarSign aria-hidden="true" />
                            <span>Resultado líquido</span>
                            <strong>
                              {vehicleHistoryMoney(financeCurrency, netProfit)}
                            </strong>
                            <small>Margem {profitMargin.toFixed(1)}%</small>
                          </article>

                          <article>
                            <CarFront aria-hidden="true" />
                            <span>Média por aluguer</span>
                            <strong>
                              {vehicleHistoryMoney(
                                financeCurrency,
                                averageRevenuePerRental,
                              )}
                            </strong>
                            <small>Receita média concluída</small>
                          </article>
                        </div>

                        <div className="fleet-finance-breakdown">
                          <div>
                            <span>Custos da Oficina</span>
                            <strong>
                              {vehicleHistoryMoney(
                                financeCurrency,
                                maintenanceTotal,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Outras despesas</span>
                            <strong>
                              {vehicleHistoryMoney(
                                financeCurrency,
                                otherExpensesTotal,
                              )}
                            </strong>
                          </div>

                          <div>
                            <span>Intervenções de oficina</span>
                            <strong>{maintenanceForCar.length}</strong>
                          </div>

                          <div>
                            <span>Despesas manuais</span>
                            <strong>{expensesForCar.length}</strong>
                          </div>
                        </div>

                        <section className="fleet-finance-form-section">
                          <div className="fleet-finance-section-heading">
                            <div>
                              <Plus aria-hidden="true" />

                              <span>
                                <strong>Adicionar despesa</strong>
                                <small>
                                  Seguro, imposto, combustível, lavagem, multas
                                  ou outros custos.
                                </small>
                              </span>
                            </div>
                          </div>

                          <div className="fleet-finance-form-grid">
                            <label>
                              <span>Data</span>

                              <input
                                type="date"
                                value={financeDraft.date}
                                disabled={financeSavingId === car.id}
                                onChange={(event) =>
                                  updateFinanceDraft(car, {
                                    date: event.target.value,
                                  })
                                }
                              />
                            </label>

                            <label>
                              <span>Categoria</span>

                              <select
                                value={financeDraft.category}
                                disabled={financeSavingId === car.id}
                                onChange={(event) =>
                                  updateFinanceDraft(car, {
                                    category: event.target.value,
                                  })
                                }
                              >
                                <option value="Seguro">Seguro</option>
                                <option value="Imposto">Imposto</option>
                                <option value="Inspeção">Inspeção</option>
                                <option value="Combustível">Combustível</option>
                                <option value="Lavagem">Lavagem</option>
                                <option value="Portagens">Portagens</option>
                                <option value="Multa">Multa</option>
                                <option value="Reparação">Reparação</option>
                                <option value="Outro">Outro</option>
                              </select>
                            </label>

                            <label>
                              <span>Valor</span>

                              <div className="fleet-finance-money-field">
                                <input
                                  type="text"
                                  aria-label="Moeda da despesa"
                                  value={financeDraft.currency}
                                  disabled={financeSavingId === car.id}
                                  onChange={(event) =>
                                    updateFinanceDraft(car, {
                                      currency: event.target.value,
                                    })
                                  }
                                />

                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={financeDraft.amount}
                                  disabled={financeSavingId === car.id}
                                  placeholder="0.00"
                                  onChange={(event) =>
                                    updateFinanceDraft(car, {
                                      amount: event.target.value,
                                    })
                                  }
                                />
                              </div>
                            </label>

                            <label>
                              <span>Fornecedor</span>

                              <input
                                type="text"
                                value={financeDraft.supplier}
                                disabled={financeSavingId === car.id}
                                placeholder="Empresa ou pessoa"
                                onChange={(event) =>
                                  updateFinanceDraft(car, {
                                    supplier: event.target.value,
                                  })
                                }
                              />
                            </label>

                            <label className="fleet-finance-full-field">
                              <span>Observações</span>

                              <textarea
                                value={financeDraft.notes}
                                disabled={financeSavingId === car.id}
                                placeholder="Detalhes da despesa..."
                                onChange={(event) =>
                                  updateFinanceDraft(car, {
                                    notes: event.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>

                          <div className="fleet-finance-form-actions">
                            <button
                              type="button"
                              className="fleet-finance-save-button"
                              disabled={financeSavingId === car.id}
                              onClick={() => void saveFleetExpense(car)}
                            >
                              {financeSavingId === car.id ? (
                                <RefreshCw
                                  aria-hidden="true"
                                  className="fleet-ui-spin"
                                />
                              ) : (
                                <Save aria-hidden="true" />
                              )}

                              {financeSavingId === car.id
                                ? "A guardar..."
                                : editingExpenseIds[car.id]
                                  ? "Guardar alteração"
                                  : "Guardar despesa"}
                            </button>

                            {editingExpenseIds[car.id] && (
                              <button
                                type="button"
                                className="fleet-finance-cancel-button"
                                disabled={financeSavingId === car.id}
                                onClick={() => cancelEditingFleetExpense(car)}
                              >
                                <X aria-hidden="true" />
                                Cancelar edição
                              </button>
                            )}
                          </div>
                        </section>

                        <section className="fleet-finance-history-section">
                          <div className="fleet-finance-section-heading">
                            <div>
                              <ReceiptText aria-hidden="true" />

                              <span>
                                <strong>Histórico financeiro</strong>
                                <small>
                                  Custos da Oficina e despesas adicionais.
                                </small>
                              </span>
                            </div>
                          </div>

                          {maintenanceForCar.length === 0 &&
                          expensesForCar.length === 0 ? (
                            <div className="fleet-finance-empty">
                              Ainda não existem custos registados para esta
                              viatura.
                            </div>
                          ) : (
                            <div className="fleet-finance-history-list">
                              {[
                                ...maintenanceForCar.map((record) => ({
                                  id: `maintenance-${record.id}`,
                                  originalId: record.id,
                                  editable: false,
                                  date: record.date || "",
                                  category: record.category || "Manutenção",
                                  supplier: record.garage || "Oficina",
                                  notes: record.notes || "",
                                  amount: Number(record.cost || 0),
                                  currency: record.currency || financeCurrency,
                                  source: "Oficina",
                                })),
                                ...expensesForCar.map((expense) => ({
                                  id: `expense-${expense.id}`,
                                  originalId: expense.id,
                                  editable: true,
                                  date: expense.date,
                                  category: expense.category,
                                  supplier: expense.supplier || "",
                                  notes: expense.notes || "",
                                  amount: Number(expense.amount || 0),
                                  currency: expense.currency || financeCurrency,
                                  source: "Despesa",
                                })),
                              ]
                                .sort((first, second) =>
                                  second.date.localeCompare(first.date),
                                )
                                .map((record) => (
                                  <article
                                    key={record.id}
                                    className="fleet-finance-history-record"
                                  >
                                    <div>
                                      <span>{record.source}</span>
                                      <strong>{record.category}</strong>
                                    </div>

                                    <div>
                                      <span>
                                        {record.date
                                          ? vehicleHistoryDate(record.date)
                                          : "Sem data"}
                                      </span>

                                      {record.supplier && (
                                        <small>{record.supplier}</small>
                                      )}
                                    </div>

                                    <strong>
                                      {vehicleHistoryMoney(
                                        record.currency,
                                        record.amount,
                                      )}
                                    </strong>

                                    {record.editable && (
                                      <div className="fleet-finance-record-actions">
                                        <button
                                          type="button"
                                          disabled={financeSavingId === car.id}
                                          onClick={() => {
                                            const expense = expensesForCar.find(
                                              (item) =>
                                                item.id === record.originalId,
                                            );

                                            if (expense) {
                                              startEditingFleetExpense(
                                                car,
                                                expense,
                                              );
                                            }
                                          }}
                                        >
                                          <Pencil aria-hidden="true" />
                                          Editar
                                        </button>

                                        <button
                                          type="button"
                                          className="is-danger"
                                          disabled={financeSavingId === car.id}
                                          onClick={() => {
                                            const expense = expensesForCar.find(
                                              (item) =>
                                                item.id === record.originalId,
                                            );

                                            if (expense) {
                                              void deleteFleetExpense(
                                                car,
                                                expense,
                                              );
                                            }
                                          }}
                                        >
                                          <Trash2 aria-hidden="true" />
                                          Eliminar
                                        </button>
                                      </div>
                                    )}

                                    {record.notes && <p>{record.notes}</p>}
                                  </article>
                                ))}
                            </div>
                          )}
                        </section>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
