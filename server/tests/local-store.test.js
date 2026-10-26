import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const { LocalStore } = createRequire(import.meta.url)("../local-store.cjs");

describe("offline storage", () => {
  it("persists CRUD and pending deletes across restarts, searches and rejects duplicate emails", () => {
    const directory = mkdtempSync(join(tmpdir(), "employees-"));
    try {
      let store = new LocalStore(directory);
      const employee = { _id: "abc", name: "Anjali Gupta", email: "anjali@example.com", designation: "Developer", department: "Engineering" };
      store.save(employee);
      store = new LocalStore(directory);
      expect(store.list("ENGINEERING")).toHaveLength(1);
      expect(() => store.save({ ...employee, _id: "def" })).toThrow(/already exists/);
      store.update("abc", { name: "Anjali Sharma" });
      expect(new LocalStore(directory).list()[0].name).toBe("Anjali Sharma");
      store.remove("abc");
      store = new LocalStore(directory);
      expect(store.list()).toEqual([]);
      expect(store.pending()[0]._deleted).toBe(true);
      store.merge([employee]);
      expect(store.list()).toEqual([]);
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
  it("preserves edits made during cloud sync and merges remote records", () => {
    const directory = mkdtempSync(join(tmpdir(), "employees-"));
    try {
      const store = new LocalStore(directory);
      const employee = { _id: "abc", name: "Anjali Gupta", email: "anjali@example.com", designation: "Developer", department: "Engineering" };
      store.save(employee);
      const sent = store.pending()[0];
      store.update("abc", { name: "Updated locally" });
      store.acknowledge("abc", sent._revision);
      store.merge([{ ...employee, createdAt: new Date(), updatedAt: new Date() }]);
      expect(store.list()[0].name).toBe("Updated locally");
      expect(store.pending()).toHaveLength(1);
      store.acknowledge("abc", store.pending()[0]._revision);
      store.merge([{ ...employee, createdAt: new Date(), updatedAt: new Date() }]);
      expect(store.pending()).toHaveLength(0);
      expect(store.list()[0].name).toBe("Anjali Gupta");
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
