import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  createMonthlyFinancialReportPdf,
  type MonthlyFinancialReportData,
  type MonthlyReportExpense,
  type MonthlyReportRevenue,
  type MonthlyReportVehicle,
} from "@/components/admin/pdf/createMonthlyFinancialReportPdf";

export const runtime = "nodejs";

const ADMIN_EMAIL = "her.dos.santos.nascimento@gmail.com";

type ReportBookingDocument = {
  id: string;
  status?: string;
  returnDate?: string;
  reference?: string;
  customerName?: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  estimatedTotal?: number;
  currency?: string;
};

type ReportMaintenanceDocument = {
  id: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  date?: string;
  category?: string;
  cost?: number;
  currency?: string;
};

type ReportExpenseDocument = {
  id: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  date?: string;
  category?: string;
  amount?: number;
  currency?: string;
};

type ReportFleetDocument = {
  id: string;
  brand?: string;
  model?: string;
  currency?: string;
};

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

function createPeriod(month: number, year: number) {
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;

  return {
    monthKey,
    startDate: `${monthKey}-01`,
    endDate: `${monthKey}-31`,
  };
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

    const { monthKey } = createPeriod(month, year);

    const reportNumber = `FIN-${year}-${String(month).padStart(2, "0")}`;

    const closedReportSnapshot = await adminDb
      .collection("financialReports")
      .doc(reportNumber)
      .get();

    if (closedReportSnapshot.exists) {
      const closedReport = closedReportSnapshot.data();

      const archivedReport = closedReport?.reportData as
        MonthlyFinancialReportData | undefined;

      if (archivedReport) {
        const pdfBuffer = await createMonthlyFinancialReportPdf(archivedReport);

        const filename = `Relatorio-Financeiro-7Go-${
          archivedReport.monthLabel
        }-${archivedReport.year}.pdf`;

        return new Response(new Uint8Array(pdfBuffer), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
            "X-Report-Source": "archived",
          },
        });
      }
    }

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
        }) as ReportBookingDocument,
    );

    const maintenance = maintenanceSnapshot.docs.map(
      (item) =>
        ({
          id: item.id,
          ...item.data(),
        }) as ReportMaintenanceDocument,
    );

    const expenses = expensesSnapshot.docs.map(
      (item) =>
        ({
          id: item.id,
          ...item.data(),
        }) as ReportExpenseDocument,
    );

    const fleet = fleetSnapshot.docs.map(
      (item) =>
        ({
          id: item.id,
          ...item.data(),
        }) as ReportFleetDocument,
    );

    const completedBookings = bookings.filter(
      (booking) =>
        booking.status === "completed" &&
        typeof booking.returnDate === "string" &&
        booking.returnDate.startsWith(monthKey),
    );

    const periodMaintenance = maintenance.filter(
      (record) =>
        typeof record.date === "string" && record.date.startsWith(monthKey),
    );

    const periodExpenses = expenses.filter(
      (expense) =>
        typeof expense.date === "string" && expense.date.startsWith(monthKey),
    );

    const currency =
      completedBookings.find((booking) => typeof booking.currency === "string")
        ?.currency ||
      periodExpenses.find((expense) => typeof expense.currency === "string")
        ?.currency ||
      periodMaintenance.find((record) => typeof record.currency === "string")
        ?.currency ||
      "€";

    const revenues: MonthlyReportRevenue[] = completedBookings
      .map((booking) => ({
        id: booking.id,
        date: formatDate(String(booking.returnDate || "")),
        reference: String(booking.reference || booking.id),
        customer: String(booking.customerName || "Cliente não identificado"),
        vehicle: `${String(booking.carBrand || "Viatura")} ${String(
          booking.carModel || "",
        )}`.trim(),
        amount: asNumber(booking.estimatedTotal),
      }))
      .sort((first, second) => first.date.localeCompare(second.date));

    const workshopExpenses: MonthlyReportExpense[] = periodMaintenance.map(
      (record) => ({
        id: `maintenance-${record.id}`,
        date: formatDate(String(record.date || "")),
        category: String(record.category || "Manutenção/Oficina"),
        vehicle:
          `${String(record.carBrand || "")} ${String(
            record.carModel || "",
          )}`.trim() ||
          String(
            fleet.find((car) => car.id === record.carId)?.brand || "Viatura",
          ),
        origin: "Oficina",
        amount: asNumber(record.cost),
      }),
    );

    const manualExpenses: MonthlyReportExpense[] = periodExpenses.map(
      (expense) => ({
        id: `expense-${expense.id}`,
        date: formatDate(String(expense.date || "")),
        category: String(expense.category || "Outro"),
        vehicle:
          `${String(expense.carBrand || "")} ${String(
            expense.carModel || "",
          )}`.trim() ||
          String(
            fleet.find((car) => car.id === expense.carId)?.brand || "Viatura",
          ),
        origin: "Despesa",
        amount: asNumber(expense.amount),
      }),
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
      if (typeof booking.carId === "string") {
        vehicleIds.add(booking.carId);
      }
    });

    periodMaintenance.forEach((record) => {
      if (typeof record.carId === "string") {
        vehicleIds.add(record.carId);
      }
    });

    periodExpenses.forEach((expense) => {
      if (typeof expense.carId === "string") {
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

        const bookingVehicle = carBookings[0];

        return {
          id: carId,
          vehicle: `${String(
            catalogCar?.brand || bookingVehicle?.carBrand || "Viatura",
          )} ${String(
            catalogCar?.model || bookingVehicle?.carModel || "",
          )}`.trim(),
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

    const report: MonthlyFinancialReportData = {
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

    const pdfBuffer = await createMonthlyFinancialReportPdf(report);

    const filename = `Relatorio-Financeiro-7Go-${monthNames[month - 1].replace(
      /\s+/g,
      "-",
    )}-${year}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("ERRO AO GERAR RELATÓRIO FINANCEIRO:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    return Response.json({ error: message }, { status: 500 });
  }
}
