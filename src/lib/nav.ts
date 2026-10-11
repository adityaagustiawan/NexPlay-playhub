// nav.ts — how the sidebar's creation entry behaves per account tier.
//
// Free / trial accounts use the quick "Create" page (prompt → NexCode, capped at
// 5 games). Once an account is a Pro Creator — or an admin, since admins get
// every Pro feature — the Create page is retired and the Creator studio becomes
// the single creation surface.

export interface CreationNav {
  /** Destination + label of the prominent top button. */
  primaryTo: string;
  primaryLabel: string;
  /** Whether the "Create" item appears in the nav list. */
  showCreateItem: boolean;
  /** Whether the separate "Creator" nav item is needed (a Pro primary button already covers it). */
  showCreatorItem: boolean;
}

export function creationNav(isPro: boolean, isSignedIn: boolean): CreationNav {
  if (isPro) {
    return {
      primaryTo: "/creator",
      primaryLabel: "Creator",
      showCreateItem: false,
      showCreatorItem: false,
    };
  }
  return {
    primaryTo: "/create",
    primaryLabel: "Create",
    showCreateItem: true,
    showCreatorItem: isSignedIn,
  };
}
