import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BuildProgress } from "@/components/studio/BuildProgress";

afterEach(() => {
  // no-op
});

describe("BuildProgress", () => {
  it("renders nothing while inactive", () => {
    const { container } = render(<BuildProgress active={false} complete={false} mode="save" />);
    expect(container.querySelector('[data-testid="studio-build"]')).toBeNull();
  });

  it("shows the running build window with named stages", () => {
    render(<BuildProgress active complete={false} mode="save" />);
    const win = screen.getByTestId("studio-build");
    expect(win).toBeTruthy();
    expect(win.textContent).toMatch(/Building draft/);
    expect(win.textContent).toMatch(/Importing assets/);
    expect(win.textContent).toMatch(/Compiling gameplay scripts/);
  });

  it("shows the done state for a draft", () => {
    render(<BuildProgress active complete mode="save" />);
    expect(screen.getByTestId("studio-build").textContent).toMatch(/Draft saved/);
    expect(screen.getByTestId("studio-build").textContent).toMatch(/Build finished/);
  });

  it("labels a publish build differently", () => {
    render(<BuildProgress active complete mode="publish" />);
    const txt = screen.getByTestId("studio-build").textContent ?? "";
    expect(txt).toMatch(/Submitted for review/);
    expect(txt).toMatch(/Uploading to NexConsole/);
  });

  it("unmounts shortly after it goes inactive", async () => {
    const { rerender, container } = render(<BuildProgress active complete mode="save" />);
    expect(container.querySelector('[data-testid="studio-build"]')).toBeTruthy();
    rerender(<BuildProgress active={false} complete mode="save" />);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(container.querySelector('[data-testid="studio-build"]')).toBeNull();
  });
});
