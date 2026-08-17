"use client";

import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CalendarDays,
  CarFront,
  CircleDollarSign,
  Crown,
  ReceiptText,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  ShieldAlert,
  Wrench,
  Clock3,
  MapPinned,
  CircleCheck,
  CircleParking,
  Gauge,
} from "lucide-react";

import { auth, db } from "@/lib/firebase/client";

type BookingInspection = {
  mileage?: number;
  completed?: boolean;
};

type Booking = {
  id: string;
  reference?: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  customerName?: string;
  status?: string;
  paymentStatus?: string;
  estimatedTotal?: number;
  totalDays?: number;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  currency?: string;
  customerId?: string;
  checkout?: BookingInspection;
  checkin?: BookingInspection;
};

type FleetCar = {
  id: string;
  brand?: string;
  model?: string;
  status?: "available" | "limited" | "booked";
  currency?: string;
  insuranceExpiry?: string;
  lastServiceMileage?: number;
  serviceIntervalKm?: number;
};

type MaintenanceRecord = {
  id: string;
  carId?: string;
  date?: string;
  cost?: number;
  currency?: string;
};

type FleetExpense = {
  id: string;
  carId?: string;
  date?: string;
  amount?: number;
  currency?: string;
};

type Customer = {
  id: string;
  status?: "active" | "blocked";
};

function getToday() {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatMoney(value: number, currency: string) {
  return `${currency}${Number(value || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function getYearKey(date: string) {
  return date.slice(0, 4);
}

function calculatePercentageChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return ((current - previous) / Math.abs(previous)) * 100;
}

function getTimelineStatusLabel(status?: string) {
  const labels: Record<string, string> = {
    pending: "Pendente",
    pending_payment: "A aguardar pagamento",
    confirmed: "Confirmada",
    in_progress: "Em curso",
    overdue: "Atrasada",
    completed: "Concluída",
    cancelled: "Cancelada",
  };

  return labels[status || "pending"] || "Pendente";
}

function differenceInDays(fromDate: string, toDate: string) {
  const from = new Date(`${fromDate}T12:00:00`);
  const to = new Date(`${toDate}T12:00:00`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }

  return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function createLastTwelveMonths(referenceDate: string) {
  const [year, month] = referenceDate.split("-").map(Number);

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(year, month - 12 + index, 1);

    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
    ].join("-");

    const label = new Intl.DateTimeFormat("pt-PT", {
      month: "short",
    })
      .format(date)
      .replace(".", "");

    return {
      key,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    };
  });
}

export function AdminFinancialDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fleet, setFleet] = useState<FleetCar[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [expenses, setExpenses] = useState<FleetExpense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setBookings([]);
        setFleet([]);
        setMaintenance([]);
        setExpenses([]);
        setCustomers([]);
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    setLoading(true);
    setLoadError("");

    const loaded = {
      bookings: false,
      fleet: false,
      maintenance: false,
      expenses: false,
      customers: false,
    };

    function finishLoading() {
      if (Object.values(loaded).every(Boolean)) {
        setLoading(false);
      }
    }

    const unsubscribers = [
      onSnapshot(
        collection(db, "bookings"),
        (snapshot) => {
          setBookings(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as Booking[],
          );

          loaded.bookings = true;
          finishLoading();
        },
        (error) => {
          console.error("Erro no dashboard financeiro — reservas:", error);
          setLoadError("Não foi possível carregar todos os dados financeiros.");
          loaded.bookings = true;
          finishLoading();
        },
      ),

      onSnapshot(
        collection(db, "carCatalog"),
        (snapshot) => {
          setFleet(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as FleetCar[],
          );

          loaded.fleet = true;
          finishLoading();
        },
        (error) => {
          console.error("Erro no dashboard financeiro — frota:", error);
          setLoadError("Não foi possível carregar todos os dados financeiros.");
          loaded.fleet = true;
          finishLoading();
        },
      ),

      onSnapshot(
        collection(db, "maintenanceRecords"),
        (snapshot) => {
          setMaintenance(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as MaintenanceRecord[],
          );

          loaded.maintenance = true;
          finishLoading();
        },
        (error) => {
          console.error("Erro no dashboard financeiro — oficina:", error);
          setLoadError("Não foi possível carregar todos os dados financeiros.");
          loaded.maintenance = true;
          finishLoading();
        },
      ),

      onSnapshot(
        collection(db, "fleetExpenses"),
        (snapshot) => {
          setExpenses(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as FleetExpense[],
          );

          loaded.expenses = true;
          finishLoading();
        },
        (error) => {
          console.error("Erro no dashboard financeiro — despesas:", error);
          setLoadError("Não foi possível carregar todos os dados financeiros.");
          loaded.expenses = true;
          finishLoading();
        },
      ),

      onSnapshot(
        collection(db, "customers"),
        (snapshot) => {
          setCustomers(
            snapshot.docs.map((item) => ({
              id: item.id,
              ...item.data(),
            })) as Customer[],
          );

          loaded.customers = true;
          finishLoading();
        },
        (error) => {
          console.error("Erro no dashboard financeiro — clientes:", error);
          setLoadError("Não foi possível carregar todos os dados financeiros.");
          loaded.customers = true;
          finishLoading();
        },
      ),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user]);

  const financial = useMemo(() => {
    const today = getToday();
    const currentMonth = getMonthKey(today);
    const currentYear = getYearKey(today);

    const completedBookings = bookings.filter(
      (booking) => booking.status === "completed",
    );

    const currency =
      completedBookings.find((booking) => booking.currency)?.currency ||
      expenses.find((expense) => expense.currency)?.currency ||
      maintenance.find((record) => record.currency)?.currency ||
      fleet.find((car) => car.currency)?.currency ||
      "€";

    const revenueToday = completedBookings
      .filter((booking) => booking.returnDate === today)
      .reduce(
        (total, booking) => total + Number(booking.estimatedTotal || 0),
        0,
      );

    const revenueMonth = completedBookings
      .filter(
        (booking) =>
          booking.returnDate &&
          getMonthKey(booking.returnDate) === currentMonth,
      )
      .reduce(
        (total, booking) => total + Number(booking.estimatedTotal || 0),
        0,
      );

    const revenueYear = completedBookings
      .filter(
        (booking) =>
          booking.returnDate && getYearKey(booking.returnDate) === currentYear,
      )
      .reduce(
        (total, booking) => total + Number(booking.estimatedTotal || 0),
        0,
      );

    const totalRevenue = completedBookings.reduce(
      (total, booking) => total + Number(booking.estimatedTotal || 0),
      0,
    );

    const maintenanceMonth = maintenance
      .filter(
        (record) => record.date && getMonthKey(record.date) === currentMonth,
      )
      .reduce((total, record) => total + Number(record.cost || 0), 0);

    const expensesMonth = expenses
      .filter(
        (expense) => expense.date && getMonthKey(expense.date) === currentMonth,
      )
      .reduce((total, expense) => total + Number(expense.amount || 0), 0);

    const totalMaintenance = maintenance.reduce(
      (total, record) => total + Number(record.cost || 0),
      0,
    );

    const totalManualExpenses = expenses.reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0,
    );

    const costsMonth = maintenanceMonth + expensesMonth;
    const totalCosts = totalMaintenance + totalManualExpenses;
    const profitMonth = revenueMonth - costsMonth;
    const totalProfit = totalRevenue - totalCosts;

    const profitMargin =
      totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const vehicleRanking = fleet
      .map((car) => {
        const carBookings = completedBookings.filter(
          (booking) => booking.carId === car.id,
        );

        const revenue = carBookings.reduce(
          (total, booking) => total + Number(booking.estimatedTotal || 0),
          0,
        );

        const maintenanceCost = maintenance
          .filter((record) => record.carId === car.id)
          .reduce((total, record) => total + Number(record.cost || 0), 0);

        const otherCost = expenses
          .filter((expense) => expense.carId === car.id)
          .reduce((total, expense) => total + Number(expense.amount || 0), 0);

        const totalDays = carBookings.reduce(
          (total, booking) => total + Number(booking.totalDays || 0),
          0,
        );

        return {
          id: car.id,
          name: `${car.brand || "Viatura"} ${car.model || ""}`.trim(),
          bookings: carBookings.length,
          revenue,
          costs: maintenanceCost + otherCost,
          profit: revenue - maintenanceCost - otherCost,
          totalDays,
        };
      })
      .sort((first, second) => second.profit - first.profit);

    const maximumVehicleProfit = Math.max(
      ...vehicleRanking.map((vehicle) => Math.max(vehicle.profit, 0)),
      1,
    );

    const monthlyFinancialData = createLastTwelveMonths(today).map((month) => {
      const revenue = completedBookings
        .filter(
          (booking) =>
            booking.returnDate && getMonthKey(booking.returnDate) === month.key,
        )
        .reduce(
          (total, booking) => total + Number(booking.estimatedTotal || 0),
          0,
        );

      const maintenanceCosts = maintenance
        .filter(
          (record) => record.date && getMonthKey(record.date) === month.key,
        )
        .reduce((total, record) => total + Number(record.cost || 0), 0);

      const manualCosts = expenses
        .filter(
          (expense) => expense.date && getMonthKey(expense.date) === month.key,
        )
        .reduce((total, expense) => total + Number(expense.amount || 0), 0);

      const costs = maintenanceCosts + manualCosts;

      return {
        month: month.label,
        monthKey: month.key,
        revenue,
        costs,
        profit: revenue - costs,
      };
    });

    const currentMonthData = monthlyFinancialData.at(-1) ?? {
      revenue: 0,
      costs: 0,
      profit: 0,
      month: "",
      monthKey: "",
    };

    const previousMonthData = monthlyFinancialData.at(-2) ?? {
      revenue: 0,
      costs: 0,
      profit: 0,
      month: "",
      monthKey: "",
    };

    const revenueChange = calculatePercentageChange(
      currentMonthData.revenue,
      previousMonthData.revenue,
    );

    const costsChange = calculatePercentageChange(
      currentMonthData.costs,
      previousMonthData.costs,
    );

    const profitChange = calculatePercentageChange(
      currentMonthData.profit,
      previousMonthData.profit,
    );

    const completedBookingsThisMonth = completedBookings.filter(
      (booking) =>
        booking.returnDate && getMonthKey(booking.returnDate) === currentMonth,
    );

    const averageRevenuePerBooking =
      completedBookingsThisMonth.length > 0
        ? revenueMonth / completedBookingsThisMonth.length
        : 0;

    const monthsWithActivity = monthlyFinancialData.filter(
      (month) => month.revenue !== 0 || month.costs !== 0 || month.profit !== 0,
    );

    const bestMonth =
      monthsWithActivity.length > 0
        ? [...monthsWithActivity].sort(
            (first, second) => second.profit - first.profit,
          )[0]
        : null;

    const worstMonth =
      monthsWithActivity.length > 0
        ? [...monthsWithActivity].sort(
            (first, second) => first.profit - second.profit,
          )[0]
        : null;

    const bestPerformingVehicle =
      vehicleRanking.length > 0 ? vehicleRanking[0] : null;

    const highestCostVehicle =
      vehicleRanking.length > 0
        ? [...vehicleRanking].sort(
            (first, second) => second.costs - first.costs,
          )[0]
        : null;

    const monthlyProfitMargin =
      revenueMonth > 0
        ? (profitMonth / revenueMonth) * 100
        : profitMonth < 0
          ? -100
          : 0;

    const businessStatus =
      monthlyProfitMargin >= 40
        ? {
            label: "Excelente desempenho",
            tone: "excellent" as const,
            message: "A empresa apresenta uma margem muito saudável neste mês.",
          }
        : monthlyProfitMargin >= 25
          ? {
              label: "Muito bom",
              tone: "good" as const,
              message:
                "O negócio mantém uma rentabilidade positiva e equilibrada.",
            }
          : monthlyProfitMargin >= 10
            ? {
                label: "Atenção necessária",
                tone: "warning" as const,
                message:
                  "A margem está positiva, mas os custos devem ser acompanhados.",
              }
            : {
                label: "Necessita intervenção",
                tone: "critical" as const,
                message:
                  "Os resultados do mês exigem controlo de custos e receitas.",
              };

    const executiveMonth = monthlyFinancialData.at(-1)?.month || "Mês atual";

    const insuranceAlerts = fleet
      .filter((car) => Boolean(car.insuranceExpiry))
      .map((car) => {
        const daysRemaining = differenceInDays(
          today,
          car.insuranceExpiry || "",
        );

        if (daysRemaining == null || daysRemaining > 30) {
          return null;
        }

        return {
          id: `insurance-${car.id}`,
          severity:
            daysRemaining < 0
              ? ("critical" as const)
              : daysRemaining <= 7
                ? ("high" as const)
                : ("warning" as const),
          type: "Seguro",
          title:
            daysRemaining < 0
              ? "Seguro expirado"
              : "Seguro próximo do vencimento",
          description:
            daysRemaining < 0
              ? `${car.brand || "Viatura"} ${car.model || ""} — expirou há ${Math.abs(
                  daysRemaining,
                )} dia(s)`
              : `${car.brand || "Viatura"} ${car.model || ""} — vence em ${daysRemaining} dia(s)`,
        };
      })
      .filter((alert): alert is NonNullable<typeof alert> => alert !== null);

    const serviceAlerts = fleet
      .map((car) => {
        const completedCarBookings = completedBookings
          .filter(
            (booking) =>
              booking.carId === car.id &&
              (booking.checkin?.mileage != null ||
                booking.checkout?.mileage != null),
          )
          .sort((first, second) =>
            (second.returnDate || "").localeCompare(first.returnDate || ""),
          );

        const latestBooking = completedCarBookings[0];

        const currentMileage =
          latestBooking?.checkin?.mileage ?? latestBooking?.checkout?.mileage;

        if (currentMileage == null) {
          return null;
        }

        const lastServiceMileage = Number(car.lastServiceMileage || 0);

        const interval = Math.max(Number(car.serviceIntervalKm || 10000), 1);

        const nextServiceMileage = lastServiceMileage + interval;

        const kilometresRemaining = nextServiceMileage - currentMileage;

        if (kilometresRemaining > 1000) {
          return null;
        }

        return {
          id: `service-${car.id}`,
          severity:
            kilometresRemaining <= 0
              ? ("critical" as const)
              : kilometresRemaining <= 300
                ? ("high" as const)
                : ("warning" as const),
          type: "Revisão",
          title:
            kilometresRemaining <= 0
              ? "Revisão ultrapassada"
              : "Revisão próxima",
          description:
            kilometresRemaining <= 0
              ? `${car.brand || "Viatura"} ${car.model || ""} — ultrapassou ${Math.abs(
                  kilometresRemaining,
                ).toLocaleString("pt-PT")} km`
              : `${car.brand || "Viatura"} ${car.model || ""} — faltam ${kilometresRemaining.toLocaleString(
                  "pt-PT",
                )} km`,
        };
      })
      .filter((alert): alert is NonNullable<typeof alert> => alert !== null);

    const pickupsToday = bookings.filter(
      (booking) =>
        booking.status !== "cancelled" &&
        booking.status !== "completed" &&
        booking.pickupDate === today,
    ).length;

    const returnsToday = bookings.filter(
      (booking) =>
        booking.status !== "cancelled" &&
        booking.status !== "completed" &&
        booking.returnDate === today,
    ).length;

    const blockedCustomers = customers.filter(
      (customer) => customer.status === "blocked",
    ).length;

    const todayTimeline = bookings
      .flatMap((booking) => {
        if (booking.status === "cancelled" || booking.status === "completed") {
          return [];
        }

        const movements = [];

        if (booking.pickupDate === today) {
          movements.push({
            id: `pickup-${booking.id}`,
            type: "pickup" as const,
            time: booking.pickupTime || "00:00",
            title: "Entrega",
            car: `${booking.carBrand || "Viatura"} ${
              booking.carModel || ""
            }`.trim(),
            customer: booking.customerName || "Cliente não identificado",
            reference: booking.reference || "Sem referência",
            status: booking.status || "pending",
          });
        }

        if (booking.returnDate === today) {
          movements.push({
            id: `return-${booking.id}`,
            type: "return" as const,
            time: booking.returnTime || "00:00",
            title: "Devolução",
            car: `${booking.carBrand || "Viatura"} ${
              booking.carModel || ""
            }`.trim(),
            customer: booking.customerName || "Cliente não identificado",
            reference: booking.reference || "Sem referência",
            status: booking.status || "pending",
          });
        }

        return movements;
      })
      .sort((first, second) => first.time.localeCompare(second.time));

    const occupiedCarIds = new Set(
      bookings
        .filter(
          (booking) =>
            booking.status !== "cancelled" &&
            booking.status !== "completed" &&
            Boolean(booking.carId) &&
            Boolean(booking.pickupDate) &&
            Boolean(booking.returnDate) &&
            (booking.pickupDate as string) <= today &&
            (booking.returnDate as string) > today,
        )
        .map((booking) => booking.carId as string),
    );

    const serviceAttentionCarIds = new Set(
      serviceAlerts.map((alert) => alert.id.replace("service-", "")),
    );

    const fleetMap = fleet
      .map((car) => {
        const hasServiceAttention = serviceAttentionCarIds.has(car.id);

        const isOccupied =
          occupiedCarIds.has(car.id) || car.status === "booked";

        const visualStatus = hasServiceAttention
          ? ("attention" as const)
          : isOccupied
            ? ("rented" as const)
            : car.status === "limited"
              ? ("limited" as const)
              : ("available" as const);

        const labels = {
          available: "Disponível",
          rented: "Alugada",
          limited: "Limitada",
          attention: "Atenção",
        };

        return {
          id: car.id,
          name: `${car.brand || "Viatura"} ${car.model || ""}`.trim(),
          visualStatus,
          label: labels[visualStatus],
        };
      })
      .sort((first, second) => {
        const priority = {
          attention: 1,
          rented: 2,
          limited: 3,
          available: 4,
        };

        return (
          priority[first.visualStatus] - priority[second.visualStatus] ||
          first.name.localeCompare(second.name)
        );
      });

    const fleetStatusCounts = {
      available: fleetMap.filter((car) => car.visualStatus === "available")
        .length,
      rented: fleetMap.filter((car) => car.visualStatus === "rented").length,
      limited: fleetMap.filter((car) => car.visualStatus === "limited").length,
      attention: fleetMap.filter((car) => car.visualStatus === "attention")
        .length,
    };

    const fleetUsageRate =
      fleet.length > 0
        ? Math.round((fleetStatusCounts.rented / fleet.length) * 100)
        : 0;

    const operationalAlerts = [
      ...(pickupsToday > 0
        ? [
            {
              id: "pickups-today",
              severity: "info" as const,
              type: "Reservas",
              title: "Entregas programadas",
              description: `${pickupsToday} entrega(s) para hoje`,
            },
          ]
        : []),
      ...(returnsToday > 0
        ? [
            {
              id: "returns-today",
              severity: "info" as const,
              type: "Reservas",
              title: "Devoluções programadas",
              description: `${returnsToday} devolução(ões) para hoje`,
            },
          ]
        : []),
      ...(blockedCustomers > 0
        ? [
            {
              id: "blocked-customers",
              severity: "warning" as const,
              type: "Clientes",
              title: "Clientes bloqueados",
              description: `${blockedCustomers} cliente(s) bloqueado(s)`,
            },
          ]
        : []),
    ];

    const intelligentAlerts = [
      ...insuranceAlerts,
      ...serviceAlerts,
      ...operationalAlerts,
    ].sort((first, second) => {
      const priority = {
        critical: 4,
        high: 3,
        warning: 2,
        info: 1,
      };

      return priority[second.severity] - priority[first.severity];
    });

    const returningCustomerIds = new Set<string>();

    const bookingCounts = new Map<string, number>();

    completedBookings.forEach((booking) => {
      if (!booking.customerId) {
        return;
      }

      const count = (bookingCounts.get(booking.customerId) || 0) + 1;

      bookingCounts.set(booking.customerId, count);

      if (count > 1) {
        returningCustomerIds.add(booking.customerId);
      }
    });

    return {
      today,
      currency,
      revenueToday,
      revenueMonth,
      revenueYear,
      totalRevenue,
      maintenanceMonth,
      expensesMonth,
      costsMonth,
      totalCosts,
      profitMonth,
      totalProfit,
      profitMargin,
      completedBookings: completedBookings.length,
      customers: customers.length,
      activeCustomers: customers.filter(
        (customer) => customer.status !== "blocked",
      ).length,
      returningCustomers: returningCustomerIds.size,
      maximumVehicleProfit,
      monthlyFinancialData,
      bestPerformingVehicle,
      highestCostVehicle,
      monthlyProfitMargin,
      businessStatus,
      executiveMonth,
      revenueChange,
      costsChange,
      profitChange,
      averageRevenuePerBooking,
      bestMonth,
      worstMonth,
      intelligentAlerts,
      criticalAlerts: intelligentAlerts.filter(
        (alert) => alert.severity === "critical" || alert.severity === "high",
      ).length,
      pickupsToday,
      returnsToday,
      blockedCustomers,
      todayTimeline,
      fleetMap,
      fleetStatusCounts,
      fleetUsageRate,
      vehicleRanking: vehicleRanking.slice(0, 5),
    };
  }, [bookings, customers, expenses, fleet, maintenance]);

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <section className="admin-financial-dashboard">
        <div className="admin-financial-state">
          <RefreshCw aria-hidden="true" className="admin-financial-spin" />
          <strong>A calcular indicadores financeiros...</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-financial-dashboard">
      <header className="admin-financial-header">
        <div>
          <span>Desempenho do negócio</span>
          <h2>Dashboard financeiro</h2>
          <p>
            Receitas concluídas, custos, lucro e desempenho de cada viatura.
          </p>
        </div>

        <WalletCards aria-hidden="true" />
      </header>

      {loadError && <div className="admin-financial-error">{loadError}</div>}

      <section
        className={`admin-executive-summary admin-executive-summary-${financial.businessStatus.tone}`}
      >
        <div className="admin-executive-summary-heading">
          <div className="admin-executive-summary-heading-icon">
            <TrendingUp aria-hidden="true" />
          </div>

          <div>
            <span>Visão estratégica</span>
            <h3>Resumo executivo de {financial.executiveMonth}</h3>
            <p>Leitura rápida do desempenho financeiro e da frota.</p>
          </div>

          <div className="admin-executive-summary-status">
            <i />
            <span>
              <small>Estado do negócio</small>
              <strong>{financial.businessStatus.label}</strong>
            </span>
          </div>
        </div>

        <div className="admin-executive-summary-kpis">
          <article className="is-revenue">
            <WalletCards aria-hidden="true" />

            <span>
              <small>Receita do mês</small>
              <strong>
                {formatMoney(financial.revenueMonth, financial.currency)}
              </strong>
            </span>
          </article>

          <article className="is-costs">
            <ReceiptText aria-hidden="true" />

            <span>
              <small>Custos do mês</small>
              <strong>
                {formatMoney(financial.costsMonth, financial.currency)}
              </strong>
            </span>
          </article>

          <article
            className={financial.profitMonth >= 0 ? "is-profit" : "is-loss"}
          >
            <CircleDollarSign aria-hidden="true" />

            <span>
              <small>Lucro do mês</small>
              <strong>
                {formatMoney(financial.profitMonth, financial.currency)}
              </strong>
            </span>
          </article>

          <article className="is-margin">
            <TrendingUp aria-hidden="true" />

            <span>
              <small>Margem mensal</small>
              <strong>{financial.monthlyProfitMargin.toFixed(1)}%</strong>
            </span>
          </article>
        </div>

        <div className="admin-executive-summary-insights">
          <article>
            <div className="admin-executive-summary-insight-icon is-best">
              <Crown aria-hidden="true" />
            </div>

            <span>
              <small>Melhor viatura</small>

              <strong>
                {financial.bestPerformingVehicle
                  ? financial.bestPerformingVehicle.name
                  : "Sem dados"}
              </strong>

              <p>
                {financial.bestPerformingVehicle
                  ? `${formatMoney(
                      financial.bestPerformingVehicle.profit,
                      financial.currency,
                    )} de lucro`
                  : "Ainda não existem alugueres concluídos."}
              </p>
            </span>
          </article>

          <article>
            <div className="admin-executive-summary-insight-icon is-cost">
              <ReceiptText aria-hidden="true" />
            </div>

            <span>
              <small>Viatura com maior custo</small>

              <strong>
                {financial.highestCostVehicle
                  ? financial.highestCostVehicle.name
                  : "Sem dados"}
              </strong>

              <p>
                {financial.highestCostVehicle
                  ? `${formatMoney(
                      financial.highestCostVehicle.costs,
                      financial.currency,
                    )} em custos`
                  : "Ainda não existem custos registados."}
              </p>
            </span>
          </article>

          <article className="admin-executive-summary-analysis">
            <div className="admin-executive-summary-insight-icon is-analysis">
              <TrendingUp aria-hidden="true" />
            </div>

            <span>
              <small>Análise automática</small>
              <strong>{financial.businessStatus.label}</strong>
              <p>{financial.businessStatus.message}</p>
            </span>
          </article>
        </div>
      </section>

      <section className="admin-intelligent-alerts">
        <div className="admin-intelligent-alerts-heading">
          <div className="admin-intelligent-alerts-icon">
            <BellRing aria-hidden="true" />

            {financial.criticalAlerts > 0 && (
              <strong>{financial.criticalAlerts}</strong>
            )}
          </div>

          <div>
            <span>Centro de atenção</span>
            <h3>Alertas inteligentes</h3>
            <p>Seguros, revisões e movimentos que exigem acompanhamento.</p>
          </div>

          <div className="admin-intelligent-alerts-total">
            <small>Total</small>
            <strong>{financial.intelligentAlerts.length}</strong>
          </div>
        </div>

        {financial.intelligentAlerts.length === 0 ? (
          <div className="admin-intelligent-alerts-clear">
            <ShieldAlert aria-hidden="true" />

            <div>
              <strong>Tudo sob controlo</strong>
              <span>Não existem alertas importantes neste momento.</span>
            </div>
          </div>
        ) : (
          <div className="admin-intelligent-alerts-grid">
            {financial.intelligentAlerts.map((alert) => {
              const AlertIcon =
                alert.type === "Seguro"
                  ? ShieldAlert
                  : alert.type === "Revisão"
                    ? Wrench
                    : alert.id === "pickups-today"
                      ? ArrowUpRight
                      : alert.id === "returns-today"
                        ? ArrowDownLeft
                        : alert.type === "Clientes"
                          ? Users
                          : AlertTriangle;

              return (
                <article
                  key={alert.id}
                  className={`admin-intelligent-alert admin-intelligent-alert-${alert.severity}`}
                >
                  <div>
                    <AlertIcon aria-hidden="true" />
                  </div>

                  <span>
                    <small>{alert.type}</small>
                    <strong>{alert.title}</strong>
                    <p>{alert.description}</p>
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="admin-daily-timeline">
        <div className="admin-daily-timeline-heading">
          <div className="admin-daily-timeline-heading-icon">
            <Clock3 aria-hidden="true" />
          </div>

          <div>
            <span>Operação de hoje</span>
            <h3>Timeline de entregas e devoluções</h3>
            <p>Todos os movimentos organizados por hora.</p>
          </div>

          <div className="admin-daily-timeline-summary">
            <div>
              <ArrowUpRight aria-hidden="true" />
              <span>
                <small>Entregas</small>
                <strong>{financial.pickupsToday}</strong>
              </span>
            </div>

            <div>
              <ArrowDownLeft aria-hidden="true" />
              <span>
                <small>Devoluções</small>
                <strong>{financial.returnsToday}</strong>
              </span>
            </div>
          </div>
        </div>

        {financial.todayTimeline.length === 0 ? (
          <div className="admin-daily-timeline-empty">
            <CalendarDays aria-hidden="true" />

            <div>
              <strong>Sem movimentos programados</strong>
              <span>Não existem entregas ou devoluções para hoje.</span>
            </div>
          </div>
        ) : (
          <div className="admin-daily-timeline-list">
            {financial.todayTimeline.map((movement, index) => (
              <article
                key={movement.id}
                className={`admin-daily-timeline-item admin-daily-timeline-${movement.type}`}
              >
                <div className="admin-daily-timeline-time">
                  <Clock3 aria-hidden="true" />
                  <strong>{movement.time}</strong>
                </div>

                <div className="admin-daily-timeline-rail">
                  <i />

                  {index < financial.todayTimeline.length - 1 && <span />}
                </div>

                <div className="admin-daily-timeline-card">
                  <div className="admin-daily-timeline-card-icon">
                    {movement.type === "pickup" ? (
                      <ArrowUpRight aria-hidden="true" />
                    ) : (
                      <ArrowDownLeft aria-hidden="true" />
                    )}
                  </div>

                  <div className="admin-daily-timeline-main">
                    <span>{movement.title}</span>

                    <strong>{movement.car}</strong>

                    <small>{movement.customer}</small>
                  </div>

                  <div className="admin-daily-timeline-meta">
                    <span>
                      <MapPinned aria-hidden="true" />
                      {movement.reference}
                    </span>

                    <i className={`status-${movement.status}`}>
                      {getTimelineStatusLabel(movement.status)}
                    </i>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-live-fleet-map">
        <div className="admin-live-fleet-heading">
          <div className="admin-live-fleet-heading-icon">
            <CarFront aria-hidden="true" />
          </div>

          <div>
            <span>Estado operacional</span>
            <h3>Frota em tempo real</h3>
            <p>
              Disponibilidade, utilização e viaturas que precisam de atenção.
            </p>
          </div>

          <div className="admin-live-fleet-usage">
            <span>
              <Gauge aria-hidden="true" />
              Utilização
            </span>

            <strong>{financial.fleetUsageRate}%</strong>

            <div>
              <i
                style={{
                  width: `${Math.min(financial.fleetUsageRate, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="admin-live-fleet-summary">
          <article className="is-available">
            <CircleCheck aria-hidden="true" />
            <span>
              <small>Disponíveis</small>
              <strong>{financial.fleetStatusCounts.available}</strong>
            </span>
          </article>

          <article className="is-rented">
            <CarFront aria-hidden="true" />
            <span>
              <small>Alugadas</small>
              <strong>{financial.fleetStatusCounts.rented}</strong>
            </span>
          </article>

          <article className="is-limited">
            <CircleParking aria-hidden="true" />
            <span>
              <small>Limitadas</small>
              <strong>{financial.fleetStatusCounts.limited}</strong>
            </span>
          </article>

          <article className="is-attention">
            <AlertTriangle aria-hidden="true" />
            <span>
              <small>Atenção</small>
              <strong>{financial.fleetStatusCounts.attention}</strong>
            </span>
          </article>
        </div>

        {financial.fleetMap.length === 0 ? (
          <div className="admin-live-fleet-empty">
            Ainda não existem viaturas registadas.
          </div>
        ) : (
          <div className="admin-live-fleet-grid">
            {financial.fleetMap.map((car) => (
              <article
                key={car.id}
                className={`admin-live-fleet-car admin-live-fleet-car-${car.visualStatus}`}
              >
                <div>
                  <CarFront aria-hidden="true" />
                </div>

                <span>
                  <strong>{car.name}</strong>
                  <small>{car.label}</small>
                </span>

                <i />
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="admin-financial-primary-kpis">
        <article>
          <div>
            <span>Receita hoje</span>
            <CalendarDays aria-hidden="true" />
          </div>

          <strong>
            {formatMoney(financial.revenueToday, financial.currency)}
          </strong>

          <small>Alugueres concluídos hoje</small>
        </article>

        <article>
          <div>
            <span>Receita este mês</span>
            <TrendingUp aria-hidden="true" />
          </div>

          <strong>
            {formatMoney(financial.revenueMonth, financial.currency)}
          </strong>

          <small>Receita confirmada no mês atual</small>

          <div
            className={`admin-financial-comparison ${
              financial.revenueChange >= 0 ? "is-positive" : "is-negative"
            }`}
          >
            {financial.revenueChange >= 0 ? (
              <TrendingUp aria-hidden="true" />
            ) : (
              <TrendingDown aria-hidden="true" />
            )}

            <span>
              {Math.abs(financial.revenueChange).toFixed(1)}% vs. mês anterior
            </span>
          </div>
        </article>

        <article>
          <div>
            <span>Custos este mês</span>
            <TrendingDown aria-hidden="true" />
          </div>

          <strong>
            {formatMoney(financial.costsMonth, financial.currency)}
          </strong>

          <small>Oficina e despesas adicionais</small>

          <div
            className={`admin-financial-comparison ${
              financial.costsChange <= 0 ? "is-positive" : "is-negative"
            }`}
          >
            {financial.costsChange <= 0 ? (
              <TrendingDown aria-hidden="true" />
            ) : (
              <TrendingUp aria-hidden="true" />
            )}

            <span>
              {Math.abs(financial.costsChange).toFixed(1)}% vs. mês anterior
            </span>
          </div>
        </article>

        <article
          className={financial.profitMonth >= 0 ? "is-profit" : "is-loss"}
        >
          <div>
            <span>Lucro este mês</span>
            <CircleDollarSign aria-hidden="true" />
          </div>

          <strong>
            {formatMoney(financial.profitMonth, financial.currency)}
          </strong>

          <small>Receita menos custos do mês</small>

          <div
            className={`admin-financial-comparison ${
              financial.profitChange >= 0 ? "is-positive" : "is-negative"
            }`}
          >
            {financial.profitChange >= 0 ? (
              <TrendingUp aria-hidden="true" />
            ) : (
              <TrendingDown aria-hidden="true" />
            )}

            <span>
              {Math.abs(financial.profitChange).toFixed(1)}% vs. mês anterior
            </span>
          </div>
        </article>
      </div>

      <div className="admin-financial-secondary-kpis">
        <article>
          <span>Receita anual</span>
          <strong>
            {formatMoney(financial.revenueYear, financial.currency)}
          </strong>
        </article>

        <article>
          <span>Receita total</span>
          <strong>
            {formatMoney(financial.totalRevenue, financial.currency)}
          </strong>
        </article>

        <article>
          <span>Custos totais</span>
          <strong>
            {formatMoney(financial.totalCosts, financial.currency)}
          </strong>
        </article>

        <article>
          <span>Lucro total</span>
          <strong>
            {formatMoney(financial.totalProfit, financial.currency)}
          </strong>
        </article>

        <article>
          <span>Margem</span>
          <strong>{financial.profitMargin.toFixed(1)}%</strong>
        </article>

        <article>
          <span>Alugueres concluídos</span>
          <strong>{financial.completedBookings}</strong>
        </article>

        <article>
          <span>Média por reserva</span>
          <strong>
            {formatMoney(
              financial.averageRevenuePerBooking,
              financial.currency,
            )}
          </strong>
        </article>

        <article>
          <span>Melhor mês</span>
          <strong>
            {financial.bestMonth
              ? `${financial.bestMonth.month} · ${formatMoney(
                  financial.bestMonth.profit,
                  financial.currency,
                )}`
              : "Sem dados"}
          </strong>
        </article>

        <article>
          <span>Pior mês</span>
          <strong>
            {financial.worstMonth
              ? `${financial.worstMonth.month} · ${formatMoney(
                  financial.worstMonth.profit,
                  financial.currency,
                )}`
              : "Sem dados"}
          </strong>
        </article>
      </div>

      <article className="admin-financial-panel admin-financial-chart-panel">
        <div className="admin-financial-panel-heading">
          <div>
            <span>Evolução financeira</span>
            <h3>Receita, custos e lucro</h3>
          </div>

          <TrendingUp aria-hidden="true" />
        </div>

        <div className="admin-financial-chart-summary">
          <div>
            <i className="is-revenue" />
            <span>Receita</span>
          </div>

          <div>
            <i className="is-costs" />
            <span>Custos</span>
          </div>

          <div>
            <i className="is-profit" />
            <span>Lucro</span>
          </div>

          <small>Últimos 12 meses</small>
        </div>

        <div className="admin-financial-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={financial.monthlyFinancialData}
              margin={{
                top: 16,
                right: 12,
                left: 0,
                bottom: 2,
              }}
            >
              <defs>
                <linearGradient
                  id="financialRevenueGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>

                <linearGradient
                  id="financialCostsGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.26} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>

                <linearGradient
                  id="financialProfitGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                </linearGradient>
              </defs>

              <CartesianGrid
                stroke="rgba(148, 163, 184, 0.12)"
                strokeDasharray="4 5"
                vertical={false}
              />

              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: "currentColor",
                  fontSize: 10,
                }}
                tickMargin={11}
              />

              <YAxis
                axisLine={false}
                tickLine={false}
                width={58}
                tick={{
                  fill: "currentColor",
                  fontSize: 9,
                }}
                tickFormatter={(value) =>
                  `${financial.currency}${Number(value).toLocaleString(
                    "pt-PT",
                    {
                      notation: "compact",
                      maximumFractionDigits: 1,
                    },
                  )}`
                }
              />

              <Tooltip
                cursor={{
                  stroke: "rgba(148, 163, 184, 0.3)",
                  strokeDasharray: "4 4",
                }}
                contentStyle={{
                  border: "1px solid rgba(148, 163, 184, 0.18)",
                  borderRadius: "14px",
                  background: "rgba(15, 23, 42, 0.96)",
                  boxShadow: "0 18px 45px rgba(0, 0, 0, 0.28)",
                  color: "#f8fafc",
                  fontSize: "11px",
                }}
                labelStyle={{
                  color: "#cbd5e1",
                  fontWeight: 800,
                  marginBottom: "6px",
                }}
                formatter={(value, name) => {
                  const labels: Record<string, string> = {
                    revenue: "Receita",
                    costs: "Custos",
                    profit: "Lucro",
                  };

                  return [
                    formatMoney(Number(value || 0), financial.currency),
                    labels[String(name)] || String(name),
                  ];
                }}
              />

              <Legend
                verticalAlign="top"
                align="right"
                height={32}
                iconType="circle"
                formatter={(value) => {
                  const labels: Record<string, string> = {
                    revenue: "Receita",
                    costs: "Custos",
                    profit: "Lucro",
                  };

                  return labels[String(value)] || String(value);
                }}
              />

              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={3}
                fill="url(#financialRevenueGradient)"
                activeDot={{
                  r: 5,
                  strokeWidth: 3,
                  stroke: "#052e16",
                  fill: "#4ade80",
                }}
                isAnimationActive
                animationDuration={850}
              />

              <Area
                type="monotone"
                dataKey="costs"
                stroke="#f97316"
                strokeWidth={2.5}
                fill="url(#financialCostsGradient)"
                activeDot={{
                  r: 5,
                  strokeWidth: 3,
                  stroke: "#431407",
                  fill: "#fb923c",
                }}
                isAnimationActive
                animationDuration={950}
              />

              <Area
                type="monotone"
                dataKey="profit"
                stroke="#a855f7"
                strokeWidth={2.5}
                fill="url(#financialProfitGradient)"
                activeDot={{
                  r: 5,
                  strokeWidth: 3,
                  stroke: "#3b0764",
                  fill: "#c084fc",
                }}
                isAnimationActive
                animationDuration={1050}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>

      <div className="admin-financial-main-grid">
        <article className="admin-financial-panel">
          <div className="admin-financial-panel-heading">
            <div>
              <span>Rentabilidade</span>
              <h3>Ranking das viaturas</h3>
            </div>

            <Trophy aria-hidden="true" />
          </div>

          {financial.vehicleRanking.length === 0 ? (
            <div className="admin-financial-empty">
              Ainda não existem alugueres concluídos.
            </div>
          ) : (
            <div className="admin-financial-ranking">
              {financial.vehicleRanking.map((vehicle, index) => (
                <article key={vehicle.id}>
                  <div className="admin-financial-position">
                    {index === 0 ? (
                      <Crown aria-hidden="true" />
                    ) : (
                      <strong>{index + 1}</strong>
                    )}
                  </div>

                  <div className="admin-financial-vehicle-name">
                    <CarFront aria-hidden="true" />

                    <span>
                      <strong>{vehicle.name}</strong>
                      <small>
                        {vehicle.bookings} aluguer(es) · {vehicle.totalDays}{" "}
                        dia(s)
                      </small>
                    </span>
                  </div>

                  <div>
                    <small>Receita</small>
                    <strong>
                      {formatMoney(vehicle.revenue, financial.currency)}
                    </strong>
                  </div>

                  <div>
                    <small>Custos</small>
                    <strong>
                      {formatMoney(vehicle.costs, financial.currency)}
                    </strong>
                  </div>

                  <div
                    className={
                      vehicle.profit >= 0 ? "is-positive" : "is-negative"
                    }
                  >
                    <small>Lucro</small>
                    <strong>
                      {formatMoney(vehicle.profit, financial.currency)}
                    </strong>
                  </div>

                  <div className="admin-financial-ranking-performance">
                    <div>
                      <span>Rentabilidade relativa</span>

                      <strong>
                        {Math.max(
                          0,
                          Math.round(
                            (Math.max(vehicle.profit, 0) /
                              financial.maximumVehicleProfit) *
                              100,
                          ),
                        )}
                        %
                      </strong>
                    </div>

                    <div className="admin-financial-ranking-progress">
                      <span
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              (Math.max(vehicle.profit, 0) /
                                financial.maximumVehicleProfit) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <aside className="admin-financial-side">
          <article className="admin-financial-panel">
            <div className="admin-financial-panel-heading">
              <div>
                <span>Custos do mês</span>
                <h3>Distribuição</h3>
              </div>

              <ReceiptText aria-hidden="true" />
            </div>

            <div className="admin-financial-cost-list">
              <div>
                <span>Oficina</span>
                <strong>
                  {formatMoney(financial.maintenanceMonth, financial.currency)}
                </strong>
              </div>

              <div>
                <span>Outras despesas</span>
                <strong>
                  {formatMoney(financial.expensesMonth, financial.currency)}
                </strong>
              </div>

              <div>
                <span>Total do mês</span>
                <strong>
                  {formatMoney(financial.costsMonth, financial.currency)}
                </strong>
              </div>
            </div>
          </article>

          <article className="admin-financial-panel">
            <div className="admin-financial-panel-heading">
              <div>
                <span>CRM</span>
                <h3>Clientes</h3>
              </div>

              <Users aria-hidden="true" />
            </div>

            <div className="admin-financial-customer-list">
              <div>
                <span>Total</span>
                <strong>{financial.customers}</strong>
              </div>

              <div>
                <span>Ativos</span>
                <strong>{financial.activeCustomers}</strong>
              </div>

              <div>
                <span>Recorrentes</span>
                <strong>{financial.returningCustomers}</strong>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}
