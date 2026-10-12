// Shared friendlier messaging for auth failures.
// A raw swallowed network error (DNS/CORS/offline) surfaces to users as
// "Failed to fetch" or "NetworkError when attempting to fetch resource.",
// which is confusing. Map those to something actionable.
export const NETWORK_ERROR_MESSAGE =
  "Can't reach the game servers right now. Please check your connection and try again in a moment.";

export function friendlyAuthError(message?: string | null): string {
  if (!message) return NETWORK_ERROR_MESSAGE;
  if (/failed to fetch|networkerror|load failed|fetch failed|network request failed/i.test(message)) {
    return NETWORK_ERROR_MESSAGE;
  }
  return message;
}

// Normalizes both thrown errors (supabase-js rejects on network failure) and
// returned { error } objects into a single display string.
export function authErrorMessage(err: unknown): string {
  if (err instanceof Error) return friendlyAuthError(err.message);
  if (typeof err === "string") return friendlyAuthError(err);
  return NETWORK_ERROR_MESSAGE;
}
