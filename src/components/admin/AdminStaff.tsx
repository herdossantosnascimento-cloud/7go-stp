"use client";

import { onAuthStateChanged, type User } from "firebase/auth";
import { FormEvent, useEffect, useState } from "react";

import { auth } from "@/lib/firebase/client";

type StaffMember = {
  id: string;
  uid?: string;
  name?: string;
  email?: string;
  active?: boolean;
};

type StaffEditDraft = {
  name: string;
  email: string;
  password: string;
};

export function AdminStaff() {
  const [user, setUser] = useState<User | null>(null);

  const [staff, setStaff] = useState<StaffMember[]>([]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);

  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState("");

  const [editDraft, setEditDraft] = useState<StaffEditDraft>({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    void loadStaff();
  }, [user]);

  async function authHeaders() {
    if (!user) {
      throw new Error("Sessão de administrador inválida.");
    }

    const token = await user.getIdToken();

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  }

  async function loadStaff() {
    setLoading(true);
    setError("");

    try {
      const headers = await authHeaders();

      const response = await fetch("/api/admin/staff", {
        headers,
      });

      const result = (await response.json()) as {
        staff?: StaffMember[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível carregar.");
      }

      setStaff(result.staff || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Erro desconhecido.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function createStaff(event: FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();

      const response = await fetch("/api/admin/staff", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível criar.");
      }

      setName("");
      setEmail("");
      setPassword("");

      setMessage("✓ Funcionário criado com sucesso.");

      await loadStaff();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Erro desconhecido.",
      );
    } finally {
      setSaving(false);
    }
  }

  function startEdit(member: StaffMember) {
    setEditingId(member.uid || member.id);

    setEditDraft({
      name: member.name || "",
      email: member.email || "",
      password: "",
    });

    setError("");
    setMessage("");
  }

  function cancelEdit() {
    setEditingId("");

    setEditDraft({
      name: "",
      email: "",
      password: "",
    });
  }

  async function saveEdit(member: StaffMember) {
    const uid = member.uid || member.id;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();

      const response = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          uid,
          name: editDraft.name,
          email: editDraft.email,
          password: editDraft.password || undefined,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível guardar.");
      }

      cancelEdit();

      setMessage("✓ Funcionário atualizado.");

      await loadStaff();
    } catch (editError) {
      setError(
        editError instanceof Error ? editError.message : "Erro desconhecido.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteStaff(member: StaffMember) {
    const uid = member.uid || member.id;

    const confirmed = window.confirm(
      `Eliminar definitivamente ${member.name || "este funcionário"}?

Esta ação remove a conta do funcionário do Firebase Authentication e da base de dados.

Não é possível desfazer.`,
    );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();

      const response = await fetch("/api/admin/staff", {
        method: "DELETE",
        headers,
        body: JSON.stringify({
          uid,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível eliminar.");
      }

      if (editingId === uid) {
        cancelEdit();
      }

      setMessage("✓ Funcionário eliminado definitivamente.");

      await loadStaff();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Erro desconhecido.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleStaff(member: StaffMember) {
    setError("");
    setMessage("");

    try {
      const headers = await authHeaders();

      const response = await fetch("/api/admin/staff", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          uid: member.uid || member.id,
          active: member.active === false,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Não foi possível atualizar.");
      }

      setMessage(
        member.active === false
          ? "✓ Funcionário ativado."
          : "✓ Funcionário desativado.",
      );

      await loadStaff();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Erro desconhecido.",
      );
    }
  }

  return (
    <section className="admin-staff-page">
      <div className="admin-staff-heading">
        <div>
          <p className="eyebrow">Equipa 7Go</p>

          <h2>Funcionários</h2>

          <p>Cria, edita e gere os acessos da equipa operacional.</p>
        </div>
      </div>

      <form className="admin-staff-form" onSubmit={createStaff}>
        <label>
          Nome
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label>
          Password temporária
          <input
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        <button type="submit" disabled={saving}>
          {saving ? "A criar..." : "Adicionar funcionário"}
        </button>
      </form>

      {error && <div className="customer-auth-error">{error}</div>}

      {message && <div className="customer-auth-message">{message}</div>}

      {loading ? (
        <p>A carregar funcionários...</p>
      ) : (
        <div className="admin-staff-list">
          {staff.length === 0 ? (
            <p>Ainda não existem funcionários.</p>
          ) : (
            staff.map((member) => {
              const uid = member.uid || member.id;

              const editing = editingId === uid;

              return (
                <article key={member.id} className="admin-staff-card">
                  {editing ? (
                    <div className="admin-staff-edit-form">
                      <label>
                        Nome
                        <input
                          value={editDraft.name}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label>
                        Email
                        <input
                          type="email"
                          value={editDraft.email}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <label>
                        Nova password
                        <input
                          type="password"
                          minLength={6}
                          placeholder="Deixa vazio para manter"
                          value={editDraft.password}
                          onChange={(event) =>
                            setEditDraft((current) => ({
                              ...current,
                              password: event.target.value,
                            }))
                          }
                        />
                      </label>

                      <div className="admin-staff-edit-actions">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void saveEdit(member)}
                        >
                          Guardar
                        </button>

                        <button type="button" onClick={cancelEdit}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <strong>{member.name || "Funcionário"}</strong>

                        <span>{member.email || "-"}</span>

                        <small>
                          Staff ·{" "}
                          {member.active === false ? "Desativado" : "Ativo"}
                        </small>
                      </div>

                      <div className="admin-staff-actions">
                        <button type="button" onClick={() => startEdit(member)}>
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => void toggleStaff(member)}
                          disabled={saving}
                        >
                          {member.active === false ? "Ativar" : "Desativar"}
                        </button>

                        <button
                          type="button"
                          className="admin-staff-delete-button"
                          onClick={() => void deleteStaff(member)}
                          disabled={saving}
                        >
                          Eliminar
                        </button>
                      </div>
                    </>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
