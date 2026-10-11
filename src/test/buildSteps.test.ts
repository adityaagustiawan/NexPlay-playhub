import { describe, expect, it } from "vitest";
import { buildDone, buildSteps, buildTitle } from "@/lib/buildSteps";

describe("buildSteps", () => {
  it("returns a non-empty, ordered list of named stages", () => {
    const steps = buildSteps("save");
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps[0].label).toMatch(/import/i);
    expect(steps.every((s) => s.label.length > 0 && s.detail.length > 0)).toBe(true);
  });

  it("gives distinct stage lists for save and publish", () => {
    const save = buildSteps("save");
    const publish = buildSteps("publish");
    expect(save.map((s) => s.label)).not.toEqual(publish.map((s) => s.label));
    expect(publish.at(-1)?.label).toMatch(/upload/i);
  });

  it("labels the running and finished states per mode", () => {
    expect(buildTitle("save")).toMatch(/draft/i);
    expect(buildTitle("publish")).toMatch(/upload/i);
    expect(buildDone("save")).toBe("Draft saved");
    expect(buildDone("publish")).toMatch(/review/i);
  });
});
