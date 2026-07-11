import { CarFront, CalendarDays } from "lucide-react";
import { AdminBookings } from "@/components/admin/AdminBookings";
import { AdminFleet } from "@/components/admin/AdminFleet";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export default function AdminReservasPage() {
  return (
    <main className="admin-dashboard-shell">
      <div className="admin-dashboard-heading">
        <div>
          <p className="eyebrow">Painel 7Go</p>
          <h1>Gestão operacional</h1>
          <p>
            Controla reservas, pagamentos, entregas, devoluções e frota num só
            lugar.
          </p>
        </div>
      </div>

      <Tabs defaultValue="reservas" className="admin-dashboard-tabs">
        <TabsList className="admin-dashboard-tabs-list">
          <TabsTrigger
            value="reservas"
            className="admin-dashboard-tab-trigger"
          >
            <CalendarDays aria-hidden="true" />
            Reservas
          </TabsTrigger>

          <TabsTrigger
            value="frota"
            className="admin-dashboard-tab-trigger"
          >
            <CarFront aria-hidden="true" />
            Frota
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="reservas"
          className="admin-dashboard-tab-content"
        >
          <AdminBookings />
        </TabsContent>

        <TabsContent
          value="frota"
          className="admin-dashboard-tab-content"
        >
          <AdminFleet />
        </TabsContent>
      </Tabs>
    </main>
  );
}
