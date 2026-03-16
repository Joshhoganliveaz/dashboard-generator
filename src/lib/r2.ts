import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Minimal R2Bucket interface — avoids pulling in @cloudflare/workers-types globally */
interface R2PutOptions {
  httpMetadata?: { contentType?: string };
}
interface R2Object {
  body: ReadableStream;
}
interface R2Bucket {
  put(key: string, value: string | ReadableStream, options?: R2PutOptions): Promise<R2Object>;
  get(key: string): Promise<R2Object | null>;
  delete(key: string): Promise<void>;
}

function getBucket(): R2Bucket {
  const { env } = getCloudflareContext();
  return (env as Record<string, unknown>).DASHBOARDS as R2Bucket;
}

/**
 * Upload rendered dashboard HTML to R2.
 * Key format: d/{slug}.html
 */
export async function uploadDashboardHtml(slug: string, html: string): Promise<void> {
  const bucket = getBucket();
  await bucket.put(`d/${slug}.html`, html, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });
}

/**
 * Fetch dashboard HTML from R2.
 * Returns the ReadableStream body, or null if not found.
 */
export async function getDashboardHtml(slug: string): Promise<ReadableStream | null> {
  const bucket = getBucket();
  const object = await bucket.get(`d/${slug}.html`);
  return object?.body ?? null;
}

/**
 * Delete dashboard HTML from R2.
 */
export async function deleteDashboardHtml(slug: string): Promise<void> {
  const bucket = getBucket();
  await bucket.delete(`d/${slug}.html`);
}
