import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, friendlyAuthError } from "@/lib/authError";
import { NavLink } from "@/components/NavLink";
import { UserPlus, Mail, Lock, User, Eye, EyeOff, Gamepad2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) {
        setError(friendlyAuthError(error.message));
      } else {
        setSuccess(true);
      }
    } catch (err) {
      // supabase-js rejects (rather than returning { error }) on network failure
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-2xl p-8 max-w-md text-center">
          <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">Check your email</h2>
          <p className="font-body text-sm text-muted-foreground mb-4">
            We sent a confirmation link to <strong className="text-foreground">{email}</strong>.
            Click the link to activate your account.
          </p>
          <NavLink to="/login" className="text-primary font-body text-sm hover:underline">
            Back to Sign In
          </NavLink>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Gamepad2 className="h-8 w-8 text-primary" />
            <h1 className="font-heading text-2xl font-bold text-foreground">
              <span className="text-primary">NEX</span>CONSOLE
            </h1>
          </div>
          <p className="font-body text-muted-foreground">Create your player account</p>
        </div>

        <form onSubmit={handleSignup} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <p className="font-body text-sm text-destructive">{error}</p>
            </div>
          )}

          <div>
            <label className="font-body text-sm text-muted-foreground mb-1.5 block">Display Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-secondary rounded-lg pl-10 pr-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
                placeholder="CoolGamer42"
                required
              />
            </div>
          </div>

          <div>
            <label className="font-body text-sm text-muted-foreground mb-1.5 block">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-secondary rounded-lg pl-10 pr-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="font-body text-sm text-muted-foreground mb-1.5 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-secondary rounded-lg pl-10 pr-10 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
                placeholder="Min 6 characters"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-primary-foreground font-heading text-sm font-semibold py-3 rounded-lg flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {loading ? "Creating account..." : "Create Account"}
          </button>

          <p className="font-body text-sm text-muted-foreground text-center">
            Already have an account?{" "}
            <NavLink to="/login" className="text-primary hover:underline">
              Sign In
            </NavLink>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Signup;
