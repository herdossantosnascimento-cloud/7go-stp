"use client";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CarFront,
  Check,
  CircleDollarSign,
  Gauge,
  History,
  RefreshCw,
  Save,
  Search,
  Wrench,
} from "lucide-react";

import { auth, db } from "@/lib/firebase/client";

type FleetCar = {
  id: string;
  brand?: string;
  model?: string;
  registrationPlate?: string;
  currency?: string;
  serviceIntervalKm?: number;
};

type MaintenanceRecord = {
  id: string;
  carId: string;
  carBrand?: string;
  carModel?: string;
  registrationPlate?: string;
  date: string;
  mileage: number;
  category: string;
  services: string[];
  garage?: string;
  mechanic?: string;
  cost: number;
  currency: string;
  notes?: string;
  serviceCompleted?: boolean;
  createdAt?: unknown;
};

type WorkshopDraft = {
  carId: string;
  date: string;
  mileage: string;
  category: string;
  garage: string;
  mechanic: string;
  cost: string;
  currency: string;
  notes: string;
  serviceCompleted: boolean;
  services: string[];
};

const serviceOptions = [
  "Mudança de óleo",
  "Filtro de óleo",
  "Filtro de ar",
  "Filtro de combustível",
  "Travões",
  "Pastilhas",
  "Pneus",
  "Bateria",
  "Suspensão",
  "Ar condicionado",
  "Sistema elétrico",
  "Lavagem",
  "Revisão geral",
  "Outro",
];

const today = new Date().toISOString().slice(0, 10);

const initialDraft: WorkshopDraft = {
  carId: "",
  date: today,
  mileage: "",
  category: "Revisão",
  garage: "",
  mechanic: "",
  cost: "",
  currency: "€",
  notes: "",
  serviceCompleted: true,
  services: [],
};

function formatMoney(currency: string, amount: number) {
  return `${currency}${Number(amount || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value || "Sem data";
  }

  return `${day}/${month}/${year}`;
}

export function AdminWorkshop() {
  const [user, setUser] = useState<User | null>(null);
  const [fleet, setFleet] = useState<FleetCar[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [draft, setDraft] = useState<WorkshopDraft>(initialDraft);
  const [search, setSearch] = useState("");
  const [selectedCarFilter, setSelectedCarFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setFleet([]);
        setRecords([]);
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

    let fleetLoaded = false;
    let recordsLoaded = false;

    const finishLoading = () => {
      if (fleetLoaded && recordsLoaded) {
        setLoading(false);
      }
    };

    const unsubscribeFleet = onSnapshot(
      collection(db, "carCatalog"),
      (snapshot) => {
        const loadedFleet = snapshot.docs
          .map(
            (item) =>
              ({
                id: item.id,
                ...item.data(),
              }) as FleetCar,
          )
          .sort((first, second) =>
            `${first.brand ?? ""} ${first.model ?? ""}`.localeCompare(
              `${second.brand ?? ""} ${second.model ?? ""}`,
            ),
          );

        setFleet(loadedFleet);
        fleetLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error("Erro ao carregar frota da oficina:", error);
        setLoadError("Não foi possível carregar a frota.");
        fleetLoaded = true;
        finishLoading();
      },
    );

    const unsubscribeRecords = onSnapshot(
      query(collection(db, "maintenanceRecords"), orderBy("date", "desc")),
      (snapshot) => {
        setRecords(
          snapshot.docs.map(
            (item) =>
              ({
                id: item.id,
                ...item.data(),
              }) as MaintenanceRecord,
          ),
        );

        recordsLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error("Erro ao carregar manutenções:", error);
        setLoadError("Não foi possível carregar o histórico de manutenção.");
        recordsLoaded = true;
        finishLoading();
      },
    );

    return () => {
      unsubscribeFleet();
      unsubscribeRecords();
    };
  }, [user]);

  const selectedCar = fleet.find((car) => car.id === draft.carId);

  const filteredRecords = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return records.filter((record) => {
      if (selectedCarFilter !== "all" && record.carId !== selectedCarFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const content = [
        record.carBrand,
        record.carModel,
        record.registrationPlate,
        record.category,
        record.garage,
        record.mechanic,
        record.notes,
        ...(record.services ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return content.includes(normalizedSearch);
    });
  }, [records, search, selectedCarFilter]);

  const statistics = useMemo(() => {
    const totalCost = filteredRecords.reduce(
      (total, record) => total + Number(record.cost || 0),
      0,
    );

    const averageCost =
      filteredRecords.length > 0 ? totalCost / filteredRecords.length : 0;

    return {
      totalRecords: filteredRecords.length,
      totalCost,
      averageCost,
      vehiclesServiced: new Set(filteredRecords.map((record) => record.carId))
        .size,
    };
  }, [filteredRecords]);

  function toggleService(service: string) {
    setDraft((current) => ({
      ...current,
      services: current.services.includes(service)
        ? current.services.filter((item) => item !== service)
        : [...current.services, service],
    }));
  }

  async function saveMaintenanceRecord() {
    if (!user || saving) {
      return;
    }

    if (!selectedCar) {
      alert("Seleciona a viatura.");
      return;
    }

    const mileage = Number(draft.mileage);
    const cost = Number(draft.cost || 0);

    if (!Number.isFinite(mileage) || mileage < 0) {
      alert("Introduz uma quilometragem válida.");
      return;
    }

    if (!Number.isFinite(cost) || cost < 0) {
      alert("Introduz um custo válido.");
      return;
    }

    if (!draft.date) {
      alert("Seleciona a data da manutenção.");
      return;
    }

    if (draft.services.length === 0) {
      alert("Seleciona pelo menos um serviço realizado.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "maintenanceRecords"), {
        carId: selectedCar.id,
        carBrand: selectedCar.brand || "",
        carModel: selectedCar.model || "",
        registrationPlate: selectedCar.registrationPlate || "",
        date: draft.date,
        mileage,
        category: draft.category.trim() || "Manutenção",
        services: draft.services,
        garage: draft.garage.trim(),
        mechanic: draft.mechanic.trim(),
        cost,
        currency: draft.currency || selectedCar.currency || "€",
        notes: draft.notes.trim(),
        serviceCompleted: draft.serviceCompleted,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (draft.serviceCompleted) {
        await updateDoc(doc(db, "carCatalog", selectedCar.id), {
          lastServiceMileage: mileage,
          lastServiceDate: draft.date,
          serviceNotes: draft.notes.trim(),
          updatedAt: serverTimestamp(),
        });
      }

      setDraft({
        ...initialDraft,
        date: new Date().toISOString().slice(0, 10),
        currency: draft.currency || selectedCar.currency || "€",
      });

      alert(
        draft.serviceCompleted
          ? "Manutenção registada e revisão da viatura atualizada."
          : "Manutenção registada no histórico.",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível guardar a manutenção: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  if (!user) {
    return (
      <section className="workshop-ui">
        <div className="workshop-state">
          <Wrench aria-hidden="true" />
          <strong>Sessão administrativa necessária</strong>
          <p>Inicia sessão na aba Reservas para gerir a oficina.</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="workshop-ui">
        <div className="workshop-state">
          <RefreshCw aria-hidden="true" className="workshop-spin" />
          <strong>A carregar oficina...</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="workshop-ui">
      <header className="workshop-header">
        <div>
          <span>Gestão técnica da frota</span>
          <h2>Oficina e manutenção</h2>
          <p>
            Regista revisões, reparações, custos e intervenções de cada viatura.
          </p>
        </div>

        <div className="workshop-header-icon">
          <Wrench aria-hidden="true" />
        </div>
      </header>

      {loadError && <div className="workshop-error">{loadError}</div>}

      <div className="workshop-stats">
        <article>
          <History aria-hidden="true" />
          <span>Intervenções</span>
          <strong>{statistics.totalRecords}</strong>
        </article>

        <article>
          <CircleDollarSign aria-hidden="true" />
          <span>Total gasto</span>
          <strong>
            {formatMoney(draft.currency || "€", statistics.totalCost)}
          </strong>
        </article>

        <article>
          <Gauge aria-hidden="true" />
          <span>Custo médio</span>
          <strong>
            {formatMoney(draft.currency || "€", statistics.averageCost)}
          </strong>
        </article>

        <article>
          <CarFront aria-hidden="true" />
          <span>Viaturas assistidas</span>
          <strong>{statistics.vehiclesServiced}</strong>
        </article>
      </div>

      <div className="workshop-main-grid">
        <article className="workshop-panel workshop-form-panel">
          <div className="workshop-panel-heading">
            <div>
              <span>Novo registo</span>
              <h3>Adicionar manutenção</h3>
            </div>

            <Wrench aria-hidden="true" />
          </div>

          <div className="workshop-form-grid">
            <label>
              <span>Viatura</span>
              <select
                value={draft.carId}
                disabled={saving}
                onChange={(event) => {
                  const car = fleet.find(
                    (item) => item.id === event.target.value,
                  );

                  setDraft((current) => ({
                    ...current,
                    carId: event.target.value,
                    currency: car?.currency || current.currency,
                  }));
                }}
              >
                <option value="">Selecionar viatura</option>

                {fleet.map((car) => (
                  <option key={car.id} value={car.id}>
                    {car.brand} {car.model}
                    {car.registrationPlate ? ` · ${car.registrationPlate}` : ""}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Data</span>
              <input
                type="date"
                value={draft.date}
                disabled={saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Quilometragem</span>
              <input
                type="number"
                min="0"
                inputMode="numeric"
                value={draft.mileage}
                disabled={saving}
                placeholder="Ex.: 60250"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    mileage: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Tipo de intervenção</span>
              <input
                type="text"
                value={draft.category}
                disabled={saving}
                placeholder="Ex.: Revisão completa"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    category: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Oficina</span>
              <input
                type="text"
                value={draft.garage}
                disabled={saving}
                placeholder="Nome da oficina"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    garage: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Mecânico</span>
              <input
                type="text"
                value={draft.mechanic}
                disabled={saving}
                placeholder="Nome do mecânico"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    mechanic: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Custo</span>
              <div className="workshop-money-field">
                <input
                  type="text"
                  className="workshop-currency-input"
                  value={draft.currency}
                  disabled={saving}
                  aria-label="Moeda"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      currency: event.target.value,
                    }))
                  }
                />

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.cost}
                  disabled={saving}
                  placeholder="0.00"
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      cost: event.target.value,
                    }))
                  }
                />
              </div>
            </label>

            <label className="workshop-completed-check">
              <input
                type="checkbox"
                checked={draft.serviceCompleted}
                disabled={saving}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    serviceCompleted: event.target.checked,
                  }))
                }
              />

              <span>
                <strong>Revisão concluída</strong>
                <small>Atualizar KM e data da última revisão da viatura.</small>
              </span>
            </label>
          </div>

          <div className="workshop-services">
            <span>Serviços realizados</span>

            <div>
              {serviceOptions.map((service) => (
                <button
                  key={service}
                  type="button"
                  disabled={saving}
                  className={
                    draft.services.includes(service) ? "is-selected" : ""
                  }
                  onClick={() => toggleService(service)}
                >
                  {draft.services.includes(service) && (
                    <Check aria-hidden="true" />
                  )}
                  {service}
                </button>
              ))}
            </div>
          </div>

          <label className="workshop-notes">
            <span>Observações</span>
            <textarea
              value={draft.notes}
              disabled={saving}
              placeholder="Peças substituídas, recomendações, problemas encontrados..."
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
            />
          </label>

          <button
            type="button"
            className="workshop-save-button"
            disabled={saving}
            onClick={() => void saveMaintenanceRecord()}
          >
            {saving ? (
              <RefreshCw aria-hidden="true" className="workshop-spin" />
            ) : (
              <Save aria-hidden="true" />
            )}

            {saving ? "A guardar..." : "Guardar manutenção"}
          </button>
        </article>

        <article className="workshop-panel workshop-history-panel">
          <div className="workshop-panel-heading">
            <div>
              <span>Arquivo técnico</span>
              <h3>Histórico de manutenção</h3>
            </div>

            <History aria-hidden="true" />
          </div>

          <div className="workshop-filters">
            <label>
              <Search aria-hidden="true" />
              <input
                type="search"
                value={search}
                placeholder="Pesquisar oficina, serviço..."
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <select
              value={selectedCarFilter}
              onChange={(event) => setSelectedCarFilter(event.target.value)}
            >
              <option value="all">Todas as viaturas</option>

              {fleet.map((car) => (
                <option key={car.id} value={car.id}>
                  {car.brand} {car.model}
                </option>
              ))}
            </select>
          </div>

          {filteredRecords.length === 0 ? (
            <div className="workshop-empty">
              <Wrench aria-hidden="true" />
              <strong>Nenhuma manutenção encontrada</strong>
              <p>Os novos registos de oficina aparecerão aqui.</p>
            </div>
          ) : (
            <div className="workshop-history-list">
              {filteredRecords.map((record) => (
                <article key={record.id} className="workshop-history-record">
                  <div className="workshop-record-top">
                    <div>
                      <span>
                        {record.carBrand || "Viatura"} {record.carModel || ""}
                      </span>
                      <strong>{record.category}</strong>
                    </div>

                    <strong>{formatMoney(record.currency, record.cost)}</strong>
                  </div>

                  <div className="workshop-record-details">
                    <span>
                      <CalendarDays aria-hidden="true" />
                      {formatDate(record.date)}
                    </span>

                    <span>
                      <Gauge aria-hidden="true" />
                      {Number(record.mileage || 0).toLocaleString("pt-PT")} km
                    </span>

                    {record.garage && (
                      <span>
                        <Wrench aria-hidden="true" />
                        {record.garage}
                      </span>
                    )}
                  </div>

                  <div className="workshop-record-services">
                    {(record.services ?? []).map((service) => (
                      <span key={service}>{service}</span>
                    ))}
                  </div>

                  {record.notes && (
                    <p className="workshop-record-notes">{record.notes}</p>
                  )}

                  {record.serviceCompleted && (
                    <div className="workshop-record-completed">
                      <Check aria-hidden="true" />
                      Revisão da viatura atualizada
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
