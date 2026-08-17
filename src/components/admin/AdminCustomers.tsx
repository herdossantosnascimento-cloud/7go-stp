"use client";

import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import {
  BadgePoundSterling,
  CalendarDays,
  CarFront,
  ChevronDown,
  Clock3,
  FileText,
  Trash2,
  Upload,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  Star,
  UserRound,
  Users,
} from "lucide-react";

import { auth, db, storage } from "@/lib/firebase/client";

type CustomerStatus = "active" | "blocked";

type Customer = {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  normalisedEmail?: string;
  normalisedPhone?: string;
  status?: CustomerStatus;
  internalNotes?: string;
  nationality?: string;
  address?: string;
  drivingLicenceExpiry?: string;
  drivingLicenceUrl?: string;
  identityDocumentUrl?: string;
  addressProofUrl?: string;
  createdAt?: unknown;
  firstBookingAt?: unknown;
  lastBookingAt?: unknown;
};

type BookingStatus =
  "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

type CustomerBooking = {
  id: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  reference?: string;
  status?: BookingStatus;
  carBrand?: string;
  carModel?: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  totalDays?: number;
  estimatedTotal?: number;
  currency?: string;
  paymentStatus?: "pending" | "partial" | "paid";
  depositStatus?: "pending" | "received" | "returned" | "retained";
};

type CustomerDraft = {
  nationality: string;
  address: string;
  internalNotes: string;
  status: CustomerStatus;
  drivingLicenceExpiry: string;
};

const bookingStatusLabel: Record<BookingStatus, string> = {
  pending: "Pendente",
  confirmed: "Confirmada",
  in_progress: "Em curso",
  completed: "Concluída",
  cancelled: "Cancelada",
};

function formatDate(value?: string) {
  if (!value) {
    return "Sem data";
  }

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatMoney(currency: string | undefined, amount: number) {
  return `${currency || "€"}${Number(amount || 0).toLocaleString("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getCustomerLevel(totalBookings: number, totalSpent: number) {
  if (totalBookings >= 15 || totalSpent >= 5000) {
    return {
      label: "VIP",
      className: "customers-level-vip",
      stars: 5,
    };
  }

  if (totalBookings >= 8 || totalSpent >= 2500) {
    return {
      label: "Gold",
      className: "customers-level-gold",
      stars: 4,
    };
  }

  if (totalBookings >= 4 || totalSpent >= 1000) {
    return {
      label: "Silver",
      className: "customers-level-silver",
      stars: 3,
    };
  }

  return {
    label: "Bronze",
    className: "customers-level-bronze",
    stars: 2,
  };
}

function createDraft(customer: Customer): CustomerDraft {
  return {
    nationality: customer.nationality ?? "",
    address: customer.address ?? "",
    internalNotes: customer.internalNotes ?? "",
    status: customer.status ?? "active",
    drivingLicenceExpiry: customer.drivingLicenceExpiry ?? "",
  };
}

export function AdminCustomers() {
  const [user, setUser] = useState<User | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [drafts, setDrafts] = useState<Record<string, CustomerDraft>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CustomerStatus>(
    "all",
  );
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [uploadingDocument, setUploadingDocument] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setCustomers([]);
        setBookings([]);
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

    let customersLoaded = false;
    let bookingsLoaded = false;

    const finishLoading = () => {
      if (customersLoaded && bookingsLoaded) {
        setLoading(false);
      }
    };

    const unsubscribeCustomers = onSnapshot(
      collection(db, "customers"),
      (snapshot) => {
        const loadedCustomers = snapshot.docs
          .map(
            (item) =>
              ({
                id: item.id,
                ...item.data(),
              }) as Customer,
          )
          .sort((first, second) =>
            (first.name ?? "").localeCompare(second.name ?? ""),
          );

        setCustomers(loadedCustomers);

        setDrafts((current) => {
          const next = { ...current };

          for (const customer of loadedCustomers) {
            if (!next[customer.id]) {
              next[customer.id] = createDraft(customer);
            }
          }

          return next;
        });

        customersLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error("Erro ao carregar clientes:", error);
        setLoadError("Não foi possível carregar os clientes.");
        customersLoaded = true;
        finishLoading();
      },
    );

    const unsubscribeBookings = onSnapshot(
      collection(db, "bookings"),
      (snapshot) => {
        setBookings(
          snapshot.docs.map(
            (item) =>
              ({
                id: item.id,
                ...item.data(),
              }) as CustomerBooking,
          ),
        );

        bookingsLoaded = true;
        finishLoading();
      },
      (error) => {
        console.error("Erro ao carregar reservas dos clientes:", error);
        setLoadError("Não foi possível carregar o histórico dos clientes.");
        bookingsLoaded = true;
        finishLoading();
      },
    );

    return () => {
      unsubscribeCustomers();
      unsubscribeBookings();
    };
  }, [user]);

  const customerSummaries = useMemo(() => {
    return customers.map((customer) => {
      const customerBookings = bookings
        .filter((booking) => booking.customerId === customer.id)
        .sort((first, second) =>
          (second.pickupDate ?? "").localeCompare(first.pickupDate ?? ""),
        );

      const validBookings = customerBookings.filter(
        (booking) => booking.status !== "cancelled",
      );

      const completedBookings = validBookings.filter(
        (booking) => booking.status === "completed",
      );

      const totalSpent = completedBookings.reduce(
        (total, booking) => total + Number(booking.estimatedTotal || 0),
        0,
      );

      const totalDays = completedBookings.reduce(
        (total, booking) => total + Number(booking.totalDays || 0),
        0,
      );

      const lastBooking = customerBookings[0];

      return {
        customer,
        customerBookings,
        totalBookings: validBookings.length,
        completedBookings: completedBookings.length,
        totalSpent,
        totalDays,
        lastBooking,
        level: getCustomerLevel(validBookings.length, totalSpent),
      };
    });
  }, [bookings, customers]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return customerSummaries.filter(({ customer }) => {
      const status = customer.status ?? "active";

      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableContent = [
        customer.name,
        customer.email,
        customer.phone,
        customer.nationality,
        customer.address,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchableContent.includes(normalizedSearch);
    });
  }, [customerSummaries, search, statusFilter]);

  const statistics = useMemo(() => {
    const totalRevenue = customerSummaries.reduce(
      (total, summary) => total + summary.totalSpent,
      0,
    );

    const returningCustomers = customerSummaries.filter(
      (summary) => summary.totalBookings > 1,
    ).length;

    const blockedCustomers = customerSummaries.filter(
      ({ customer }) => customer.status === "blocked",
    ).length;

    return {
      totalCustomers: customerSummaries.length,
      returningCustomers,
      blockedCustomers,
      totalRevenue,
    };
  }, [customerSummaries]);

  function updateDraft(customer: Customer, values: Partial<CustomerDraft>) {
    setDrafts((current) => ({
      ...current,
      [customer.id]: {
        ...(current[customer.id] ?? createDraft(customer)),
        ...values,
      },
    }));
  }

  async function uploadCustomerDocument(
    customer: Customer,
    field: "drivingLicenceUrl" | "identityDocumentUrl" | "addressProofUrl",
    file: File | undefined,
  ) {
    if (!file) {
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Seleciona um ficheiro PDF, JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert("O ficheiro não pode ultrapassar 10 MB.");
      return;
    }

    const uploadKey = `${customer.id}-${field}`;
    setUploadingDocument(uploadKey);

    try {
      const existingUrl = customer[field];

      if (existingUrl) {
        try {
          await deleteObject(ref(storage, existingUrl));
        } catch {
          // Continua mesmo que o ficheiro anterior já não exista.
        }
      }

      const extension = file.name.split(".").pop()?.toLowerCase() || "file";

      const fileRef = ref(
        storage,
        `customer-documents/${customer.id}/${field}-${Date.now()}.${extension}`,
      );

      await uploadBytes(fileRef, file, {
        contentType: file.type,
        customMetadata: {
          customerId: customer.id,
          documentType: field,
        },
      });

      const downloadUrl = await getDownloadURL(fileRef);

      await updateDoc(doc(db, "customers", customer.id), {
        [field]: downloadUrl,
        updatedAt: serverTimestamp(),
      });

      alert("Documento guardado com sucesso.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível guardar o documento: ${message}`);
    } finally {
      setUploadingDocument("");
    }
  }

  async function deleteCustomerDocument(
    customer: Customer,
    field: "drivingLicenceUrl" | "identityDocumentUrl" | "addressProofUrl",
  ) {
    const documentUrl = customer[field];

    if (!documentUrl) {
      return;
    }

    const confirmed = window.confirm(
      "Pretendes eliminar este documento do cliente?",
    );

    if (!confirmed) {
      return;
    }

    const uploadKey = `${customer.id}-${field}`;
    setUploadingDocument(uploadKey);

    try {
      await deleteObject(ref(storage, documentUrl));

      await updateDoc(doc(db, "customers", customer.id), {
        [field]: "",
        updatedAt: serverTimestamp(),
      });

      alert("Documento eliminado.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível eliminar o documento: ${message}`);
    } finally {
      setUploadingDocument("");
    }
  }

  async function saveCustomer(customer: Customer) {
    const draft = drafts[customer.id] ?? createDraft(customer);

    setSavingId(customer.id);

    try {
      await updateDoc(doc(db, "customers", customer.id), {
        nationality: draft.nationality.trim(),
        address: draft.address.trim(),
        internalNotes: draft.internalNotes.trim(),
        status: draft.status,
        drivingLicenceExpiry: draft.drivingLicenceExpiry,
        updatedAt: serverTimestamp(),
      });

      alert(`${customer.name || "Cliente"} atualizado com sucesso.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro desconhecido.";

      alert(`Não foi possível atualizar o cliente: ${message}`);
    } finally {
      setSavingId("");
    }
  }

  if (!user) {
    return (
      <section className="customers-ui">
        <div className="customers-state">
          <Users aria-hidden="true" />
          <strong>Sessão administrativa necessária</strong>
          <p>Inicia sessão na aba Reservas para consultar os clientes.</p>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="customers-ui">
        <div className="customers-state">
          <RefreshCw aria-hidden="true" className="customers-spin" />
          <strong>A carregar clientes...</strong>
        </div>
      </section>
    );
  }

  return (
    <section className="customers-ui">
      <header className="customers-header">
        <div>
          <span>CRM 7Go</span>
          <h2>Gestão de clientes</h2>
          <p>
            Perfis, histórico de alugueres, faturação e notas internas num só
            lugar.
          </p>
        </div>

        <div className="customers-header-icon">
          <Users aria-hidden="true" />
        </div>
      </header>

      {loadError && (
        <div className="customers-error">
          <ShieldAlert aria-hidden="true" />
          {loadError}
        </div>
      )}

      <div className="customers-stats">
        <article>
          <Users aria-hidden="true" />
          <span>Total de clientes</span>
          <strong>{statistics.totalCustomers}</strong>
        </article>

        <article>
          <RefreshCw aria-hidden="true" />
          <span>Clientes recorrentes</span>
          <strong>{statistics.returningCustomers}</strong>
        </article>

        <article>
          <BadgePoundSterling aria-hidden="true" />
          <span>Receita concluída</span>
          <strong>{formatMoney("€", statistics.totalRevenue)}</strong>
        </article>

        <article>
          <ShieldAlert aria-hidden="true" />
          <span>Clientes bloqueados</span>
          <strong>{statistics.blockedCustomers}</strong>
        </article>
      </div>

      <div className="customers-toolbar">
        <label>
          <Search aria-hidden="true" />

          <input
            type="search"
            value={search}
            placeholder="Pesquisar nome, email ou contacto..."
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as "all" | CustomerStatus)
          }
        >
          <option value="all">Todos os clientes</option>
          <option value="active">Ativos</option>
          <option value="blocked">Bloqueados</option>
        </select>

        <strong>{filteredCustomers.length} resultado(s)</strong>
      </div>

      {filteredCustomers.length === 0 ? (
        <div className="customers-state">
          <UserRound aria-hidden="true" />
          <strong>Nenhum cliente encontrado</strong>
          <p>
            Os novos clientes aparecem automaticamente quando realizam uma
            reserva.
          </p>
        </div>
      ) : (
        <div className="customers-grid">
          {filteredCustomers.map(
            ({
              customer,
              customerBookings,
              totalBookings,
              completedBookings,
              totalSpent,
              totalDays,
              lastBooking,
              level,
            }) => {
              const draft = drafts[customer.id] ?? createDraft(customer);

              return (
                <article
                  key={customer.id}
                  className={`customers-card ${
                    customer.status === "blocked"
                      ? "customers-card-blocked"
                      : ""
                  }`}
                >
                  <div className="customers-card-header">
                    <div className="customers-avatar">
                      <UserRound aria-hidden="true" />
                    </div>

                    <div className="customers-identity">
                      <span>Cliente 7Go</span>
                      <h3>{customer.name || "Sem nome"}</h3>

                      <div className={`customers-level ${level.className}`}>
                        <Star aria-hidden="true" />
                        {level.label}
                      </div>
                    </div>

                    <div
                      className={`customers-status customers-status-${
                        customer.status ?? "active"
                      }`}
                    >
                      {customer.status === "blocked" ? "Bloqueado" : "Ativo"}
                    </div>
                  </div>

                  <div className="customers-contact">
                    <span>
                      <Mail aria-hidden="true" />
                      {customer.email || "Email não registado"}
                    </span>

                    <span>
                      <Phone aria-hidden="true" />
                      {customer.phone || "Contacto não registado"}
                    </span>

                    {customer.nationality && (
                      <span>
                        <MapPin aria-hidden="true" />
                        {customer.nationality}
                      </span>
                    )}
                  </div>

                  <div className="customers-metrics">
                    <div>
                      <small>Reservas</small>
                      <strong>{totalBookings}</strong>
                    </div>

                    <div>
                      <small>Concluídas</small>
                      <strong>{completedBookings}</strong>
                    </div>

                    <div>
                      <small>Total gasto</small>
                      <strong>{formatMoney("€", totalSpent)}</strong>
                    </div>

                    <div>
                      <small>Dias alugados</small>
                      <strong>{totalDays}</strong>
                    </div>
                  </div>

                  <div className="customers-last-booking">
                    <div>
                      <CarFront aria-hidden="true" />

                      <span>
                        <small>Última reserva</small>
                        <strong>
                          {lastBooking
                            ? `${lastBooking.carBrand || "Viatura"} ${
                                lastBooking.carModel || ""
                              }`
                            : "Sem reservas ligadas"}
                        </strong>
                      </span>
                    </div>

                    <small>
                      {lastBooking?.pickupDate
                        ? formatDate(lastBooking.pickupDate)
                        : "—"}
                    </small>
                  </div>

                  <details className="customers-profile">
                    <summary>
                      <span>Ver perfil e histórico</span>

                      <ChevronDown aria-hidden="true" />
                    </summary>

                    <div className="customers-profile-content">
                      <section className="customers-profile-section">
                        <div className="customers-section-title">
                          <UserRound aria-hidden="true" />

                          <div>
                            <strong>Dados e notas internas</strong>
                            <small>Informação visível apenas no Admin.</small>
                          </div>
                        </div>

                        <div className="customers-form-grid">
                          <label>
                            <span>Nacionalidade</span>

                            <input
                              type="text"
                              value={draft.nationality}
                              disabled={savingId === customer.id}
                              placeholder="Ex.: Portuguesa"
                              onChange={(event) =>
                                updateDraft(customer, {
                                  nationality: event.target.value,
                                })
                              }
                            />
                          </label>

                          <label>
                            <span>Validade da carta de condução</span>

                            <input
                              type="date"
                              value={draft.drivingLicenceExpiry}
                              disabled={savingId === customer.id}
                              onChange={(event) =>
                                updateDraft(customer, {
                                  drivingLicenceExpiry: event.target.value,
                                })
                              }
                            />
                          </label>

                          <label>
                            <span>Estado do cliente</span>

                            <select
                              value={draft.status}
                              disabled={savingId === customer.id}
                              onChange={(event) =>
                                updateDraft(customer, {
                                  status: event.target.value as CustomerStatus,
                                })
                              }
                            >
                              <option value="active">Ativo</option>
                              <option value="blocked">Bloqueado</option>
                            </select>
                          </label>

                          <label className="customers-full-field">
                            <span>Morada</span>

                            <input
                              type="text"
                              value={draft.address}
                              disabled={savingId === customer.id}
                              placeholder="Morada completa"
                              onChange={(event) =>
                                updateDraft(customer, {
                                  address: event.target.value,
                                })
                              }
                            />
                          </label>

                          <label className="customers-full-field">
                            <span>Notas internas</span>

                            <textarea
                              value={draft.internalNotes}
                              disabled={savingId === customer.id}
                              placeholder="Preferências, comportamento, observações..."
                              onChange={(event) =>
                                updateDraft(customer, {
                                  internalNotes: event.target.value,
                                })
                              }
                            />
                          </label>
                        </div>

                        <button
                          type="button"
                          className="customers-save-button"
                          disabled={savingId === customer.id}
                          onClick={() => void saveCustomer(customer)}
                        >
                          {savingId === customer.id ? (
                            <RefreshCw
                              aria-hidden="true"
                              className="customers-spin"
                            />
                          ) : (
                            <Save aria-hidden="true" />
                          )}

                          {savingId === customer.id
                            ? "A guardar..."
                            : "Guardar cliente"}
                        </button>
                      </section>

                      <section className="customers-profile-section customers-documents-section">
                        <div className="customers-section-title">
                          <FileText aria-hidden="true" />

                          <div>
                            <strong>Documentos do cliente</strong>
                            <small>
                              PDF ou imagem, máximo de 10 MB por documento.
                            </small>
                          </div>
                        </div>

                        <div className="customers-documents-grid">
                          {[
                            {
                              field: "drivingLicenceUrl" as const,
                              label: "Carta de condução",
                              url: customer.drivingLicenceUrl,
                            },
                            {
                              field: "identityDocumentUrl" as const,
                              label: "Documento de identificação",
                              url: customer.identityDocumentUrl,
                            },
                            {
                              field: "addressProofUrl" as const,
                              label: "Comprovativo de morada",
                              url: customer.addressProofUrl,
                            },
                          ].map((documentItem) => {
                            const uploadKey = `${customer.id}-${documentItem.field}`;

                            return (
                              <article
                                key={documentItem.field}
                                className="customers-document-card"
                              >
                                <div>
                                  <FileText aria-hidden="true" />

                                  <span>
                                    <strong>{documentItem.label}</strong>

                                    <small>
                                      {documentItem.url
                                        ? "Documento guardado"
                                        : "Documento em falta"}
                                    </small>
                                  </span>
                                </div>

                                <div className="customers-document-actions">
                                  {documentItem.url && (
                                    <a
                                      href={documentItem.url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Abrir
                                    </a>
                                  )}

                                  <label>
                                    <Upload aria-hidden="true" />

                                    {uploadingDocument === uploadKey
                                      ? "A enviar..."
                                      : documentItem.url
                                        ? "Substituir"
                                        : "Adicionar"}

                                    <input
                                      type="file"
                                      accept=".pdf,image/jpeg,image/png,image/webp"
                                      disabled={Boolean(uploadingDocument)}
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];

                                        void uploadCustomerDocument(
                                          customer,
                                          documentItem.field,
                                          file,
                                        );

                                        event.currentTarget.value = "";
                                      }}
                                    />
                                  </label>

                                  {documentItem.url && (
                                    <button
                                      type="button"
                                      disabled={Boolean(uploadingDocument)}
                                      onClick={() =>
                                        void deleteCustomerDocument(
                                          customer,
                                          documentItem.field,
                                        )
                                      }
                                    >
                                      <Trash2 aria-hidden="true" />
                                      Eliminar
                                    </button>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </section>

                      <section className="customers-profile-section">
                        <div className="customers-section-title">
                          <Clock3 aria-hidden="true" />

                          <div>
                            <strong>Histórico de reservas</strong>
                            <small>{customerBookings.length} registo(s)</small>
                          </div>
                        </div>

                        {customerBookings.length === 0 ? (
                          <div className="customers-empty-history">
                            Nenhuma reserva ligada a este cliente.
                          </div>
                        ) : (
                          <div className="customers-history-list">
                            {customerBookings.map((booking) => (
                              <article
                                key={booking.id}
                                className="customers-history-booking"
                              >
                                <div>
                                  <span>{booking.reference || booking.id}</span>

                                  <strong>
                                    {booking.carBrand || "Viatura"}{" "}
                                    {booking.carModel || ""}
                                  </strong>
                                </div>

                                <div className="customers-history-details">
                                  <span>
                                    <CalendarDays aria-hidden="true" />
                                    {formatDate(booking.pickupDate)} →{" "}
                                    {formatDate(booking.returnDate)}
                                  </span>

                                  <span>
                                    <BadgePoundSterling aria-hidden="true" />
                                    {formatMoney(
                                      booking.currency,
                                      Number(booking.estimatedTotal || 0),
                                    )}
                                  </span>
                                </div>

                                <div className="customers-history-footer">
                                  <span
                                    className={`customers-booking-status customers-booking-status-${
                                      booking.status || "pending"
                                    }`}
                                  >
                                    {
                                      bookingStatusLabel[
                                        booking.status || "pending"
                                      ]
                                    }
                                  </span>

                                  <a
                                    href={`/admin/reservas/${booking.id}/ficha`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Abrir ficha
                                  </a>
                                </div>
                              </article>
                            ))}
                          </div>
                        )}
                      </section>
                    </div>
                  </details>
                </article>
              );
            },
          )}
        </div>
      )}
    </section>
  );
}
