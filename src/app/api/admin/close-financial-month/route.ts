import { FieldValue } from "firebase-admin/firestore";

import {
  type MonthlyFinancialReportData,
  type MonthlyReportExpense,
  type MonthlyReportRevenue,
  type MonthlyReportVehicle,
} from "@/components/admin/pdf/createMonthlyFinancialReportPdf";
import { getFirebaseAdmin } from "@/lib/firebase/admin";

export const runtime = "nodejs";

const ADMIN_EMAIL = "her.dos.santos.nascimento@gmail.com";

const monthNames = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type BookingDocument = {
  id: string;
  reference?: string;
  status?: string;
  customerName?: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  returnDate?: string;
  estimatedTotal?: number;
  currency?: string;
};

type MaintenanceDocument = {
  id: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  date?: string;
  category?: string;
  cost?: number;
  currency?: string;
};

type ExpenseDocument = {
  id: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  date?: string;
  category?: string;
  amount?: number;
  currency?: string;
};

type FleetDocument = {
  id: string;
  brand?: string;
  model?: string;
  currency?: string;
};

function asNumber(value: unknown) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: string) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return Response.json(
        { error: "Sessão de Admin inválida." },
        { status: 401 },
      );
    }

    const token = authorization.slice("Bearer ".length);

    const { adminAuth, adminDb } = getFirebaseAdmin();

    const decodedToken = await adminAuth.verifyIdToken(token);

    if (decodedToken.email !== ADMIN_EMAIL) {
      return Response.json(
        { error: "Acesso não autorizado." },
        { status: 403 },
      );
    }

    const body = (await request.json()) as {
      month?: number;
      year?: number;
    };

    const month = Number(body.month);
    const year = Number(body.year);

    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(year) ||
      year < 2020 ||
      year > 2100
    ) {
      return Response.json({ error: "Mês ou ano inválido." }, { status: 400 });
    }

    const reportNumber = `FIN-${year}-${String(month).padStart(2, "0")}`;

    const reportReference = adminDb
      .collection("financialReports")
      .doc(reportNumber);

    const existingSnapshot = await reportReference.get();

    if (existingSnapshot.exists) {
      return Response.json(
        {
          error: "Este mês já foi fechado anteriormente.",
          reportNumber,
        },
        { status: 409 },
      );
    }

    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    const [
      bookingsSnapshot,
      maintenanceSnapshot,
      expensesSnapshot,
      fleetSnapshot,
    ] = await Promise.all([
      adminDb.collection("bookings").get(),
      adminDb.collection("maintenanceRecords").get(),
      adminDb.collection("fleetExpenses").get(),
      adminDb.collection("carCatalog").get(),
    ]);

    const bookings = bookingsSnapshot.docs.map(
      (item) =>
        ({
          id: item.id,
          ...item.data(),
        }) as BookingDocument,
    );

    const maintenance = maintenanceSnapshot.docs.map(
      (item) =>
        ({
          id: item.id,
          ...item.data(),
        }) as MaintenanceDocument,
    );

    const expenses = expensesSnapshot.docs.map(
      (item) =>
        ({
          id: item.id,
          ...item.data(),
        }) as ExpenseDocument,
    );

    const fleet = fleetSnapshot.docs.map(
      (item) =>
        ({
          id: item.id,
          ...item.data(),
        }) as FleetDocument,
    );

    const completedBookings = bookings.filter(
      (booking) =>
        booking.status === "completed" &&
        booking.returnDate?.startsWith(monthKey),
    );

    const periodMaintenance = maintenance.filter((record) =>
      record.date?.startsWith(monthKey),
    );

    const periodExpenses = expenses.filter((expense) =>
      expense.date?.startsWith(monthKey),
    );

    const currency =
      completedBookings.find((booking) => booking.currency)?.currency ||
      periodExpenses.find((expense) => expense.currency)?.currency ||
      periodMaintenance.find((record) => record.currency)?.currency ||
      fleet.find((car) => car.currency)?.currency ||
      "€";

    const revenues: MonthlyReportRevenue[] = completedBookings
      .map((booking) => ({
        id: booking.id,
        date: formatDate(booking.returnDate || ""),
        reference: booking.reference || booking.id,
        customer: booking.customerName || "Cliente não identificado",
        vehicle: `${booking.carBrand || "Viatura"} ${
          booking.carModel || ""
        }`.trim(),
        amount: asNumber(booking.estimatedTotal),
      }))
      .sort((first, second) => first.date.localeCompare(second.date));

    const workshopExpenses: MonthlyReportExpense[] = periodMaintenance.map(
      (record) => {
        const catalogCar = fleet.find((car) => car.id === record.carId);

        return {
          id: `maintenance-${record.id}`,
          date: formatDate(record.date || ""),
          category: record.category || "Manutenção/Oficina",
          vehicle: `${record.carBrand || catalogCar?.brand || "Viatura"} ${
            record.carModel || catalogCar?.model || ""
          }`.trim(),
          origin: "Oficina",
          amount: asNumber(record.cost),
        };
      },
    );

    const manualExpenses: MonthlyReportExpense[] = periodExpenses.map(
      (expense) => {
        const catalogCar = fleet.find((car) => car.id === expense.carId);

        return {
          id: `expense-${expense.id}`,
          date: formatDate(expense.date || ""),
          category: expense.category || "Outro",
          vehicle: `${expense.carBrand || catalogCar?.brand || "Viatura"} ${
            expense.carModel || catalogCar?.model || ""
          }`.trim(),
          origin: "Despesa",
          amount: asNumber(expense.amount),
        };
      },
    );

    const reportExpenses = [...workshopExpenses, ...manualExpenses].sort(
      (first, second) => first.date.localeCompare(second.date),
    );

    const totalRevenue = revenues.reduce(
      (total, item) => total + item.amount,
      0,
    );

    const workshopCosts = workshopExpenses.reduce(
      (total, item) => total + item.amount,
      0,
    );

    const otherExpenses = manualExpenses.reduce(
      (total, item) => total + item.amount,
      0,
    );

    const totalCosts = workshopCosts + otherExpenses;

    const netProfit = totalRevenue - totalCosts;

    const profitMargin =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const vehicleIds = new Set<string>();

    completedBookings.forEach((booking) => {
      if (booking.carId) {
        vehicleIds.add(booking.carId);
      }
    });

    periodMaintenance.forEach((record) => {
      if (record.carId) {
        vehicleIds.add(record.carId);
      }
    });

    periodExpenses.forEach((expense) => {
      if (expense.carId) {
        vehicleIds.add(expense.carId);
      }
    });

    const vehicles: MonthlyReportVehicle[] = Array.from(vehicleIds)
      .map((carId) => {
        const catalogCar = fleet.find((car) => car.id === carId);

        const carBookings = completedBookings.filter(
          (booking) => booking.carId === carId,
        );

        const carMaintenance = periodMaintenance.filter(
          (record) => record.carId === carId,
        );

        const carExpenses = periodExpenses.filter(
          (expense) => expense.carId === carId,
        );

        const revenue = carBookings.reduce(
          (total, booking) => total + asNumber(booking.estimatedTotal),
          0,
        );

        const costs =
          carMaintenance.reduce(
            (total, record) => total + asNumber(record.cost),
            0,
          ) +
          carExpenses.reduce(
            (total, expense) => total + asNumber(expense.amount),
            0,
          );

        return {
          id: carId,
          vehicle:
            `${catalogCar?.brand || carBookings[0]?.carBrand || "Viatura"} ${
              catalogCar?.model || carBookings[0]?.carModel || ""
            }`.trim(),
          revenue,
          costs,
          profit: revenue - costs,
          bookings: carBookings.length,
        };
      })
      .sort((first, second) => second.profit - first.profit);

    const bestVehicle = vehicles[0];

    const highestCostVehicle =
      vehicles.length > 0
        ? [...vehicles].sort((first, second) => second.costs - first.costs)[0]
        : undefined;

    const reportData: MonthlyFinancialReportData = {
      month,
      year,
      monthLabel: monthNames[month - 1],
      generatedAt: new Intl.DateTimeFormat("pt-PT", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Europe/London",
      }).format(new Date()),
      currency,
      totalRevenue,
      workshopCosts,
      otherExpenses,
      totalCosts,
      netProfit,
      profitMargin,
      completedBookings: completedBookings.length,
      averageRevenue:
        completedBookings.length > 0
          ? totalRevenue / completedBookings.length
          : 0,
      revenues,
      expenses: reportExpenses,
      vehicles,
      bestVehicle,
      highestCostVehicle,
    };

    await reportReference.create({
      reportNumber,
      month,
      year,
      monthLabel: monthNames[month - 1],
      status: "closed",
      currency,
      totalRevenue,
      workshopCosts,
      otherExpenses,
      totalCosts,
      netProfit,
      profitMargin,
      completedBookings: completedBookings.length,
      averageRevenue: reportData.averageRevenue,
      vehicleCount: vehicles.length,
      reportData,
      createdBy: decodedToken.email || ADMIN_EMAIL,
      createdAt: FieldValue.serverTimestamp(),
      closedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return Response.json({
      ok: true,
      reportNumber,
      message: `${monthNames[month - 1]} ${year} foi fechado com sucesso.`,
    });
  } catch (error) {
    console.error("ERRO AO FECHAR MÊS FINANCEIRO:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    return Response.json({ error: message }, { status: 500 });
  }
}
