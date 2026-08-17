import ExcelJS from "exceljs";

import type {
  MonthlyFinancialReportData,
  MonthlyReportExpense,
  MonthlyReportRevenue,
  MonthlyReportVehicle,
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

const darkGreen = "FF166534";
const green = "FF22C55E";
const lightGreen = "FFDCFCE7";
const veryLightGreen = "FFF0FDF4";
const darkText = "FF172019";
const mutedText = "FF64748B";
const lightBorder = "FFDCE4DD";
const white = "FFFFFFFF";
const red = "FFB91C1C";
const orange = "FFF97316";
const blue = "FF2563EB";

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

function currencyFormat(currency: string) {
  const safeCurrency = currency.replace(/"/g, "");

  return `"${safeCurrency}"#,##0.00;[Red]-"${safeCurrency}"#,##0.00`;
}

function styleTitle(
  worksheet: ExcelJS.Worksheet,
  title: string,
  subtitle: string,
) {
  worksheet.mergeCells("A1:F1");
  worksheet.getCell("A1").value = "7Go STP";
  worksheet.getCell("A1").font = {
    name: "Arial",
    size: 22,
    bold: true,
    color: { argb: green },
  };
  worksheet.getCell("A1").alignment = {
    vertical: "middle",
    horizontal: "left",
  };

  worksheet.mergeCells("A2:F2");
  worksheet.getCell("A2").value = title;
  worksheet.getCell("A2").font = {
    name: "Arial",
    size: 15,
    bold: true,
    color: { argb: darkText },
  };

  worksheet.mergeCells("A3:F3");
  worksheet.getCell("A3").value = subtitle;
  worksheet.getCell("A3").font = {
    name: "Arial",
    size: 10,
    italic: true,
    color: { argb: mutedText },
  };

  worksheet.getRow(1).height = 31;
  worksheet.getRow(2).height = 23;
  worksheet.getRow(3).height = 19;

  worksheet.getRow(4).height = 8;
}

function styleHeaderRow(
  row: ExcelJS.Row,
  options?: {
    fill?: string;
    color?: string;
  },
) {
  row.height = 23;

  row.eachCell((cell) => {
    cell.font = {
      name: "Arial",
      size: 9,
      bold: true,
      color: {
        argb: options?.color || darkGreen,
      },
    };

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: options?.fill || lightGreen,
      },
    };

    cell.alignment = {
      vertical: "middle",
      horizontal: "left",
    };

    cell.border = {
      top: {
        style: "thin",
        color: { argb: lightBorder },
      },
      left: {
        style: "thin",
        color: { argb: lightBorder },
      },
      bottom: {
        style: "thin",
        color: { argb: lightBorder },
      },
      right: {
        style: "thin",
        color: { argb: lightBorder },
      },
    };
  });
}

function styleDataRows(
  worksheet: ExcelJS.Worksheet,
  startRow: number,
  endRow: number,
) {
  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);

    row.height = 20;

    row.eachCell((cell) => {
      cell.font = {
        name: "Arial",
        size: 9,
        color: { argb: darkText },
      };

      cell.alignment = {
        vertical: "middle",
      };

      cell.border = {
        top: {
          style: "hair",
          color: { argb: lightBorder },
        },
        left: {
          style: "hair",
          color: { argb: lightBorder },
        },
        bottom: {
          style: "hair",
          color: { argb: lightBorder },
        },
        right: {
          style: "hair",
          color: { argb: lightBorder },
        },
      };

      if (rowNumber % 2 === 0) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAF9" },
        };
      }
    });
  }
}

async function buildCurrentReport(
  month: number,
  year: number,
  adminDb: FirebaseFirestore.Firestore,
) {
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
      const car = fleet.find((item) => item.id === record.carId);

      return {
        id: `maintenance-${record.id}`,
        date: formatDate(record.date || ""),
        category: record.category || "Manutenção/Oficina",
        vehicle: `${record.carBrand || car?.brand || "Viatura"} ${
          record.carModel || car?.model || ""
        }`.trim(),
        origin: "Oficina",
        amount: asNumber(record.cost),
      };
    },
  );

  const manualExpenses: MonthlyReportExpense[] = periodExpenses.map(
    (expense) => {
      const car = fleet.find((item) => item.id === expense.carId);

      return {
        id: `expense-${expense.id}`,
        date: formatDate(expense.date || ""),
        category: expense.category || "Outro",
        vehicle: `${expense.carBrand || car?.brand || "Viatura"} ${
          expense.carModel || car?.model || ""
        }`.trim(),
        origin: "Despesa",
        amount: asNumber(expense.amount),
      };
    },
  );

  const reportExpenses = [...workshopExpenses, ...manualExpenses].sort(
    (first, second) => first.date.localeCompare(second.date),
  );

  const totalRevenue = revenues.reduce((total, item) => total + item.amount, 0);

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

  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

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
        vehicle: `${
          catalogCar?.brand || carBookings[0]?.carBrand || "Viatura"
        } ${catalogCar?.model || carBookings[0]?.carModel || ""}`.trim(),
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

  return report;
}

function createWorkbook(report: MonthlyFinancialReportData) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "7Go STP";
  workbook.lastModifiedBy = "7Go STP";
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.company = "7Go STP";
  workbook.subject = "Relatório Financeiro Mensal";
  workbook.title = `Relatório Financeiro 7Go — ${report.monthLabel} ${report.year}`;

  const financialFormat = currencyFormat(report.currency);

  /*
   * 1. RESUMO FINANCEIRO
   */

  const summary = workbook.addWorksheet("Resumo Financeiro", {
    views: [
      {
        state: "frozen",
        ySplit: 5,
        showGridLines: false,
      },
    ],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      paperSize: 9,
    },
  });

  styleTitle(
    summary,
    "Relatório Financeiro Mensal",
    `${report.monthLabel} ${report.year} · Emitido em ${report.generatedAt}`,
  );

  summary.columns = [
    { key: "label", width: 27 },
    { key: "value", width: 20 },
    { key: "label2", width: 27 },
    { key: "value2", width: 20 },
    { key: "notes", width: 22 },
    { key: "extra", width: 18 },
  ];

  summary.getRow(5).values = ["Indicador", "Valor", "Indicador", "Valor"];

  styleHeaderRow(summary.getRow(5));

  const summaryRows = [
    [
      "Receita total",
      report.totalRevenue,
      "Custos de oficina",
      report.workshopCosts,
    ],
    [
      "Outras despesas",
      report.otherExpenses,
      "Custos totais",
      report.totalCosts,
    ],
    [
      "Lucro líquido",
      report.netProfit,
      "Margem líquida",
      report.profitMargin / 100,
    ],
    [
      "Reservas concluídas",
      report.completedBookings,
      "Média por reserva",
      report.averageRevenue,
    ],
    [
      "Número de viaturas",
      report.vehicles.length,
      "Estado do período",
      "Relatório financeiro",
    ],
  ];

  summaryRows.forEach((values, index) => {
    const row = summary.getRow(6 + index);

    row.values = values;

    row.getCell(1).font = {
      bold: true,
      color: { argb: mutedText },
    };

    row.getCell(3).font = {
      bold: true,
      color: { argb: mutedText },
    };

    row.getCell(2).font = {
      bold: true,
      color: {
        argb: index === 2 && report.netProfit < 0 ? red : darkText,
      },
    };

    row.getCell(4).font = {
      bold: true,
      color: { argb: darkText },
    };

    if ([0, 1, 2, 3].includes(index)) {
      row.getCell(2).numFmt = index === 3 ? "0" : financialFormat;
    }

    if ([0, 1, 3].includes(index)) {
      row.getCell(4).numFmt = index === 3 ? financialFormat : financialFormat;
    }

    if (index === 2) {
      row.getCell(4).numFmt = "0.0%";
    }
  });

  styleDataRows(summary, 6, 10);

  summary.mergeCells("A12:B12");
  summary.getCell("A12").value = "Melhor viatura";
  summary.getCell("A12").font = {
    bold: true,
    color: { argb: darkGreen },
  };
  summary.getCell("A12").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: lightGreen },
  };

  summary.mergeCells("C12:D12");
  summary.getCell("C12").value = "Viatura com maior custo";
  summary.getCell("C12").font = {
    bold: true,
    color: { argb: orange },
  };
  summary.getCell("C12").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF7ED" },
  };

  summary.mergeCells("A13:B14");
  summary.getCell("A13").value = report.bestVehicle
    ? `${report.bestVehicle.vehicle}\n${report.currency}${report.bestVehicle.profit.toLocaleString(
        "pt-PT",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      )} de lucro`
    : "Sem dados";

  summary.mergeCells("C13:D14");
  summary.getCell("C13").value = report.highestCostVehicle
    ? `${report.highestCostVehicle.vehicle}\n${report.currency}${report.highestCostVehicle.costs.toLocaleString(
        "pt-PT",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      )} em custos`
    : "Sem dados";

  for (const cellAddress of ["A13", "C13"]) {
    summary.getCell(cellAddress).alignment = {
      vertical: "middle",
      horizontal: "left",
      wrapText: true,
    };

    summary.getCell(cellAddress).font = {
      bold: true,
      size: 11,
      color: { argb: darkText },
    };
  }

  summary.getRow(13).height = 31;
  summary.getRow(14).height = 31;

  summary.mergeCells("A16:D16");
  summary.getCell("A16").value = "Observações contabilísticas";
  summary.getCell("A16").font = {
    bold: true,
    color: { argb: darkGreen },
  };
  summary.getCell("A16").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: lightGreen },
  };

  summary.mergeCells("A17:D21");
  summary.getCell("A17").value =
    "____________________________________________________________________\n\n____________________________________________________________________\n\n____________________________________________________________________";
  summary.getCell("A17").alignment = {
    vertical: "top",
    wrapText: true,
  };
  summary.getCell("A17").font = {
    color: { argb: mutedText },
  };

  /*
   * 2. RECEITAS
   */

  const revenues = workbook.addWorksheet("Receitas", {
    views: [
      {
        state: "frozen",
        ySplit: 5,
        showGridLines: false,
      },
    ],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      paperSize: 9,
    },
  });

  styleTitle(
    revenues,
    "Receitas do período",
    `${report.monthLabel} ${report.year}`,
  );

  revenues.columns = [
    { header: "Data", key: "date", width: 15 },
    {
      header: "Referência",
      key: "reference",
      width: 22,
    },
    {
      header: "Cliente",
      key: "customer",
      width: 30,
    },
    {
      header: "Viatura",
      key: "vehicle",
      width: 28,
    },
    {
      header: "Valor",
      key: "amount",
      width: 18,
    },
  ];

  const revenueHeader = revenues.getRow(5);
  revenueHeader.values = ["Data", "Referência", "Cliente", "Viatura", "Valor"];
  styleHeaderRow(revenueHeader);

  report.revenues.forEach((item) => {
    revenues.addRow({
      date: item.date,
      reference: item.reference,
      customer: item.customer,
      vehicle: item.vehicle,
      amount: item.amount,
    });
  });

  const revenueStart = 6;
  const revenueEnd = 5 + report.revenues.length;

  if (report.revenues.length > 0) {
    styleDataRows(revenues, revenueStart, revenueEnd);

    revenues.getColumn("amount").numFmt = financialFormat;
  }

  const revenueTotalRow = Math.max(revenueEnd + 2, 7);

  revenues.mergeCells(`A${revenueTotalRow}:D${revenueTotalRow}`);
  revenues.getCell(`A${revenueTotalRow}`).value = "TOTAL DE RECEITAS";

  revenues.getCell(`A${revenueTotalRow}`).font = {
    bold: true,
    color: { argb: darkGreen },
  };

  revenues.getCell(`E${revenueTotalRow}`).value =
    report.revenues.length > 0
      ? {
          formula: `SUM(E${revenueStart}:E${revenueEnd})`,
          result: report.totalRevenue,
        }
      : report.totalRevenue;

  revenues.getCell(`E${revenueTotalRow}`).numFmt = financialFormat;

  revenues.getCell(`E${revenueTotalRow}`).font = {
    bold: true,
    color: { argb: darkGreen },
  };

  revenues.getRow(revenueTotalRow).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: lightGreen },
  };

  /*
   * 3. DESPESAS
   */

  const expenses = workbook.addWorksheet("Despesas", {
    views: [
      {
        state: "frozen",
        ySplit: 5,
        showGridLines: false,
      },
    ],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      paperSize: 9,
    },
  });

  styleTitle(
    expenses,
    "Despesas do período",
    `${report.monthLabel} ${report.year}`,
  );

  expenses.columns = [
    { header: "Data", key: "date", width: 15 },
    {
      header: "Categoria",
      key: "category",
      width: 27,
    },
    {
      header: "Viatura",
      key: "vehicle",
      width: 28,
    },
    {
      header: "Origem",
      key: "origin",
      width: 17,
    },
    {
      header: "Valor",
      key: "amount",
      width: 18,
    },
  ];

  const expenseHeader = expenses.getRow(5);
  expenseHeader.values = ["Data", "Categoria", "Viatura", "Origem", "Valor"];
  styleHeaderRow(expenseHeader, {
    fill: "FFFFF7ED",
    color: "FF9A3412",
  });

  report.expenses.forEach((item) => {
    expenses.addRow({
      date: item.date,
      category: item.category,
      vehicle: item.vehicle,
      origin: item.origin,
      amount: item.amount,
    });
  });

  const expenseStart = 6;
  const expenseEnd = 5 + report.expenses.length;

  if (report.expenses.length > 0) {
    styleDataRows(expenses, expenseStart, expenseEnd);

    expenses.getColumn("amount").numFmt = financialFormat;
  }

  const expenseTotalRow = Math.max(expenseEnd + 2, 7);

  expenses.mergeCells(`A${expenseTotalRow}:D${expenseTotalRow}`);

  expenses.getCell(`A${expenseTotalRow}`).value = "TOTAL DE DESPESAS";

  expenses.getCell(`A${expenseTotalRow}`).font = {
    bold: true,
    color: { argb: orange },
  };

  expenses.getCell(`E${expenseTotalRow}`).value =
    report.expenses.length > 0
      ? {
          formula: `SUM(E${expenseStart}:E${expenseEnd})`,
          result: report.totalCosts,
        }
      : report.totalCosts;

  expenses.getCell(`E${expenseTotalRow}`).numFmt = financialFormat;

  expenses.getCell(`E${expenseTotalRow}`).font = {
    bold: true,
    color: { argb: orange },
  };

  expenses.getRow(expenseTotalRow).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFF7ED" },
  };

  /*
   * 4. RENTABILIDADE POR VIATURA
   */

  const vehicles = workbook.addWorksheet("Rentabilidade por Viatura", {
    views: [
      {
        state: "frozen",
        ySplit: 5,
        showGridLines: false,
      },
    ],
    pageSetup: {
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      paperSize: 9,
    },
  });

  styleTitle(
    vehicles,
    "Rentabilidade por Viatura",
    `${report.monthLabel} ${report.year}`,
  );

  vehicles.columns = [
    {
      header: "Posição",
      key: "position",
      width: 12,
    },
    {
      header: "Viatura",
      key: "vehicle",
      width: 31,
    },
    {
      header: "Reservas",
      key: "bookings",
      width: 14,
    },
    {
      header: "Receita",
      key: "revenue",
      width: 18,
    },
    {
      header: "Custos",
      key: "costs",
      width: 18,
    },
    {
      header: "Lucro",
      key: "profit",
      width: 18,
    },
    {
      header: "Margem",
      key: "margin",
      width: 15,
    },
  ];

  const vehicleHeader = vehicles.getRow(5);
  vehicleHeader.values = [
    "Posição",
    "Viatura",
    "Reservas",
    "Receita",
    "Custos",
    "Lucro",
    "Margem",
  ];
  styleHeaderRow(vehicleHeader);

  report.vehicles.forEach((item, index) => {
    vehicles.addRow({
      position: index + 1,
      vehicle: item.vehicle,
      bookings: item.bookings,
      revenue: item.revenue,
      costs: item.costs,
      profit: item.profit,
      margin: item.revenue > 0 ? item.profit / item.revenue : 0,
    });
  });

  const vehicleStart = 6;
  const vehicleEnd = 5 + report.vehicles.length;

  if (report.vehicles.length > 0) {
    styleDataRows(vehicles, vehicleStart, vehicleEnd);

    vehicles.getColumn("revenue").numFmt = financialFormat;
    vehicles.getColumn("costs").numFmt = financialFormat;
    vehicles.getColumn("profit").numFmt = financialFormat;
    vehicles.getColumn("margin").numFmt = "0.0%";

    for (
      let rowNumber = vehicleStart;
      rowNumber <= vehicleEnd;
      rowNumber += 1
    ) {
      const profitCell = vehicles.getCell(`F${rowNumber}`);

      if (Number(profitCell.value || 0) < 0) {
        profitCell.font = {
          bold: true,
          color: { argb: red },
        };
      } else {
        profitCell.font = {
          bold: true,
          color: { argb: darkGreen },
        };
      }
    }
  }

  vehicles.addConditionalFormatting({
    ref: `F${vehicleStart}:F${Math.max(vehicleEnd, vehicleStart)}`,
    rules: [
      {
        type: "cellIs",
        priority: 1,
        operator: "lessThan",
        formulae: [0],
        style: {
          font: {
            color: { argb: red },
          },
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: "FFFEE2E2" },
          },
        },
      },
      {
        type: "cellIs",
        priority: 2,
        operator: "greaterThan",
        formulae: [0],
        style: {
          font: {
            color: { argb: darkGreen },
          },
          fill: {
            type: "pattern",
            pattern: "solid",
            bgColor: { argb: veryLightGreen },
          },
        },
      },
    ],
  });

  /*
   * 5. INDICADORES
   */

  const indicators = workbook.addWorksheet("Indicadores", {
    views: [
      {
        showGridLines: false,
      },
    ],
    pageSetup: {
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      paperSize: 9,
    },
  });

  styleTitle(
    indicators,
    "Indicadores Financeiros",
    `${report.monthLabel} ${report.year}`,
  );

  indicators.columns = [
    { key: "indicator", width: 33 },
    { key: "value", width: 27 },
    { key: "description", width: 44 },
    { key: "extra", width: 16 },
    { key: "extra2", width: 16 },
    { key: "extra3", width: 16 },
  ];

  indicators.getRow(5).values = ["Indicador", "Resultado", "Descrição"];
  styleHeaderRow(indicators.getRow(5));

  const indicatorRows = [
    [
      "Melhor viatura",
      report.bestVehicle?.vehicle || "Sem dados",
      report.bestVehicle
        ? `${report.currency}${report.bestVehicle.profit.toFixed(2)} de lucro`
        : "Sem receitas concluídas",
    ],
    [
      "Viatura com maior custo",
      report.highestCostVehicle?.vehicle || "Sem dados",
      report.highestCostVehicle
        ? `${report.currency}${report.highestCostVehicle.costs.toFixed(
            2,
          )} em custos`
        : "Sem custos registados",
    ],
    [
      "Receita média por reserva",
      report.averageRevenue,
      "Receita total dividida pelas reservas concluídas",
    ],
    ["Lucro líquido", report.netProfit, "Receita total menos todos os custos"],
    [
      "Margem líquida",
      report.profitMargin / 100,
      "Percentagem do lucro sobre a receita",
    ],
    [
      "Reservas concluídas",
      report.completedBookings,
      "Número de alugueres concluídos no período",
    ],
    [
      "Viaturas com atividade",
      report.vehicles.length,
      "Viaturas com receita ou custo no período",
    ],
    [
      "Custos de oficina",
      report.workshopCosts,
      "Manutenção e serviços de oficina",
    ],
    ["Outras despesas", report.otherExpenses, "Despesas adicionais registadas"],
  ];

  indicatorRows.forEach((values) => {
    indicators.addRow(values);
  });

  styleDataRows(indicators, 6, 5 + indicatorRows.length);

  indicators.getCell("B8").numFmt = financialFormat;
  indicators.getCell("B9").numFmt = financialFormat;
  indicators.getCell("B10").numFmt = "0.0%";
  indicators.getCell("B13").numFmt = financialFormat;
  indicators.getCell("B14").numFmt = financialFormat;

  for (const worksheet of workbook.worksheets) {
    worksheet.properties.defaultRowHeight = 18;

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        if (!cell.font?.name) {
          cell.font = {
            ...cell.font,
            name: "Arial",
          };
        }
      });
    });

    worksheet.headerFooter.oddFooter =
      "&L7Go STP — Drive your way&CRelatório Financeiro&RPage &P de &N";
  }

  return workbook;
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

    const closedReportSnapshot = await adminDb
      .collection("financialReports")
      .doc(reportNumber)
      .get();

    let report: MonthlyFinancialReportData | undefined;

    if (closedReportSnapshot.exists) {
      const archivedData = closedReportSnapshot.data();

      report = archivedData?.reportData as
        MonthlyFinancialReportData | undefined;
    }

    if (!report) {
      report = await buildCurrentReport(month, year, adminDb);
    }

    const workbook = createWorkbook(report);
    const buffer = await workbook.xlsx.writeBuffer();

    const filename = `Relatorio-Financeiro-7Go-${report.monthLabel}-${report.year}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Report-Source": closedReportSnapshot.exists ? "archived" : "live",
      },
    });
  } catch (error) {
    console.error("ERRO AO GERAR RELATÓRIO EXCEL:", error);

    const message =
      error instanceof Error ? error.message : "Erro desconhecido.";

    return Response.json({ error: message }, { status: 500 });
  }
}
