import { useEffect, useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Users,
  Gamepad2,
  RefreshCw,
  Loader2,
  ArrowLeft,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  AgeApiError,
  fetchCaptchaChallenge,
  submitAgeVerification,
  type CaptchaChallenge,
} from "@/lib/ageApi";
import { getDeviceHash } from "@/lib/device";
import {
  bracketForAge,
  computeAge,
  MAX_PLAUSIBLE_AGE,
  MINOR_DAILY_CAP_USD,
  MINOR_MAX_PACKAGE_USD,
  bracketLabel,
  type AgeBracket,
} from "@/lib/age";

export interface AgeGateResult {
  bracket: AgeBracket;
  guardianRequired: boolean;
}

interface AgeGateProps {
  open: boolean;
  onVerified: (result: AgeGateResult) => void;
  onClose?: () => void;
}

type Step = "dob" | "confirm" | "blocked";

/**
 * Blocking age-verification modal. A device that has accepted the terms keeps
 * its agreement server-side (see age_verifications); the gate only appears
 * again when the stored row is missing or incomplete.
 */
export function AgeGate({ open, onVerified, onClose }: AgeGateProps) {
  const { session } = useAuth();
  const [step, setStep] = useState<Step>("dob");
  const [birthDate, setBirthDate] = useState("");
  const [age, setAge] = useState<number | null>(null);
  const [bracket, setBracket] = useState<AgeBracket>("adult");
  const [captcha, setCaptcha] = useState<CaptchaChallenge | null>(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [policy, setPolicy] = useState(false);
  const [guardian, setGuardian] = useState(false);
  const [parentalNotice, setParentalNotice] = useState(false);
  const [devAgreement, setDevAgreement] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Reset every time the gate is opened fresh.
  useEffect(() => {
    if (!open) return;
    setStep("dob");
    setBirthDate("");
    setAge(null);
    setCaptcha(null);
    setCaptchaAnswer("");
    setPolicy(false);
    setGuardian(false);
    setParentalNotice(false);
    setDevAgreement(false);
    setError("");
    setLoading(false);
  }, [open]);

  if (!open) return null;

  const loadCaptcha = async () => {
    setRefreshing(true);
    try {
      const challenge = await fetchCaptchaChallenge();
      setCaptcha(challenge);
      setCaptchaAnswer("");
    } catch {
      setError("Could not load the verification question. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleContinue = async () => {
    setError("");
    const years = computeAge(birthDate);
    if (years === null || years > MAX_PLAUSIBLE_AGE) {
      setError("Please enter a valid date of birth.");
      return;
    }
    const nextBracket = bracketForAge(years);
    setAge(years);
    setBracket(nextBracket);
    if (nextBracket === "blocked") {
      setStep("blocked");
      return;
    }
    setStep("confirm");
    await loadCaptcha();
  };

  const handleSubmit = async () => {
    setError("");
    if (!session?.access_token) {
      setError("Your session expired. Please sign in again.");
      return;
    }
    if (!captcha) {
      setError("The verification question is missing. Reload it and try again.");
      return;
    }
    if (!captchaAnswer.trim()) {
      setError("Answer the verification question.");
      return;
    }
    if (!policy) {
      setError("You must accept the top-up policy.");
      return;
    }
    if (bracket === "minor" && !guardian) {
      setError("A parent or guardian must confirm before you can top up.");
      return;
    }
    if (bracket === "minor" && !parentalNotice) {
      setError("Please confirm you've read the parental supervision note.");
      return;
    }
    if (bracket === "senior" && !devAgreement) {
      setError("Accept the creator content agreement to continue.");
      return;
    }

    setLoading(true);
    try {
      const deviceHash = await getDeviceHash();
      const result = await submitAgeVerification(
        {
          birthDate,
          deviceHash,
          captchaToken: captcha.token,
          captchaAnswer: captchaAnswer.trim(),
          policyAccepted: policy,
          guardianAcknowledged: guardian,
          parentalNoticeAcknowledged: parentalNotice,
          devAgreementAccepted: devAgreement,
        },
        session.access_token,
      );
      onVerified(result);
    } catch (err) {
      if (err instanceof AgeApiError && err.code === "CAPTCHA_FAILED") {
        setError("That answer wasn't right — here's a new question.");
        await loadCaptcha();
      } else if (err instanceof AgeApiError) {
        setError(err.message);
        if (err.code === "AGE_TOO_YOUNG") setStep("blocked");
      } else {
        setError("Could not save your verification. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const isMinor = bracket === "minor";
  const isSenior = bracket === "senior";

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-sm flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 my-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-primary/20 rounded-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-heading text-lg font-bold text-foreground">
              Age verification required
            </h2>
            <p className="font-body text-xs text-muted-foreground">
              Required before buying NexCoins
            </p>
          </div>
          {onClose && step !== "blocked" && (
            <button
              onClick={onClose}
              className="font-body text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          )}
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="font-body text-sm text-destructive">{error}</p>
          </div>
        )}

        {step === "dob" && (
          <div className="space-y-4">
            <p className="font-body text-sm text-muted-foreground">
              We ask once per device. Enter your date of birth so we can apply the
              right safety rules.
            </p>
            <div>
              <label className="font-body text-sm text-muted-foreground mb-1.5 block">
                Date of birth
              </label>
              <input
                type="date"
                value={birthDate}
                max={today}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full bg-secondary rounded-lg px-4 py-3 font-body text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <button
              onClick={handleContinue}
              className="w-full bg-primary text-primary-foreground font-heading text-sm font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
            >
              Continue
            </button>
            <p className="font-body text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Lock className="h-3 w-3" />
              Stored against this device to keep the agreement from being bypassed.
            </p>
          </div>
        )}

        {step === "blocked" && (
          <div className="space-y-4 text-center py-2">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
            <h3 className="font-heading text-lg font-bold text-foreground">
              NexCoins are for players 15 and over
            </h3>
            <p className="font-body text-sm text-muted-foreground">
              Our records show this account is under 15, so top-ups aren't
              available. A parent or guardian can help you set up supervised
              play, but purchases stay disabled for now.
            </p>
            {onClose && (
              <button
                onClick={onClose}
                className="w-full bg-secondary text-foreground font-heading text-sm font-semibold py-3 rounded-lg hover:opacity-90 transition-opacity"
              >
                Back to Top Up
              </button>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-secondary/60 rounded-lg px-4 py-3">
              <span className="font-body text-sm text-muted-foreground">Detected age</span>
              <span className="font-heading text-sm font-bold text-foreground">
                {age} · {bracketLabel(bracket)}
              </span>
            </div>

            {isMinor && (
              <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-heading text-sm font-bold text-amber-500">
                      Parent or guardian control required
                    </p>
                    <p className="font-body text-xs text-muted-foreground mt-1">
                      You're {age}. Ask a parent or guardian to sit with you before
                      buying NexCoins. Your account can spend up to $
                      {MINOR_MAX_PACKAGE_USD} per purchase and $
                      {MINOR_DAILY_CAP_USD} per day. This agreement is saved to this
                      device and cannot be dismissed by refreshing.
                    </p>
                  </div>
                </div>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={guardian}
                    onChange={(e) => setGuardian(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="font-body text-xs text-foreground">
                    A parent or guardian is present and approves top-ups on this device.
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={parentalNotice}
                    onChange={(e) => setParentalNotice(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="font-body text-xs text-foreground">
                    I have read the parental supervision note above.
                  </span>
                </label>
              </div>
            )}

            {isSenior && (
              <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Gamepad2 className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-heading text-sm font-bold text-amber-500">
                      Just double-checking that age
                    </p>
                    <p className="font-body text-xs text-muted-foreground mt-1">
                      You entered an age of 50 or over. If that was a typo, go back
                      and correct it. If you're a real creator on NEXCONSOLE, accept
                      the creator agreement below: you must not publish adult,
                      hateful, or harmful games for players.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setStep("dob")}
                  className="font-body text-xs text-primary hover:underline"
                >
                  That was a typo — change my date of birth
                </button>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={devAgreement}
                    onChange={(e) => setDevAgreement(e.target.checked)}
                    className="mt-0.5 accent-primary"
                  />
                  <span className="font-body text-xs text-foreground">
                    I accept the NEXCONSOLE creator agreement and will not publish
                    adult or harmful content.
                  </span>
                </label>
              </div>
            )}

            {/* Captcha */}
            <div className="bg-secondary/60 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="font-body text-sm text-muted-foreground">
                  Human check
                </label>
                <button
                  onClick={loadCaptcha}
                  disabled={refreshing}
                  className="font-body text-xs text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                >
                  {refreshing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  New question
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-heading text-lg font-bold text-foreground whitespace-nowrap">
                  {captcha ? `${captcha.question} =` : "…"}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 font-body text-sm text-foreground outline-none focus:ring-2 focus:ring-primary"
                  placeholder="?"
                />
              </div>
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={policy}
                onChange={(e) => setPolicy(e.target.checked)}
                className="mt-0.5 accent-primary"
              />
              <span className="font-body text-xs text-foreground">
                I accept the NEXCONSOLE top-up policy: purchases are final, coins are
                non-refundable, and I'm responsible for keeping my account secure.
              </span>
            </label>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("dob")}
                className="flex items-center gap-2 bg-secondary text-foreground font-heading text-sm font-semibold px-4 py-3 rounded-lg hover:opacity-90 transition-opacity"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || refreshing}
                className="flex-1 bg-primary text-primary-foreground font-heading text-sm font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {loading ? "Verifying…" : "Verify & continue"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
