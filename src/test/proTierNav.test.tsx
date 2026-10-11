import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { creationNav } from "@/lib/nav";

// useAuth is mocked so the gate can be toggled without Supabase.
const auth = vi.hoisted(() => ({ isPro: false }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ isPro: auth.isPro }) }));

import { FreeTierOnly } from "@/components/FreeTierOnly";

describe("creationNav", () => {
  it("keeps the Create page for free accounts", () => {
    const nav = creationNav(false, true);
    expect(nav).toEqual({
      primaryTo: "/create",
      primaryLabel: "Create",
      showCreateItem: true,
      showCreatorItem: true,
    });
  });

  it("hides the Create item for signed-out free visitors", () => {
    expect(creationNav(false, false).showCreatorItem).toBe(false);
  });

  it("retires Create in favour of Creator for Pro accounts", () => {
    const nav = creationNav(true, true);
    expect(nav.primaryTo).toBe("/creator");
    expect(nav.primaryLabel).toBe("Creator");
    expect(nav.showCreateItem).toBe(false);
    // The prominent Creator button already covers the entry.
    expect(nav.showCreatorItem).toBe(false);
  });
});

describe("FreeTierOnly", () => {
  const renderAtCreate = () =>
    render(
      <MemoryRouter initialEntries={["/create"]}>
        <Routes>
          <Route
            path="/create"
            element={
              <FreeTierOnly>
                <div>CREATE PAGE</div>
              </FreeTierOnly>
            }
          />
          <Route path="/creator" element={<div>CREATOR PAGE</div>} />
        </Routes>
      </MemoryRouter>,
    );

  it("renders the Create page for free accounts", () => {
    auth.isPro = false;
    renderAtCreate();
    expect(screen.getByText("CREATE PAGE")).toBeTruthy();
  });

  it("redirects Pro accounts to the Creator studio", () => {
    auth.isPro = true;
    renderAtCreate();
    expect(screen.queryByText("CREATE PAGE")).toBeNull();
    expect(screen.getByText("CREATOR PAGE")).toBeTruthy();
  });
});
