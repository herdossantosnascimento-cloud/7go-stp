"use client";

import { CalendarDays, CalendarRange, CarFront, LogOut } from "lucide-react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminBookings } from "@/components/admin/AdminBookings";
import { AdminFleetCalendar } from "@/components/admin/AdminFleetCalendar";
import { StaffVehicles } from "@/components/staff/StaffVehicles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TotpSetup } from "@/components/auth/TotpSetup";
import { auth } from "@/lib/firebase/client";

export default function StaffPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);

  const [checking, setChecking] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace("/staff/login");
        return;
      }

      try {
        const token = await currentUser.getIdTokenResult(true);

        if (token.claims.role !== "staff") {
          await signOut(auth);
          router.replace("/staff/login");
          return;
        }

        setUser(currentUser);
        setChecking(false);
      } catch (error) {
        console.error("ERRO AO VALIDAR STAFF:", error);

        await signOut(auth);
        router.replace("/staff/login");
      }
    });
  }, [router]);

  async function logout() {
    await signOut(auth);
    router.replace("/staff/login");
  }

  if (checking || !user) {
    return (
      <main className="staff-dashboard-shell">
        <p>A verificar acesso...</p>
      </main>
    );
  }

  const firstName = user.displayName?.trim().split(/\s+/)[0] || "Funcionário";

  return (
    <main className="staff-dashboard-shell">
      <header className="staff-dashboard-header">
        <div>
          <span>7GO · Área do funcionário</span>

          <h1>Olá, {firstName}</h1>

          <p>Gestão operacional de reservas, entregas e devoluções.</p>
        </div>

        <button type="button" onClick={logout}>
          <LogOut aria-hidden="true" />
          Sair
        </button>
      </header>

      <TotpSetup user={user} label="Funcionário 7Go" />

      <Tabs defaultValue="reservas" className="admin-dashboard-tabs">
        <TabsList className="admin-dashboard-tabs-list">
          <TabsTrigger value="reservas" className="admin-dashboard-tab-trigger">
            <CalendarDays aria-hidden="true" />
            Reservas
          </TabsTrigger>

          <TabsTrigger value="viaturas" className="admin-dashboard-tab-trigger">
            <CarFront aria-hidden="true" />
            Viaturas
          </TabsTrigger>

          <TabsTrigger
            value="calendario"
            className="admin-dashboard-tab-trigger"
          >
            <CalendarRange aria-hidden="true" />
            Calendário
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reservas" className="admin-dashboard-tab-content">
          <AdminBookings authContext="staff" />
        </TabsContent>

        <TabsContent value="viaturas" className="admin-dashboard-tab-content">
          <StaffVehicles />
        </TabsContent>

        <TabsContent value="calendario" className="admin-dashboard-tab-content">
          <AdminFleetCalendar />
        </TabsContent>
      </Tabs>
    </main>
  );
}
