import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { RequireAuth } from "@/components/RequireAuth";
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
import GameDetail from "./pages/GameDetail";
import NotFound from "./pages/NotFound";
import Studio from "./pages/Studio";

const queryClient = new QueryClient();

/**
 * Landing (nexconsole) or the editor (nexstudio) depending on the hostname.
 * The same build serves both domains; nexstudio.vercel.app lands in the studio.
 */
const RootRoute = () => {
  if (typeof window !== "undefined" && window.location.hostname.startsWith("nexstudio.")) {
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
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/studio" element={<Studio />} />
            <Route path="/library" element={<Library />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/create" element={<Create />} />
            <Route path="/creator" element={<RequireAuth><Creator /></RequireAuth>} />
            <Route path="/play/:gameKey" element={<Play />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/topup" element={<RequireAuth><TopUp /></RequireAuth>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/game/:id" element={<GameDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
