import { createClient } from "./server";
import type { Dashboard, SellData, BuyData, DashboardWithData } from "./types";

// ---- Dashboard CRUD ----

export async function createDashboard(
  data: Pick<Dashboard, "type" | "client_names" | "slug"> &
    Partial<Pick<Dashboard, "full_name" | "email" | "agent_key" | "created_by">>
): Promise<Dashboard> {
  const supabase = await createClient();
  const { data: dashboard, error } = await supabase
    .from("dashboards")
    .insert({
      ...data,
      status: "draft" as const,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return dashboard as Dashboard;
}

export async function getDashboard(id: string): Promise<DashboardWithData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dashboards")
    .select("*, sell_data(*), buy_data(*)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as DashboardWithData;
}

export async function listDashboards(): Promise<Dashboard[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dashboards")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as Dashboard[];
}

export async function updateDashboard(
  id: string,
  data: Partial<Omit<Dashboard, "id" | "created_at">>
): Promise<Dashboard> {
  const supabase = await createClient();
  const { data: dashboard, error } = await supabase
    .from("dashboards")
    .update(data)
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return dashboard as Dashboard;
}

// ---- Sell Data ----

export async function upsertSellData(
  dashboard_id: string,
  data: Partial<Omit<SellData, "id" | "dashboard_id" | "created_at" | "updated_at">>
): Promise<SellData> {
  const supabase = await createClient();
  const { data: sellData, error } = await supabase
    .from("sell_data")
    .upsert({ ...data, dashboard_id }, { onConflict: "dashboard_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return sellData as SellData;
}

// ---- Buy Data ----

export async function upsertBuyData(
  dashboard_id: string,
  data: Partial<Omit<BuyData, "id" | "dashboard_id" | "created_at" | "updated_at">>
): Promise<BuyData> {
  const supabase = await createClient();
  const { data: buyData, error } = await supabase
    .from("buy_data")
    .upsert({ ...data, dashboard_id }, { onConflict: "dashboard_id" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return buyData as BuyData;
}
