import { createClient } from "@/lib/supabase/server";

/**
 * Generate a URL-safe slug from client names and optional address.
 * Output: lowercase letters, numbers, and hyphens only. Max 80 chars.
 */
export function generateSlug(clientNames: string, address?: string): string {
  const raw = address ? `${clientNames} ${address}` : clientNames;

  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // strip special chars
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-+/, "") // trim leading hyphens
    .replace(/-+$/, ""); // trim trailing hyphens

  return slug.slice(0, 80);
}

/**
 * Find an available slug by checking for collisions in the database.
 * Appends -2, -3, etc. until an available slug is found.
 * Pass excludeId to skip the dashboard's own slug (for edits).
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
