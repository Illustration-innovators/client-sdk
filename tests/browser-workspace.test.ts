import { describe, expect, it } from "vitest";
import { createBrowserWorkspace } from "../src/runtime/api/browser-workspace";
import type { EmbedProduct } from "../src/runtime/types";

const products: EmbedProduct[] = [
  {
    slug: "fia",
    name: "Index Annuity",
    allowedStates: null,
    variants: [
      { id: "v1", displayName: "Income 7", sparkProductCode: "A", kind: "fia-accum", displayOrder: 1, allowedStates: null },
      { id: "v2", displayName: "Income 10", sparkProductCode: "B", kind: "fia-accum", displayOrder: 2, allowedStates: null },
    ],
  },
];
const enabled = { version: 1 as const };
const inputs = (first: string, state: string, variant: string, premium: string) => ({
  selectedProductSlug: "fia",
  formValues: { OwnFirstName: first, OwnLastName: "Sample", OwnAge: "61", State: state, Product: variant, initamt: premium },
});

describe("browser workspace", () => {
  it("exists only for a Hosted Tool credential the platform enabled", () => {
    expect(createBrowserWorkspace("hosted:demo", products, null)).toBeUndefined();
    expect(createBrowserWorkspace("embed-token", products, enabled)).toBeUndefined();
    expect(createBrowserWorkspace("frame:abc", products, enabled)).toBeUndefined();
    const workspace = createBrowserWorkspace("hosted:demo", products, enabled)!;
    expect(workspace.persistence).toBe("browser");
    expect(workspace.user.name).toBe("Guest");
  });

  it("saves with versions, projects dashboard columns and isolates copies", async () => {
    const workspace = createBrowserWorkspace("hosted:demo", products, enabled)!;
    const created = await workspace.createCase("  ");
    expect(created.displayName).toBe("New Illustration");
    const saved = await workspace.saveCase(created.id, { version: 1, workingInputs: inputs("Ana", "NE", "v2", "250000") });
    expect(saved).toMatchObject({ version: 2, clientName: "Ana Sample", clientAge: 61, state: "NE", productDisplayName: "Income 10", premium: 250000 });
    await expect(workspace.saveCase(created.id, { version: 1, displayName: "stale" })).rejects.toMatchObject({ status: 409 });
    saved.displayName = "mutated";
    expect((await workspace.getCase(created.id)).displayName).toBe("New Illustration");
    const copy = await workspace.duplicateCase(created.id);
    expect(copy.displayName).toBe("New Illustration (copy)");
    expect(copy.clientName).toBe("Ana Sample");
    await workspace.deleteCase(copy.id);
    await expect(workspace.getCase(copy.id)).rejects.toMatchObject({ status: 404 });
  });

  it("rejects products the tool does not link", async () => {
    const workspace = createBrowserWorkspace("hosted:demo", products, enabled)!;
    const created = await workspace.createCase("A");
    await expect(workspace.saveCase(created.id, { version: 1, workingInputs: { selectedProductSlug: "other" } })).rejects.toMatchObject({ status: 400 });
  });

  it("searches, filters, sorts and pages like the platform", async () => {
    const workspace = createBrowserWorkspace("hosted:demo", products, enabled)!;
    for (const [name, first, state, variant, premium] of [
      ["Whitfield", "Margaret", "NE", "v1", "100000"],
      ["Okafor", "Daniel", "IA", "v2", "300000"],
      ["Reyes", "Carlos", "NE", "v2", "200000"],
    ]) {
      const item = await workspace.createCase(name);
      await workspace.saveCase(item.id, { version: 1, workingInputs: inputs(first!, state!, variant!, premium!) });
    }
    await workspace.createCase("Empty");
    const all = await workspace.listCases();
    expect(all.total).toBe(4);
    expect(all.filterOptions).toEqual({ products: ["Income 10", "Income 7"], states: ["IA", "NE"] });
    expect((await workspace.listCases(new URLSearchParams({ q: "carlos" }))).items.map((item) => item.displayName)).toEqual(["Reyes"]);
    expect((await workspace.listCases(new URLSearchParams("state=NE&product=Income 10"))).total).toBe(1);
    expect((await workspace.listCases(new URLSearchParams({ status: "complete" }))).total).toBe(0);
    const byPremium = await workspace.listCases(new URLSearchParams({ sortBy: "premium", sortDirection: "asc" }));
    expect(byPremium.items.map((item) => item.premium)).toEqual([100000, 200000, 300000, null]);
    const page2 = await workspace.listCases(new URLSearchParams({ pageSize: "3", page: "2" }));
    expect(page2).toMatchObject({ page: 2, totalPages: 2, total: 4 });
    expect(page2.items).toHaveLength(1);
  });
});
