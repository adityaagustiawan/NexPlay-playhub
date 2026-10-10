import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, friendlyAuthError } from "@/lib/authError";

interface GoogleAuthButtonProps {
  label?: string;
  /** Where Supabase sends the player back to after Google consent. */
  redirectTo?: string;
}

/**
 * "Easy login" via Google OAuth. On success the browser leaves the app for
 * Google and returns to `redirectTo`, where supabase-js picks up the session
 * (autoRefreshToken / detectSessionInUrl) and the user is signed in.
 */
export function GoogleAuthButton({ label = "Continue with Google", redirectTo }: GoogleAuthButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: redirectTo ?? window.location.origin },
      });
      if (error) setError(friendlyAuthError(error.message));
    } catch (err) {
      // supabase-js can reject (rather than return { error }) on network failure
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full bg-secondary text-foreground font-heading text-sm font-semibold py-3 rounded-lg flex items-center justify-center gap-3 border border-border hover:bg-secondary/70 transition-colors disabled:opacity-50"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09A12 12 0 0 0 12 24Z"
          />
          <path
            fill="#FBBC05"
            d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.63H1.28a12 12 0 0 0 0 10.74l3.99-3.09Z"
          />
          <path
            fill="#EA4335"
            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.63l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
          />
        </svg>
        {loading ? "Connecting…" : label}
      </button>
      {error && <p className="font-body text-xs text-destructive text-center">{error}</p>}
    </div>
  );
}
