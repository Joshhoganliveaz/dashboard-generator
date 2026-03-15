import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock getCloudflareContext before importing r2 module
const mockPut = vi.fn().mockResolvedValue(undefined);
const mockGet = vi.fn();
const mockDelete = vi.fn().mockResolvedValue(undefined);

const mockBucket = {
  put: mockPut,
  get: mockGet,
  delete: mockDelete,
};

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: () => ({
    env: {
      DASHBOARDS: mockBucket,
    },
  }),
}));

import { uploadDashboardHtml, getDashboardHtml, deleteDashboardHtml } from "../r2";

describe("R2 helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadDashboardHtml", () => {
    it("calls bucket.put with correct key and content-type", async () => {
      await uploadDashboardHtml("smith-family", "<html>test</html>");

      expect(mockPut).toHaveBeenCalledOnce();
      expect(mockPut).toHaveBeenCalledWith(
        "d/smith-family.html",
        "<html>test</html>",
        { httpMetadata: { contentType: "text/html; charset=utf-8" } }
      );
    });
  });

  describe("getDashboardHtml", () => {
    it("returns ReadableStream body when object exists", async () => {
      const fakeStream = new ReadableStream();
      mockGet.mockResolvedValue({ body: fakeStream });

      const result = await getDashboardHtml("smith-family");

      expect(mockGet).toHaveBeenCalledWith("d/smith-family.html");
      expect(result).toBe(fakeStream);
    });

    it("returns null when object does not exist", async () => {
      mockGet.mockResolvedValue(null);

      const result = await getDashboardHtml("nonexistent");

      expect(mockGet).toHaveBeenCalledWith("d/nonexistent.html");
      expect(result).toBeNull();
    });
  });

  describe("deleteDashboardHtml", () => {
    it("calls bucket.delete with correct key", async () => {
      await deleteDashboardHtml("smith-family");

      expect(mockDelete).toHaveBeenCalledOnce();
      expect(mockDelete).toHaveBeenCalledWith("d/smith-family.html");
    });
  });
});
