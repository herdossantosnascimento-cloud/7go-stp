import path from "node:path";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

export type MonthlyReportRevenue = {
  id: string;
  date: string;
  reference: string;
  customer: string;
  vehicle: string;
  amount: number;
};

export type MonthlyReportExpense = {
  id: string;
  date: string;
  category: string;
  vehicle: string;
  origin: "Oficina" | "Despesa";
  amount: number;
};

export type MonthlyReportVehicle = {
  id: string;
  vehicle: string;
  revenue: number;
  costs: number;
  profit: number;
  bookings: number;
};

export type MonthlyFinancialReportData = {
  month: number;
  year: number;
  monthLabel: string;
  generatedAt: string;
  currency: string;
  totalRevenue: number;
  workshopCosts: number;
  otherExpenses: number;
  totalCosts: number;
  netProfit: number;
  profitMargin: number;
  completedBookings: number;
  averageRevenue: number;
  revenues: MonthlyReportRevenue[];
  expenses: MonthlyReportExpense[];
  vehicles: MonthlyReportVehicle[];
  bestVehicle?: MonthlyReportVehicle;
  highestCostVehicle?: MonthlyReportVehicle;
};

const officialLogoPath = path.join(
  process.cwd(),
  "public",
  "images",
  "7go-stp-official-logo.png",
);

const styles = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingHorizontal: 32,
    paddingBottom: 36,
    fontFamily: "Helvetica",
    fontSize: 8,
    color: "#172019",
  },
  header: {
    paddingBottom: 14,
    marginBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#22c55e",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 48,
    height: 48,
    marginRight: 10,
    objectFit: "contain",
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 8,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  slogan: {
    marginTop: 5,
    fontSize: 9,
    fontFamily: "Helvetica-BoldOblique",
    color: "#15803d",
  },
  period: {
    alignItems: "flex-end",
  },
  periodLabel: {
    fontSize: 7,
    color: "#64748b",
    textTransform: "uppercase",
  },
  periodValue: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
  },
  generated: {
    marginTop: 4,
    color: "#64748b",
    fontSize: 7,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    marginBottom: 7,
    color: "#15803d",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -3,
  },
  summaryCard: {
    width: "25%",
    paddingHorizontal: 3,
    marginBottom: 6,
  },
  summaryCardInner: {
    minHeight: 56,
    padding: 9,
    borderWidth: 1,
    borderColor: "#dbe4dc",
    borderRadius: 5,
    backgroundColor: "#f8faf9",
  },
  summaryLabel: {
    color: "#64748b",
    fontSize: 6,
    textTransform: "uppercase",
  },
  summaryValue: {
    marginTop: 7,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },
  summaryPositive: {
    color: "#15803d",
  },
  summaryNegative: {
    color: "#b91c1c",
  },
  insights: {
    flexDirection: "row",
    marginHorizontal: -3,
  },
  insight: {
    width: "50%",
    paddingHorizontal: 3,
  },
  insightInner: {
    minHeight: 48,
    padding: 9,
    borderWidth: 1,
    borderColor: "#dbe4dc",
    borderRadius: 5,
  },
  insightLabel: {
    color: "#64748b",
    fontSize: 6,
    textTransform: "uppercase",
  },
  insightTitle: {
    marginTop: 5,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  insightText: {
    marginTop: 3,
    color: "#475569",
    fontSize: 7,
  },
  table: {
    borderWidth: 1,
    borderColor: "#dbe4dc",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#ecfdf3",
    borderBottomWidth: 1,
    borderBottomColor: "#cbd8cd",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e7ece8",
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 5,
    fontSize: 6.5,
  },
  headerCell: {
    fontFamily: "Helvetica-Bold",
    color: "#166534",
    textTransform: "uppercase",
  },
  dateCell: {
    width: "13%",
  },
  referenceCell: {
    width: "17%",
  },
  customerCell: {
    width: "25%",
  },
  vehicleCell: {
    width: "27%",
  },
  amountCell: {
    width: "18%",
    textAlign: "right",
  },
  categoryCell: {
    width: "24%",
  },
  originCell: {
    width: "15%",
  },
  vehicleSummaryName: {
    width: "32%",
  },
  vehicleSummaryNumber: {
    width: "17%",
    textAlign: "right",
  },
  vehicleSummaryBookings: {
    width: "15%",
    textAlign: "right",
  },
  empty: {
    padding: 14,
    borderWidth: 1,
    borderColor: "#dbe4dc",
    borderRadius: 5,
    color: "#64748b",
    textAlign: "center",
  },
  observations: {
    minHeight: 76,
    padding: 10,
    borderWidth: 1,
    borderColor: "#dbe4dc",
    borderRadius: 5,
  },
  observationsText: {
    color: "#94a3b8",
    fontSize: 7,
  },
  signatureRow: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  signature: {
    width: "42%",
    paddingTop: 7,
    borderTopWidth: 1,
    borderTopColor: "#64748b",
    textAlign: "center",
    color: "#475569",
    fontSize: 7,
  },
  footer: {
    position: "absolute",
    right: 32,
    bottom: 18,
    left: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    color: "#94a3b8",
    fontSize: 6,
  },
});

function money(value: number, currency: string) {
  return `${currency}${Number(value || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function ReportDocument({ report }: { report: MonthlyFinancialReportData }) {
  return (
    <Document
      title={`Relatório Financeiro 7Go — ${report.monthLabel} ${report.year}`}
      author="7Go STP"
      subject="Relatório Financeiro Mensal"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image src={officialLogoPath} style={styles.logo} />

            <View>
              <Text style={styles.title}>7Go STP</Text>
              <Text style={styles.subtitle}>Relatório Financeiro Mensal</Text>
              <Text style={styles.slogan}>Drive your way</Text>
            </View>
          </View>

          <View style={styles.period}>
            <Text style={styles.periodLabel}>Período</Text>
            <Text style={styles.periodValue}>
              {report.monthLabel} {report.year}
            </Text>
            <Text style={styles.generated}>
              Emitido em {report.generatedAt}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo executivo</Text>

          <View style={styles.summaryGrid}>
            {[
              ["Receita total", money(report.totalRevenue, report.currency)],
              [
                "Custos de oficina",
                money(report.workshopCosts, report.currency),
              ],
              ["Outras despesas", money(report.otherExpenses, report.currency)],
              ["Custos totais", money(report.totalCosts, report.currency)],
              ["Lucro líquido", money(report.netProfit, report.currency)],
              ["Margem", `${report.profitMargin.toFixed(1)}%`],
              ["Reservas concluídas", String(report.completedBookings)],
              [
                "Média por reserva",
                money(report.averageRevenue, report.currency),
              ],
            ].map(([label, value], index) => (
              <View key={label} style={styles.summaryCard}>
                <View style={styles.summaryCardInner}>
                  <Text style={styles.summaryLabel}>{label}</Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      index === 4
                        ? report.netProfit >= 0
                          ? styles.summaryPositive
                          : styles.summaryNegative
                        : {},
                    ]}
                  >
                    {value}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Indicadores principais</Text>

          <View style={styles.insights}>
            <View style={styles.insight}>
              <View style={styles.insightInner}>
                <Text style={styles.insightLabel}>Melhor viatura</Text>
                <Text style={styles.insightTitle}>
                  {report.bestVehicle?.vehicle || "Sem dados"}
                </Text>
                <Text style={styles.insightText}>
                  {report.bestVehicle
                    ? `${money(
                        report.bestVehicle.profit,
                        report.currency,
                      )} de lucro`
                    : "Não existem receitas concluídas neste período."}
                </Text>
              </View>
            </View>

            <View style={styles.insight}>
              <View style={styles.insightInner}>
                <Text style={styles.insightLabel}>Viatura com maior custo</Text>
                <Text style={styles.insightTitle}>
                  {report.highestCostVehicle?.vehicle || "Sem dados"}
                </Text>
                <Text style={styles.insightText}>
                  {report.highestCostVehicle
                    ? `${money(
                        report.highestCostVehicle.costs,
                        report.currency,
                      )} em custos`
                    : "Não existem custos neste período."}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Rentabilidade por viatura</Text>

          {report.vehicles.length === 0 ? (
            <Text style={styles.empty}>
              Não existem movimentos financeiros neste período.
            </Text>
          ) : (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text
                  style={[
                    styles.cell,
                    styles.headerCell,
                    styles.vehicleSummaryName,
                  ]}
                >
                  Viatura
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.headerCell,
                    styles.vehicleSummaryBookings,
                  ]}
                >
                  Reservas
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.headerCell,
                    styles.vehicleSummaryNumber,
                  ]}
                >
                  Receita
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.headerCell,
                    styles.vehicleSummaryNumber,
                  ]}
                >
                  Custos
                </Text>
                <Text
                  style={[
                    styles.cell,
                    styles.headerCell,
                    styles.vehicleSummaryNumber,
                  ]}
                >
                  Lucro
                </Text>
              </View>

              {report.vehicles.map((vehicle, index) => (
                <View
                  key={vehicle.id}
                  style={[
                    styles.tableRow,
                    index === report.vehicles.length - 1
                      ? styles.tableRowLast
                      : {},
                  ]}
                >
                  <Text style={[styles.cell, styles.vehicleSummaryName]}>
                    {vehicle.vehicle}
                  </Text>
                  <Text style={[styles.cell, styles.vehicleSummaryBookings]}>
                    {vehicle.bookings}
                  </Text>
                  <Text style={[styles.cell, styles.vehicleSummaryNumber]}>
                    {money(vehicle.revenue, report.currency)}
                  </Text>
                  <Text style={[styles.cell, styles.vehicleSummaryNumber]}>
                    {money(vehicle.costs, report.currency)}
                  </Text>
                  <Text style={[styles.cell, styles.vehicleSummaryNumber]}>
                    {money(vehicle.profit, report.currency)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.footer} fixed>
          <Text>7Go STP — Relatório Financeiro Mensal</Text>
          <Text>
            {report.monthLabel} {report.year}
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Receitas do período</Text>
            <Text style={styles.subtitle}>Reservas concluídas</Text>
          </View>

          <View style={styles.period}>
            <Text style={styles.periodValue}>
              {money(report.totalRevenue, report.currency)}
            </Text>
          </View>
        </View>

        {report.revenues.length === 0 ? (
          <Text style={styles.empty}>
            Não existem receitas concluídas neste período.
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headerCell, styles.dateCell]}>
                Data
              </Text>
              <Text
                style={[styles.cell, styles.headerCell, styles.referenceCell]}
              >
                Referência
              </Text>
              <Text
                style={[styles.cell, styles.headerCell, styles.customerCell]}
              >
                Cliente
              </Text>
              <Text
                style={[styles.cell, styles.headerCell, styles.vehicleCell]}
              >
                Viatura
              </Text>
              <Text style={[styles.cell, styles.headerCell, styles.amountCell]}>
                Valor
              </Text>
            </View>

            {report.revenues.map((item, index) => (
              <View
                key={item.id}
                wrap={false}
                style={[
                  styles.tableRow,
                  index === report.revenues.length - 1
                    ? styles.tableRowLast
                    : {},
                ]}
              >
                <Text style={[styles.cell, styles.dateCell]}>{item.date}</Text>
                <Text style={[styles.cell, styles.referenceCell]}>
                  {item.reference}
                </Text>
                <Text style={[styles.cell, styles.customerCell]}>
                  {item.customer}
                </Text>
                <Text style={[styles.cell, styles.vehicleCell]}>
                  {item.vehicle}
                </Text>
                <Text style={[styles.cell, styles.amountCell]}>
                  {money(item.amount, report.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text>7Go STP — Receitas</Text>
          <Text>
            {report.monthLabel} {report.year}
          </Text>
        </View>
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Despesas do período</Text>
            <Text style={styles.subtitle}>Oficina e despesas adicionais</Text>
          </View>

          <View style={styles.period}>
            <Text style={styles.periodValue}>
              {money(report.totalCosts, report.currency)}
            </Text>
          </View>
        </View>

        {report.expenses.length === 0 ? (
          <Text style={styles.empty}>Não existem despesas neste período.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headerCell, styles.dateCell]}>
                Data
              </Text>
              <Text
                style={[styles.cell, styles.headerCell, styles.categoryCell]}
              >
                Categoria
              </Text>
              <Text
                style={[styles.cell, styles.headerCell, styles.vehicleCell]}
              >
                Viatura
              </Text>
              <Text style={[styles.cell, styles.headerCell, styles.originCell]}>
                Origem
              </Text>
              <Text style={[styles.cell, styles.headerCell, styles.amountCell]}>
                Valor
              </Text>
            </View>

            {report.expenses.map((item, index) => (
              <View
                key={item.id}
                wrap={false}
                style={[
                  styles.tableRow,
                  index === report.expenses.length - 1
                    ? styles.tableRowLast
                    : {},
                ]}
              >
                <Text style={[styles.cell, styles.dateCell]}>{item.date}</Text>
                <Text style={[styles.cell, styles.categoryCell]}>
                  {item.category}
                </Text>
                <Text style={[styles.cell, styles.vehicleCell]}>
                  {item.vehicle}
                </Text>
                <Text style={[styles.cell, styles.originCell]}>
                  {item.origin}
                </Text>
                <Text style={[styles.cell, styles.amountCell]}>
                  {money(item.amount, report.currency)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Observações</Text>
          <View style={styles.observations}>
            <Text style={styles.observationsText}>
              ____________________________________________________________
            </Text>
            <Text style={styles.observationsText}>
              ____________________________________________________________
            </Text>
            <Text style={styles.observationsText}>
              ____________________________________________________________
            </Text>
          </View>
        </View>

        <View style={styles.signatureRow}>
          <Text style={styles.signature}>Responsável financeiro</Text>
          <Text style={styles.signature}>Gerência 7Go STP</Text>
        </View>

        <View style={styles.footer} fixed>
          <Text>7Go STP — Despesas</Text>
          <Text>
            {report.monthLabel} {report.year}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function createMonthlyFinancialReportPdf(
  report: MonthlyFinancialReportData,
) {
  return renderToBuffer(<ReportDocument report={report} />);
}
