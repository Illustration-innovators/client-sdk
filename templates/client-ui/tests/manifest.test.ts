import { describe, expect, it } from "vitest";
import manifest from "../calculator.manifest.json";

// Rules for this repository. `illustrata-release validate` checks the platform's.
describe("calculator.manifest.json", () => {
  it("publishes under this client's key", () => {
    expect(manifest.clientKey).toBe("__CLIENT_KEY__");
    expect(manifest.embedType).toBe(`${manifest.clientKey}--${manifest.calculatorKey}`);
  });

  it("declares only endpoint roles the UI calls", () => {
    // `runtime.calculate(slug, inputs)` with no `endpoint` uses `primary`.
    expect(manifest.integration.endpointRoles).toEqual(["primary"]);
  });
});
