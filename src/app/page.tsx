import { listDashboards } from "@/lib/supabase/db";
import DashboardLibrary from "@/components/library/DashboardLibrary";

export default async function DashboardsPage() {
  const dashboards = await listDashboards();

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-slate text-white px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-xl font-display font-bold">Dashboards</h1>
          <p className="text-sm opacity-70">Live AZ Co</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <DashboardLibrary dashboards={dashboards} />
      </main>
    </div>
  );
}
