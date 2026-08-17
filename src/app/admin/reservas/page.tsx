"use client";

import {
  CalendarDays,
  CalendarRange,
  CarFront,
  FileBarChart,
  LayoutDashboard,
  UserCog,
  Users,
  Wrench,
} from "lucide-react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminBookings } from "@/components/admin/AdminBookings";
import { AdminFleet } from "@/components/admin/AdminFleet";
import { AdminFleetCalendar } from "@/components/admin/AdminFleetCalendar";
import { AdminFinancialReports } from "@/components/admin/AdminFinancialReports";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminWorkshop } from "@/components/admin/AdminWorkshop";
import { AdminCustomers } from "@/components/admin/AdminCustomers";
import { AdminStaff } from "@/components/admin/AdminStaff";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TotpSetup } from "@/components/auth/TotpSetup";
import { auth } from "@/lib/firebase/client";

const ADMIN_EMAIL = "her.dos.santos.nascimento@gmail.com";

type AdminRole = "admin" | "staff";

export default function AdminReservasPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  const [role, setRole] = useState<AdminRole | null>(null);

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/admin/login");
        return;
      }

      try {
        let resolvedRole: AdminRole | null = null;

        if (currentUser.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          resolvedRole = "admin";
        } else {
          const token = await currentUser.getIdTokenResult(true);

          const claimRole = token.claims.role;

          if (claimRole === "admin" || claimRole === "staff") {
            resolvedRole = claimRole;
          }
        }

        if (!resolvedRole) {
          await signOut(auth);
          router.replace("/admin/login");
          return;
        }

        setUser(currentUser);
        setRole(resolvedRole);
        setChecking(false);
      } catch (error) {
        console.error("ERRO AO VALIDAR ROLE ADMIN:", error);

        await signOut(auth);
        router.replace("/admin/login");
      }
    });
  }, [router]);

  if (checking || !user || !role) {
    return (
      <main className="admin-dashboard-shell">
        <p>A verificar acesso...</p>
      </main>
    );
  }

  const isAdmin = role === "admin";

  return (
    <main className="admin-dashboard-shell">
      <div className="admin-dashboard-heading">
        <div>
          <p className="eyebrow">Painel 7Go</p>

          <h1>{isAdmin ? "Gestão operacional" : "Operação 7Go"}</h1>

          <p>
            {isAdmin
              ? "Controla indicadores, reservas, pagamentos, entregas, devoluções e frota num só lugar."
              : "Gere reservas, entregas, devoluções e calendário operacional."}
          </p>
        </div>

        <div className="admin-role-badge">
          {isAdmin ? "Administrador" : "Funcionário"}
        </div>
      </div>

      <TotpSetup user={user} label="Administrador 7Go" />

      <Tabs defaultValue="reservas" className="admin-dashboard-tabs">
        <TabsList className="admin-dashboard-tabs-list">
          {isAdmin && (
            <TabsTrigger
              value="visao-geral"
              className="admin-dashboard-tab-trigger"
            >
              <LayoutDashboard aria-hidden="true" />
              Visão Geral
            </TabsTrigger>
          )}

          <TabsTrigger value="reservas" className="admin-dashboard-tab-trigger">
            <CalendarDays aria-hidden="true" />
            Reservas
          </TabsTrigger>

          {isAdmin && (
            <TabsTrigger value="frota" className="admin-dashboard-tab-trigger">
              <CarFront aria-hidden="true" />
              Frota
            </TabsTrigger>
          )}

          {isAdmin && (
            <TabsTrigger
              value="oficina"
              className="admin-dashboard-tab-trigger"
            >
              <Wrench aria-hidden="true" />
              Oficina
            </TabsTrigger>
          )}

          {isAdmin && (
            <TabsTrigger
              value="clientes"
              className="admin-dashboard-tab-trigger"
            >
              <Users aria-hidden="true" />
              Clientes
            </TabsTrigger>
          )}

          {isAdmin && (
            <TabsTrigger
              value="funcionarios"
              className="admin-dashboard-tab-trigger"
            >
              <UserCog aria-hidden="true" />
              Funcionários
            </TabsTrigger>
          )}

          {isAdmin && (
            <TabsTrigger
              value="relatorios"
              className="admin-dashboard-tab-trigger"
            >
              <FileBarChart aria-hidden="true" />
              Relatórios
            </TabsTrigger>
          )}

          <TabsTrigger
            value="calendario"
            className="admin-dashboard-tab-trigger"
          >
            <CalendarRange aria-hidden="true" />
            Calendário
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <TabsContent
            value="visao-geral"
            className="admin-dashboard-tab-content"
          >
            <AdminOverview />
          </TabsContent>
        )}

        <TabsContent value="reservas" className="admin-dashboard-tab-content">
          <AdminBookings />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="frota" className="admin-dashboard-tab-content">
            <AdminFleet />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="oficina" className="admin-dashboard-tab-content">
            <AdminWorkshop />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="clientes" className="admin-dashboard-tab-content">
            <AdminCustomers />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent
            value="funcionarios"
            className="admin-dashboard-tab-content"
          >
            <AdminStaff />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent
            value="relatorios"
            className="admin-dashboard-tab-content"
          >
            <AdminFinancialReports />
          </TabsContent>
        )}

        <TabsContent value="calendario" className="admin-dashboard-tab-content">
          <AdminFleetCalendar />
        </TabsContent>
      </Tabs>
    </main>
  );
}
