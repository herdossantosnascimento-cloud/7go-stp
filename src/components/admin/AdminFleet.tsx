"use client";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
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
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
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
};

const statusLabel: Record<FleetStatus, string> = {
  available: "Disponível",
  limited: "Disponibilidade limitada",
  booked: "Indisponível",
};

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

export function AdminFleet() {
  const [fleet, setFleet] = useState<FleetCar[]>([]);
  const [drafts, setDrafts] = useState<Record<string, FleetDraft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

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
            data.premiumPricePerDay ??
            fallback?.premiumPricePerDay ??
            0,
          normalExcess:
            data.normalExcess ??
            fallback?.normalExcess ??
            0,
          refundableDeposit:
            data.refundableDeposit ??
            fallback?.refundableDeposit ??
            0,
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

  function updateDraft(
    carId: string,
    values: Partial<FleetDraft>,
  ) {
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

    const pricePerDay = Number(
      normaliseMoneyInput(draft.pricePerDay),
    );
    const premiumPricePerDay = Number(
      normaliseMoneyInput(draft.premiumPricePerDay),
    );
    const normalExcess = Number(
      normaliseMoneyInput(draft.normalExcess),
    );
    const refundableDeposit = Number(
      normaliseMoneyInput(draft.refundableDeposit),
    );

    if (
      draft.transmission !== "Manual" &&
      draft.transmission !== "Automático"
    ) {
      alert("Seleciona uma transmissão válida.");
      return;
    }

    if (
      draft.fuel !== "Diesel" &&
      draft.fuel !== "Gasolina"
    ) {
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
        insurancePolicyNumber:
          draft.insurancePolicyNumber.trim(),
        insuranceExpiry: draft.insuranceExpiry,
        updatedAt: serverTimestamp(),
      });

      await loadFleet();

      alert(
        `${car.brand} ${car.model} atualizado com sucesso.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Erro ao atualizar carro: ${message}`);
    } finally {
      setSavingId("");
    }
  }

  useEffect(() => {
    loadFleet();
  }, []);

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
            {savingId === "sync"
              ? "A sincronizar..."
              : "Sincronizar frota"}
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
              Cria carros novos e preenche apenas campos em falta.
              Alterações feitas no Admin são preservadas.
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card className="fleet-ui-state-card">
          <CardContent>
            <RefreshCw
              aria-hidden="true"
              className="fleet-ui-spin"
            />
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

                  <Separator className="fleet-ui-separator" />

                  <Accordion
                    type="single"
                    collapsible
                    className="fleet-ui-accordion"
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
                              onFocus={(event) =>
                                event.currentTarget.select()
                              }
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
                              onFocus={(event) =>
                                event.currentTarget.select()
                              }
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
                              onFocus={(event) =>
                                event.currentTarget.select()
                              }
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
                              onFocus={(event) =>
                                event.currentTarget.select()
                              }
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
                            <Label htmlFor={`${car.id}-plate`}>
                              Matrícula
                            </Label>

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
                            <Label htmlFor={`${car.id}-color`}>
                              Cor
                            </Label>

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
                                  insurancePolicyNumber:
                                    event.target.value,
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
                                <SelectItem value="Manual">
                                  Manual
                                </SelectItem>

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
                                <SelectItem value="Diesel">
                                  Diesel
                                </SelectItem>

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
                              Franquia £0 para danos cobertos. O extra
                              Premium é acrescentado diariamente ao preço
                              normal.
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
