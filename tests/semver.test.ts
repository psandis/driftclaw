import { describe, it, expect } from "vitest";
import { isValid, compare, driftLevel } from "../src/lib/semver.js";

describe("semver utils", () => {
  describe("isValid", () => {
    it("accepts standard semver", () => {
      expect(isValid("1.0.0")).toBe(true);
    });

    it("accepts v-prefixed semver", () => {
      expect(isValid("v1.0.0")).toBe(true);
    });

    it("rejects non-semver", () => {
      expect(isValid("latest")).toBe(false);
    });
  });

  describe("compare", () => {
    it("compares semver versions", () => {
      expect(compare("v1.0.0", "v2.0.0")).toBeLessThan(0);
      expect(compare("v2.0.0", "v1.0.0")).toBeGreaterThan(0);
      expect(compare("v1.0.0", "v1.0.0")).toBe(0);
    });

    it("falls back to string compare for non-semver", () => {
      expect(compare("abc", "def")).toBeLessThan(0);
    });
  });

  describe("driftLevel", () => {
    it("detects major drift", () => {
      expect(driftLevel("v1.0.0", "v2.0.0")).toBe("major");
    });

    it("detects minor drift", () => {
      expect(driftLevel("v1.0.0", "v1.1.0")).toBe("minor");
    });

    it("detects patch drift", () => {
      expect(driftLevel("v1.0.0", "v1.0.1")).toBe("patch");
    });

    it("detects no drift", () => {
      expect(driftLevel("v1.0.0", "v1.0.0")).toBe("none");
    });

    it("returns unknown for non-semver", () => {
      expect(driftLevel("abc", "def")).toBe("unknown");
    });
  });
});
