import { createClient } from "./server";
import type { Dashboard, SellData, BuyData, DashboardWithData, PropertyOfInterest } from "./types";

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

  // Supabase returns joined tables as arrays when there's no UNIQUE constraint
  // on the foreign key. Normalize sell_data and buy_data to single objects.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = data as any;
  if (Array.isArray(result.sell_data)) {
    result.sell_data = result.sell_data[0] ?? null;
  }
  if (Array.isArray(result.buy_data)) {
    result.buy_data = result.buy_data[0] ?? null;
  }

  return result as DashboardWithData;
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
    .select()
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

  // Check if row exists first to avoid needing a unique constraint on dashboard_id
  const { data: existing } = await supabase
    .from("sell_data")
    .select("id")
    .eq("dashboard_id", dashboard_id)
    .maybeSingle();

  if (existing) {
    const { data: sellData, error } = await supabase
      .from("sell_data")
      .update(data)
      .eq("dashboard_id", dashboard_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sellData as SellData;
  } else {
    const { data: sellData, error } = await supabase
      .from("sell_data")
      .insert({ ...data, dashboard_id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return sellData as SellData;
  }
}

// ---- Buy Data ----

export async function upsertBuyData(
  dashboard_id: string,
  data: Partial<Omit<BuyData, "id" | "dashboard_id" | "created_at" | "updated_at">>
): Promise<BuyData> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("buy_data")
    .select("id")
    .eq("dashboard_id", dashboard_id)
    .maybeSingle();

  if (existing) {
    const { data: buyData, error } = await supabase
      .from("buy_data")
      .update(data)
      .eq("dashboard_id", dashboard_id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return buyData as BuyData;
  } else {
    const { data: buyData, error } = await supabase
      .from("buy_data")
      .insert({ ...data, dashboard_id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return buyData as BuyData;
  }
}

// ---- Properties of Interest ----

export async function listPropertiesOfInterest(
  dashboardId: string
): Promise<PropertyOfInterest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties_of_interest")
    .select("*")
    .eq("dashboard_id", dashboardId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PropertyOfInterest[];
}

export async function addPropertyOfInterest(
  dashboardId: string,
  data: {
    address: string;
    price?: number;
    listing_url?: string;
    photo_url?: string;
    notes?: string;
  }
): Promise<PropertyOfInterest> {
  const supabase = await createClient();

  // Get max sort_order for this dashboard
  const { data: existing } = await supabase
    .from("properties_of_interest")
    .select("sort_order")
    .eq("dashboard_id", dashboardId)
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data: poi, error } = await supabase
    .from("properties_of_interest")
    .insert({ ...data, dashboard_id: dashboardId, sort_order: nextOrder })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return poi as PropertyOfInterest;
}

export async function removePropertyOfInterest(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("properties_of_interest")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}
