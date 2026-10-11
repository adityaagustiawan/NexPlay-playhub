// onboarding.ts — per-user first-run flags for the studio's opening animation,
// tool tips and the "how to use" tour. Persisted in localStorage so the full
// onboarding is shown only the first time a given account opens the studio
// (signed-out visitors get a shared "guest" key).

const PREFIX = "nexstudio_onboarded_";

/** localStorage key for a user's onboarding flag ("guest" when signed out). */
export function onboardingKey(userId?: string | null): string {
  return `${PREFIX}${userId || "guest"}`;
}

/** True once this user has finished (or dismissed) the first-run onboarding. */
export function hasOnboarded(userId?: string | null): boolean {
  try {
    return localStorage.getItem(onboardingKey(userId)) === "1";
  } catch {
    return false;
  }
}

/** Mark this user as onboarded so the tour isn't shown again. */
export function markOnboarded(userId?: string | null): void {
  try {
    localStorage.setItem(onboardingKey(userId), "1");
  } catch {
    /* storage unavailable — the tour will simply show again next time */
  }
}

/** Forget the flag (Help ▸ Reset tips & tutorial shows it again). */
export function clearOnboarded(userId?: string | null): void {
  try {
    localStorage.removeItem(onboardingKey(userId));
  } catch {
    /* ignore */
  }
}

/** How long the opening animation runs (ms): longer with the welcome tour. */
export function introDuration(firstRun: boolean): number {
  return firstRun ? 2600 : 1100;
}
