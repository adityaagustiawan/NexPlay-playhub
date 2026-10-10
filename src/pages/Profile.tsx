import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { User, Coins, Save, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // The profile loads asynchronously — keep the form in sync once it arrives
  // (previously the inputs stayed empty forever because state was initialized
  // before the fetch resolved).
  useEffect(() => {
    setDisplayName(profile?.display_name || "");
    setBio(profile?.bio || "");
  }, [profile?.display_name, profile?.bio]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError("");
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName, bio })
      .eq("user_id", user.id);
    if (error) {
      setSaveError(error.message);
      setSaving(false);
      return;
    }
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <AppLayout>
      <h1 className="font-heading text-2xl font-bold text-foreground mb-6">Profile</h1>

      <div className="max-w-lg space-y-6">
        {/* Avatar & Info */}
        <div className="bg-card border border-border rounded-2xl p-6 flex items-center gap-5">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">{profile?.display_name || "Player"}</h2>
            <p className="font-body text-sm text-muted-foreground">{user?.email}</p>
            <div className="flex items-center gap-1 mt-1">
              <Coins className="h-4 w-4 text-primary" />
              <span className="font-heading text-sm font-bold text-foreground">{profile?.coins || 0} NexCoins</span>
            </div>
          </div>
        </div>

        {/* Edit */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h3 className="font-heading text-sm font-bold text-foreground">Edit Profile</h3>

          <div>
            <label className="font-body text-sm text-muted-foreground mb-1.5 block">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-secondary rounded-lg px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="font-body text-sm text-muted-foreground mb-1.5 block">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full bg-secondary rounded-lg px-4 py-3 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none h-20 focus:ring-2 focus:ring-primary"
              placeholder="Tell the world about yourself..."
            />
          </div>

          {saveError && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
              <p className="font-body text-sm text-destructive">{saveError}</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary text-primary-foreground font-heading text-sm font-semibold px-6 py-3 rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saved ? "Saved!" : saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 text-destructive font-body text-sm hover:underline"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </AppLayout>
  );
};

export default Profile;
