import { describe, it, expect } from "vitest";
import { asRecord, asJson } from "@/lib/supabaseJson";

describe("asRecord", () => {
  it("passes through plain objects", () => {
    expect(asRecord({ a: 1, b: "x" })).toEqual({ a: 1, b: "x" });
  });

  it("returns {} for null, arrays and primitives", () => {
    expect(asRecord(null)).toEqual({});
    expect(asRecord(undefined)).toEqual({});
    expect(asRecord([1, 2, 3])).toEqual({});
    expect(asRecord("hello")).toEqual({});
    expect(asRecord(42)).toEqual({});
  });
});

describe("asJson", () => {
  it("passes the value through for Supabase writes", () => {
    const payload = { mode: "runner", levels: 3 };
    expect(asJson(payload)).toBe(payload);
    expect(asJson({})).toEqual({});
  });
});
