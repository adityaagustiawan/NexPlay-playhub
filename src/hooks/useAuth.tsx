import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { blockedState, type ModerationKind } from "@/lib/moderation";

export interface AuthProfile {
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  coins: number;
  role: string | null;
  creator_tier: string | null;
  is_banned: boolean | null;
  banned_reason: string | null;
  suspended_until: string | null;
  suspended_reason: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: AuthProfile | null;
  /** True for accounts with role = 'admin'. */
  isAdmin: boolean;
  /** True when the account gets every Pro feature — Pro creators AND admins. */
  isPro: boolean;
  /** True while the account is banned, or suspended and the window hasn't elapsed. */
  isBlocked: boolean;
  blockKind: ModerationKind | null;
  suspendedUntil: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  profile: null,
  isAdmin: false,
  isPro: false,
  isBlocked: false,
  blockKind: null,
  suspendedUntil: null,
  signOut: async () => {},
  refreshProfile: async () => {},
});

const PROFILE_COLUMNS =
  "display_name, avatar_url, bio, coins, role, creator_tier, is_banned, banned_reason, suspended_until, suspended_reason";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<AuthProfile | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("Failed to load profile:", error.message);
      return;
    }
    // Rows created before the profiles migration/trigger existed can be missing.
    setProfile(
      data ?? {
        display_name: null,
        avatar_url: null,
        bio: null,
        coins: 0,
        role: null,
        creator_tier: null,
        is_banned: false,
        banned_reason: null,
        suspended_until: null,
        suspended_reason: null,
      }
    );
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const derived = useMemo(() => {
    const isAdmin = profile?.role === "admin";
    // Admins get every Pro capability; Pro creators are unlocked by a top-up.
    const isPro = isAdmin || profile?.creator_tier === "pro";
    const state = blockedState(profile);
    return {
      isAdmin,
      isPro,
      isBlocked: state.blocked,
      blockKind: state.kind,
      suspendedUntil: state.until,
    };
  }, [profile]);

  return (
    <AuthContext.Provider
      value={{ user, session, loading, profile, signOut, refreshProfile, ...derived }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
