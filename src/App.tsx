import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
import { RequireAdmin } from "@/components/RequireAdmin";
import { FreeTierOnly } from "@/components/FreeTierOnly";
import { SeasonalEventLayer } from "@/components/SeasonalEventLayer";
import Landing from "./pages/Landing";
import Library from "./pages/Library";
import Explore from "./pages/Explore";
import Create from "./pages/Create";
import Creator from "./pages/Creator";
import Play from "./pages/Play";
import Friends from "./pages/Friends";
import TopUp from "./pages/TopUp";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Profile from "./pages/Profile";
import Admin from "./pages/Admin";
import DevCoins from "./pages/DevCoins";
import GameDetail from "./pages/GameDetail";
import NotFound from "./pages/NotFound";
import Studio from "./pages/Studio";
import AutumnEvent from "./pages/AutumnEvent";
import Autumn from "./pages/Autumn";

const queryClient = new QueryClient();

/**
 * Landing (nexconsole) or the editor (Nexstudio) depending on the hostname.
 * The same build serves both sites; any nexstudio* host lands in the editor
 * (e.g. getnexstudio.vercel.app, nexstudio-mu.vercel.app).
 */
const RootRoute = () => {
  if (typeof window !== "undefined" && window.location.hostname.includes("nexstudio")) {
    return <Navigate to="/studio" replace />;
  }
  return <Landing />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          {/* Seasonal theme + event effects wrap every page */}
          <SeasonalEventLayer />
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/autumn" element={<Autumn />} />
            <Route path="/library" element={<Library />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/create" element={<FreeTierOnly><Create /></FreeTierOnly>} />
            <Route path="/creator" element={<RequireAuth><Creator /></RequireAuth>} />
            <Route path="/play/:gameKey" element={<Play />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/topup" element={<RequireAuth><TopUp /></RequireAuth>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/admin" element={<RequireAdmin><Admin /></RequireAdmin>} />
            <Route
              path="/devcoins"
              element={<RequireAuth><DevCoins /></RequireAuth>}
            />
            <Route path="/game/:id" element={<GameDetail />} />
            <Route path="/autumn-event" element={<AutumnEvent />} />
            <Route path="/autumn" element={<AutumnEvent />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
