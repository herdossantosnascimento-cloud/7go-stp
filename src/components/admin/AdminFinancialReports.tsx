"use client";

import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import {
  Archive,
  CheckCircle2,
  LockKeyhole,
  CalendarRange,
  CarFront,
  CircleDollarSign,
  Download,
  FileBarChart,
  Printer,
  ReceiptText,
  RefreshCw,
  TrendingUp,
  WalletCards,
  FileSpreadsheet,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { auth, db } from "@/lib/firebase/client";

type Booking = {
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

type MaintenanceRecord = {
  id: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  date?: string;
  category?: string;
  cost?: number;
  currency?: string;
};

type FleetExpense = {
  id: string;
  carId?: string;
  carBrand?: string;
  carModel?: string;
  date?: string;
  category?: string;
  amount?: number;
  currency?: string;
};

type FleetCar = {
  id: string;
  brand?: string;
  model?: string;
  currency?: string;
};

type ClosedFinancialReport = {
  id: string;
  reportNumber?: string;
  month?: number;
  year?: number;
  monthLabel?: string;
  status?: "closed";
  currency?: string;
  totalRevenue?: number;
  totalCosts?: number;
  netProfit?: number;
  profitMargin?: number;
  completedBookings?: number;
  createdAt?: {
    toDate?: () => Date;
  };
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

function money(value: number, currency: string) {
  return `${currency}${Number(value || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value?: string) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

export function AdminFinancialReports() {
  const now = new Date();

  const [user, setUser] = useState<User | null>(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [expenses, setExpenses] = useState<FleetExpense[]>([]);
  const [fleet, setFleet] = useState<FleetCar[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatingExcel, setGeneratingExcel] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closedReports, setClosedReports] = useState<ClosedFinancialReport[]>(
    [],
  );
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    setLoading(true);
    setLoadError("");

    const loaded = {
      bookings: false,
      maintenance: false,
      expenses: false,
      fleet: false,
    };

    const finish = () => {
      if (Object.values(loaded).every(Boolean)) {
        setLoading(false);
      }
    };

    const fail = (label: string, error: unknown) => {
      console.error(`Erro ao carregar ${label} dos relatórios:`, error);
      setLoadError("Não foi possível carregar todos os dados financeiros.");
    };

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
          finish();
        },
        (error) => {
          fail("reservas", error);
          loaded.bookings = true;
          finish();
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
          finish();
        },
        (error) => {
          fail("oficina", error);
          loaded.maintenance = true;
          finish();
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
          finish();
        },
        (error) => {
          fail("despesas", error);
          loaded.expenses = true;
          finish();
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
          finish();
        },
        (error) => {
          fail("frota", error);
          loaded.fleet = true;
          finish();
        },
      ),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      setClosedReports([]);
      return;
    }

    return onSnapshot(
      collection(db, "financialReports"),
      (snapshot) => {
        setClosedReports(
          snapshot.docs
            .map(
              (item) =>
                ({
                  id: item.id,
                  ...item.data(),
                }) as ClosedFinancialReport,
            )
            .sort((first, second) => {
              const firstValue =
                Number(first.year || 0) * 100 + Number(first.month || 0);

              const secondValue =
                Number(second.year || 0) * 100 + Number(second.month || 0);

              return secondValue - firstValue;
            }),
        );
      },
      (error) => {
        console.error("Erro ao carregar meses fechados:", error);

        setLoadError("Não foi possível carregar o histórico de fechos.");
      },
    );
  }, [user]);

  const report = useMemo(() => {
    const monthKey = `${year}-${String(month).padStart(2, "0")}`;

    const periodBookings = bookings.filter(
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
      periodBookings.find((item) => item.currency)?.currency ||
      periodExpenses.find((item) => item.currency)?.currency ||
      periodMaintenance.find((item) => item.currency)?.currency ||
      fleet.find((item) => item.currency)?.currency ||
      "€";

    const totalRevenue = periodBookings.reduce(
      (total, booking) => total + Number(booking.estimatedTotal || 0),
      0,
    );

    const workshopCosts = periodMaintenance.reduce(
      (total, record) => total + Number(record.cost || 0),
      0,
    );

    const otherExpenses = periodExpenses.reduce(
      (total, expense) => total + Number(expense.amount || 0),
      0,
    );

    const totalCosts = workshopCosts + otherExpenses;
    const netProfit = totalRevenue - totalCosts;

    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const vehicleIds = new Set<string>();

    periodBookings.forEach((item) => {
      if (item.carId) vehicleIds.add(item.carId);
    });

    periodMaintenance.forEach((item) => {
      if (item.carId) vehicleIds.add(item.carId);
    });

    periodExpenses.forEach((item) => {
      if (item.carId) vehicleIds.add(item.carId);
    });

    const vehicles = Array.from(vehicleIds)
      .map((carId) => {
        const catalog = fleet.find((car) => car.id === carId);
        const carBookings = periodBookings.filter(
          (item) => item.carId === carId,
        );
        const carMaintenance = periodMaintenance.filter(
          (item) => item.carId === carId,
        );
        const carExpenses = periodExpenses.filter(
          (item) => item.carId === carId,
        );

        const revenue = carBookings.reduce(
          (total, item) => total + Number(item.estimatedTotal || 0),
          0,
        );

        const costs =
          carMaintenance.reduce(
            (total, item) => total + Number(item.cost || 0),
            0,
          ) +
          carExpenses.reduce(
            (total, item) => total + Number(item.amount || 0),
            0,
          );

        return {
          id: carId,
          vehicle:
            `${catalog?.brand || carBookings[0]?.carBrand || "Viatura"} ${
              catalog?.model || carBookings[0]?.carModel || ""
            }`.trim(),
          bookings: carBookings.length,
          revenue,
          costs,
          profit: revenue - costs,
        };
      })
      .sort((first, second) => second.profit - first.profit);

    const latestExpenses = [
      ...periodMaintenance.map((item) => ({
        id: `maintenance-${item.id}`,
        date: item.date || "",
        category: item.category || "Oficina",
        vehicle:
          `${item.carBrand || ""} ${item.carModel || ""}`.trim() ||
          fleet.find((car) => car.id === item.carId)?.brand ||
          "Viatura",
        origin: "Oficina",
        amount: Number(item.cost || 0),
      })),
      ...periodExpenses.map((item) => ({
        id: `expense-${item.id}`,
        date: item.date || "",
        category: item.category || "Outro",
        vehicle:
          `${item.carBrand || ""} ${item.carModel || ""}`.trim() ||
          fleet.find((car) => car.id === item.carId)?.brand ||
          "Viatura",
        origin: "Despesa",
        amount: Number(item.amount || 0),
      })),
    ]
      .sort((first, second) => second.date.localeCompare(first.date))
      .slice(0, 10);

    return {
      currency,
      totalRevenue,
      workshopCosts,
      otherExpenses,
      totalCosts,
      netProfit,
      margin,
      completedBookings: periodBookings.length,
      averageRevenue:
        periodBookings.length > 0 ? totalRevenue / periodBookings.length : 0,
      vehicles,
      revenues: periodBookings
        .sort((first, second) =>
          (second.returnDate || "").localeCompare(first.returnDate || ""),
        )
        .slice(0, 10),
      latestExpenses,
    };
  }, [bookings, expenses, fleet, maintenance, month, year]);

  const selectedReportNumber = `FIN-${year}-${String(month).padStart(2, "0")}`;

  const selectedClosedReport =
    closedReports.find(
      (item) =>
        item.reportNumber === selectedReportNumber ||
        item.id === selectedReportNumber,
    ) ?? null;

  async function closeMonth() {
    if (!user || closing) {
      return;
    }

    if (selectedClosedReport) {
      alert(`${monthNames[month - 1]} ${year} já está fechado.`);
      return;
    }

    const confirmed = window.confirm(
      `Confirmas o fecho financeiro de ${
        monthNames[month - 1]
      } ${year}?\n\nDepois de fechado, o PDF desse mês utilizará sempre os valores arquivados.`,
    );

    if (!confirmed) {
      return;
    }

    setClosing(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/admin/close-financial-month", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          month,
          year,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        message?: string;
        reportNumber?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível fechar o mês.");
      }

      alert(result.message || "Mês fechado com sucesso.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível fechar o mês: ${message}`);
    } finally {
      setClosing(false);
    }
  }

  async function downloadExcel() {
    if (!user || generatingExcel) {
      return;
    }

    setGeneratingExcel(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        "/api/admin/monthly-financial-report-excel",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            month,
            year,
          }),
        },
      );

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };

        throw new Error(result.error || "Não foi possível gerar o Excel.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `Relatorio-Financeiro-7Go-${
        monthNames[month - 1]
      }-${year}.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível gerar o Excel: ${message}`);
    } finally {
      setGeneratingExcel(false);
    }
  }

  async function downloadPdf() {
    if (!user || generating) return;

    setGenerating(true);

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/admin/monthly-financial-report", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ month, year }),
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
        };

        throw new Error(result.error || "Não foi possível gerar o relatório.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `Relatorio-Financeiro-7Go-${
        monthNames[month - 1]
      }-${year}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível gerar o PDF: ${message}`);
    } finally {
      setGenerating(false);
    }
  }

  if (!user) {
    return (
      <section className="admin-financial-reports">
        <div className="admin-financial-reports-state">
          Inicia sessão como administrador para consultar os relatórios.
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="admin-financial-reports">
        <div className="admin-financial-reports-state">
          <RefreshCw aria-hidden="true" className="admin-financial-spin" />A
          preparar o relatório...
        </div>
      </section>
    );
  }

  return (
    <section className="admin-financial-reports">
      <header className="admin-financial-reports-header">
        <div>
          <span>Arquivo financeiro</span>
          <h2>Relatórios mensais</h2>
          <p>Gera, imprime e arquiva o desempenho financeiro de cada mês.</p>
        </div>

        <FileBarChart aria-hidden="true" />
      </header>

      {loadError && (
        <div className="admin-financial-reports-error">{loadError}</div>
      )}

      <div className="admin-financial-reports-controls">
        <label>
          <span>Mês</span>
          <select
            value={month}
            onChange={(event) => setMonth(Number(event.target.value))}
          >
            {monthNames.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Ano</span>
          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {Array.from({ length: 10 }, (_, index) => {
              const optionYear = now.getFullYear() - 5 + index;

              return (
                <option key={optionYear} value={optionYear}>
                  {optionYear}
                </option>
              );
            })}
          </select>
        </label>

        <button
          type="button"
          className={selectedClosedReport ? "is-closed" : "is-close-month"}
          onClick={() => void closeMonth()}
          disabled={closing || Boolean(selectedClosedReport)}
        >
          {closing ? (
            <RefreshCw aria-hidden="true" className="admin-financial-spin" />
          ) : selectedClosedReport ? (
            <CheckCircle2 aria-hidden="true" />
          ) : (
            <LockKeyhole aria-hidden="true" />
          )}

          {closing
            ? "A fechar mês..."
            : selectedClosedReport
              ? "Mês fechado"
              : "Fechar mês"}
        </button>

        <button
          type="button"
          onClick={() => void downloadPdf()}
          disabled={generating}
        >
          {generating ? (
            <RefreshCw aria-hidden="true" className="admin-financial-spin" />
          ) : (
            <Download aria-hidden="true" />
          )}

          {generating ? "A gerar PDF..." : "Descarregar PDF"}
        </button>

        <button
          type="button"
          className="is-excel"
          onClick={() => void downloadExcel()}
          disabled={generatingExcel}
        >
          {generatingExcel ? (
            <RefreshCw aria-hidden="true" className="admin-financial-spin" />
          ) : (
            <FileSpreadsheet aria-hidden="true" />
          )}

          {generatingExcel ? "A gerar Excel..." : "Descarregar Excel"}
        </button>

        <button
          type="button"
          className="is-secondary"
          onClick={() => window.print()}
        >
          <Printer aria-hidden="true" />
          Imprimir
        </button>
      </div>

      <div
        className={`admin-financial-closing-status ${
          selectedClosedReport ? "is-closed" : "is-open"
        }`}
      >
        {selectedClosedReport ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <Archive aria-hidden="true" />
        )}

        <span>
          <small>{selectedReportNumber}</small>

          <strong>
            {selectedClosedReport
              ? "Período fechado e arquivado"
              : "Período ainda aberto"}
          </strong>

          <p>
            {selectedClosedReport
              ? "O PDF utiliza os valores guardados no momento do fecho."
              : "Os valores ainda são calculados a partir dos dados atuais."}
          </p>
        </span>
      </div>

      <article className="admin-financial-report-preview">
        <div className="admin-financial-report-title">
          <div>
            <span>7Go STP</span>
            <h3>Relatório Financeiro Mensal</h3>
            <p>
              {monthNames[month - 1]} {year}
            </p>
          </div>

          <CalendarRange aria-hidden="true" />
        </div>

        <div className="admin-financial-report-kpis">
          <article>
            <WalletCards aria-hidden="true" />
            <span>
              <small>Receita</small>
              <strong>{money(report.totalRevenue, report.currency)}</strong>
            </span>
          </article>

          <article>
            <ReceiptText aria-hidden="true" />
            <span>
              <small>Custos</small>
              <strong>{money(report.totalCosts, report.currency)}</strong>
            </span>
          </article>

          <article>
            <CircleDollarSign aria-hidden="true" />
            <span>
              <small>Lucro líquido</small>
              <strong>{money(report.netProfit, report.currency)}</strong>
            </span>
          </article>

          <article>
            <TrendingUp aria-hidden="true" />
            <span>
              <small>Margem</small>
              <strong>{report.margin.toFixed(1)}%</strong>
            </span>
          </article>
        </div>

        <div className="admin-financial-report-details">
          <article>
            <span>Custos de oficina</span>
            <strong>{money(report.workshopCosts, report.currency)}</strong>
          </article>

          <article>
            <span>Outras despesas</span>
            <strong>{money(report.otherExpenses, report.currency)}</strong>
          </article>

          <article>
            <span>Reservas concluídas</span>
            <strong>{report.completedBookings}</strong>
          </article>

          <article>
            <span>Média por reserva</span>
            <strong>{money(report.averageRevenue, report.currency)}</strong>
          </article>
        </div>

        <div className="admin-financial-report-grid">
          <section>
            <h4>Rentabilidade por viatura</h4>

            {report.vehicles.length === 0 ? (
              <div className="admin-financial-reports-empty">
                Sem movimentos neste período.
              </div>
            ) : (
              <div className="admin-financial-report-table">
                <div className="is-header">
                  <span>Viatura</span>
                  <span>Receita</span>
                  <span>Custos</span>
                  <span>Lucro</span>
                </div>

                {report.vehicles.map((vehicle) => (
                  <div key={vehicle.id}>
                    <span>
                      <CarFront aria-hidden="true" />
                      {vehicle.vehicle}
                    </span>
                    <span>{money(vehicle.revenue, report.currency)}</span>
                    <span>{money(vehicle.costs, report.currency)}</span>
                    <span>{money(vehicle.profit, report.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h4>Últimas despesas do mês</h4>

            {report.latestExpenses.length === 0 ? (
              <div className="admin-financial-reports-empty">
                Sem despesas neste período.
              </div>
            ) : (
              <div className="admin-financial-report-expenses">
                {report.latestExpenses.map((expense) => (
                  <article key={expense.id}>
                    <span>
                      <strong>{expense.category}</strong>
                      <small>
                        {formatDate(expense.date)} · {expense.vehicle} ·{" "}
                        {expense.origin}
                      </small>
                    </span>

                    <strong>{money(expense.amount, report.currency)}</strong>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </article>

      <section className="admin-financial-closing-history">
        <div className="admin-financial-closing-history-heading">
          <div>
            <span>Arquivo contabilístico</span>
            <h3>Meses fechados</h3>
            <p>Histórico oficial dos períodos financeiros arquivados.</p>
          </div>

          <Archive aria-hidden="true" />
        </div>

        {closedReports.length === 0 ? (
          <div className="admin-financial-reports-empty">
            Ainda não existem meses fechados.
          </div>
        ) : (
          <div className="admin-financial-closing-history-list">
            {closedReports.map((item) => (
              <article key={item.id}>
                <div>
                  <CheckCircle2 aria-hidden="true" />
                </div>

                <span>
                  <small>{item.reportNumber || item.id}</small>

                  <strong>
                    {item.monthLabel ||
                      monthNames[Math.max(Number(item.month || 1) - 1, 0)]}{" "}
                    {item.year}
                  </strong>

                  <p>{item.completedBookings || 0} reserva(s) concluída(s)</p>
                </span>

                <span>
                  <small>Receita</small>
                  <strong>
                    {money(
                      Number(item.totalRevenue || 0),
                      item.currency || "€",
                    )}
                  </strong>
                </span>

                <span>
                  <small>Custos</small>
                  <strong>
                    {money(Number(item.totalCosts || 0), item.currency || "€")}
                  </strong>
                </span>

                <span>
                  <small>Lucro</small>
                  <strong>
                    {money(Number(item.netProfit || 0), item.currency || "€")}
                  </strong>
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setMonth(Number(item.month || 1));
                    setYear(Number(item.year || new Date().getFullYear()));
                  }}
                >
                  Abrir
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
