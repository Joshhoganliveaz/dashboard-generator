import { createClient } from "@/lib/supabase/server";

// Re-export the pure slug generator for backward compatibility
export { generateSlug } from "./slug-utils";

/**
 * Find an available slug by checking for collisions in the database.
 * Appends -2, -3, etc. until an available slug is found.
 * Pass excludeId to skip the dashboard's own slug (for edits).
 *
 * Server-only: uses Supabase server client.
 */
export async function findAvailableSlug(
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  const supabase = await createClient();

  let candidate = baseSlug;
  let suffix = 1;

  while (true) {
    let query = supabase
      .from("dashboards")
      .select("slug")
      .eq("slug", candidate);

    if (excludeId) {
      query = query.neq("id", excludeId);
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);

    if (!data || data.length === 0) {
      return candidate;
    }

    suffix++;
    candidate = `${baseSlug}-${suffix}`;
  }
}
