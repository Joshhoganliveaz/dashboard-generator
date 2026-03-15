import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("Legacy auth removal", () => {
  it("src/app/api/login/route.ts file does NOT exist", () => {
    const routePath = path.resolve(__dirname, "../app/api/login/route.ts");
    expect(fs.existsSync(routePath)).toBe(false);
  });

  it("no file in src/ contains SITE_PASSWORD", () => {
    const srcDir = path.resolve(__dirname, "..");
    const files = getAllTsFiles(srcDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("SITE_PASSWORD");
    }
  });

  it("no file in src/ contains dashboard-auth cookie name", () => {
    const srcDir = path.resolve(__dirname, "..");
    const files = getAllTsFiles(srcDir);
    for (const file of files) {
      const content = fs.readFileSync(file, "utf-8");
      expect(content).not.toContain("dashboard-auth");
    }
  });
});

function getAllTsFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith("__tests__") && entry.name !== "node_modules") {
      results.push(...getAllTsFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx"))) {
      results.push(fullPath);
    }
  }
  return results;
}
