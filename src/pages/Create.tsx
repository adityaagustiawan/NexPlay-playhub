import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getDeviceHash } from "@/lib/device";
import { fetchStoredVerification, submitCreatorAgreement } from "@/lib/ageApi";
import { CREATOR_POLICY_VERSION, bracketLabel, type AgeBracket } from "@/lib/age";
import {
  Sparkles,
  Code,
  Palette,
  Zap,
  ArrowRight,
  Wand2,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Briefcase,
} from "lucide-react";
import { useEffect, useState } from "react";

const tools = [
  {
    icon: Wand2,
    title: "AI Game Builder",
    description: "Describe your game idea in natural language. Our AI generates a playable game from your prompt.",
    tag: "Powered by Jabali AI",
  },
  {
    icon: Code,
    title: "Visual Builder",
    description: "Drag-and-drop game creation with visual scripting. No coding required.",
    tag: null,
  },
  {
    icon: Palette,
    title: "Asset Studio",
    description: "AI-powered art generation. Create sprites, environments, and UI elements instantly.",
    tag: "AI Powered",
  },
  {
    icon: Zap,
    title: "Jabali Engine",
    description: "Physics, lighting, and AI behavior systems out of the box. Publish to NEXCONSOLE with one click.",
    tag: null,
  },
];

const Create = () => {
  const { user, session } = useAuth();
  const [agreementChecked, setAgreementChecked] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [agreementError, setAgreementError] = useState("");
  const [bracket, setBracket] = useState<AgeBracket | null>(null);
  const [deviceHash, setDeviceHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setAgreementChecked(true);
      setAgreementAccepted(false);
      setBracket(null);
      return;
    }
    (async () => {
      try {
        const hash = await getDeviceHash();
        if (cancelled) return;
        setDeviceHash(hash);

        const [agreementRes, verification] = await Promise.all([
          supabase
            .from("creator_agreements")
            .select("policy_version, accepted_at")
            .eq("user_id", user.id)
            .maybeSingle(),
          fetchStoredVerification(user.id, hash).catch(() => null),
        ]);
        if (cancelled) return;
        setAgreementAccepted(Boolean(agreementRes.data));
        setBracket(verification?.bracket ?? null);
      } catch {
        // ignore — the gate below will re-prompt
      } finally {
        if (!cancelled) setAgreementChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleAccept = async () => {
    setAgreementError("");
    if (!session?.access_token) {
      setAgreementError("Sign in to accept the creator agreement.");
      return;
    }
    setAccepting(true);
    try {
      const hash = deviceHash ?? (await getDeviceHash());
      await submitCreatorAgreement(
        { deviceHash: hash, policyVersion: CREATOR_POLICY_VERSION },
        session.access_token,
      );
      setAgreementAccepted(true);
    } catch {
      setAgreementError("Could not save the agreement. Please try again.");
    } finally {
      setAccepting(false);
    }
  };

  const canGenerate = Boolean(user) && agreementAccepted;

  return (
    <AppLayout>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-2">Create</h1>
      <p className="font-body text-muted-foreground mb-8 max-w-lg">
        Build your next game with AI. From concept to published game in minutes.
      </p>

      {/* Creator agreement gate */}
      {!agreementChecked ? (
        <div className="bg-muted border border-border rounded-xl p-4 mb-6 flex items-center gap-3 max-w-2xl">
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin shrink-0" />
          <p className="font-body text-sm text-muted-foreground">
            Checking your creator status…
          </p>
        </div>
      ) : agreementAccepted ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-6 flex items-start gap-3 max-w-2xl">
          <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-heading text-sm font-bold text-emerald-500">
              Creator agreement accepted
            </p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              You've agreed not to publish adult, hateful, or harmful games.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-card border-2 border-amber-500/40 rounded-2xl p-5 mb-8 max-w-2xl">
          <div className="flex items-start gap-3 mb-4">
            <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-heading text-sm font-bold text-foreground">
                Creator agreement required
              </h3>
              <p className="font-body text-xs text-muted-foreground mt-1">
                Before you generate or publish a game on NEXCONSOLE you must agree to
                the creator content policy.
              </p>
            </div>
          </div>
          <ul className="font-body text-xs text-muted-foreground space-y-1.5 mb-4 list-disc pl-5">
            <li>No adult, sexual, or sexually suggestive content.</li>
            <li>No hateful, harassing, or violent content targeting real people.</li>
            <li>No gambling, scams, or content that could harm players.</li>
            <li>Published games are reviewed and may be removed without notice.</li>
          </ul>
          {agreementError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <p className="font-body text-sm text-destructive">{agreementError}</p>
            </div>
          )}
          {user ? (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="bg-primary text-primary-foreground font-heading text-sm font-semibold px-5 py-3 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {accepting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {accepting ? "Saving…" : "Accept creator agreement"}
            </button>
          ) : (
            <a
              href="/login"
              className="inline-flex bg-primary text-primary-foreground font-heading text-sm font-semibold px-5 py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Sign in to accept
            </a>
          )}
        </div>
      )}

      {/* Senior creator assignment */}
      {bracket === "senior" && (
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-6 max-w-2xl flex items-start gap-3">
          <Briefcase className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-heading text-sm font-bold text-foreground">
              Creator assignment available
            </p>
            <p className="font-body text-xs text-muted-foreground mt-1">
              {bracketLabel(bracket)} · Thanks for confirming. You can take on creator
              assignments — start with the AI Game Builder below and we'll set your
              first brief.
            </p>
          </div>
        </div>
      )}

      {/* AI Prompt Area */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground">Describe your game</h3>
            <p className="font-body text-xs text-muted-foreground">Tell AI what you want to create</p>
          </div>
        </div>
        <textarea
          placeholder="e.g. A 2D platformer where you're a cat collecting fish in space..."
          className="w-full bg-secondary rounded-lg p-4 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none h-24 mb-4"
        />
        <button
          disabled={!canGenerate}
          title={canGenerate ? undefined : "Accept the creator agreement to generate games"}
          className="bg-primary text-primary-foreground font-heading text-sm font-semibold px-6 py-3 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="h-4 w-4" />
          Generate Game
          <ArrowRight className="h-4 w-4" />
        </button>
        {!canGenerate && (
          <p className="font-body text-xs text-muted-foreground mt-3">
            {user
              ? "Accept the creator agreement above to unlock the builder."
              : "Sign in and accept the creator agreement to unlock the builder."}
          </p>
        )}
      </div>

      {/* Tools Grid */}
      <h2 className="font-heading text-lg font-bold text-foreground mb-4">Creation Tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {tools.map((tool) => (
          <div
            key={tool.title}
            className="bg-card border border-border rounded-xl p-5 flex gap-4 hover:border-primary/40 transition-colors cursor-pointer"
          >
            <div className="bg-secondary p-3 rounded-lg h-fit">
              <tool.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-heading text-sm font-bold text-foreground">
                  {tool.title}
                </h3>
                {tool.tag && (
                  <span className="font-body text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {tool.tag}
                  </span>
                )}
              </div>
              <p className="font-body text-xs text-muted-foreground">
                {tool.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Your Projects — empty */}
      <h2 className="font-heading text-lg font-bold text-foreground mb-4">Your Projects</h2>
      <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center">
        <Code className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="font-body text-sm text-muted-foreground text-center">
          You haven't created any games yet. Start with an idea above!
        </p>
      </div>
    </AppLayout>
  );
};

export default Create;
