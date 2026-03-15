/**
 * Generate a URL-safe slug from client names and optional address.
 * Output: lowercase letters, numbers, and hyphens only. Max 80 chars.
 *
 * Pure function -- safe for both client and server use.
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
