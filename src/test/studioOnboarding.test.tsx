import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudioTour } from "@/components/studio/StudioTour";
import { StudioIntro } from "@/components/studio/StudioIntro";

describe("StudioTour", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<StudioTour open={false} onClose={() => {}} />);
    expect(container.querySelector('[data-testid="studio-tour"]')).toBeNull();
  });

  it("starts on the first step and advances with Next", () => {
    render(<StudioTour open onClose={() => {}} />);
    expect(screen.getByTestId("studio-tour").textContent).toMatch(/Name your game/);
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByTestId("studio-tour").textContent).toMatch(/Pick 2D or 3D/);
  });

  it("closes from the header button", () => {
    const onClose = vi.fn();
    render(<StudioTour open onClose={onClose} />);
    fireEvent.click(screen.getByTestId("studio-tour-done"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("StudioIntro", () => {
  it("shows the brand and can be skipped", () => {
    const onDone = vi.fn();
    render(<StudioIntro firstRun onDone={onDone} />);
    expect(screen.getByTestId("studio-intro").textContent).toMatch(/NexPlay/);
    fireEvent.click(screen.getByTestId("studio-intro-skip"));
    expect(onDone).not.toHaveBeenCalled(); // waits for the fade-out
  });
});
