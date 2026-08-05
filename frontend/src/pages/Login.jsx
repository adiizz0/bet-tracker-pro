import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, formatApiErrorDetail, setAuthToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

const HERO =
  "https://images.unsplash.com/photo-1693648793394-0b76b7eb042e?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzOTB8MHwxfHNlYXJjaHwzfHxkYXJrJTIwYWJzdHJhY3QlMjBwcmVtaXVtJTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3ODU1NzI4MDN8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login" ? { email, password } : { email, password, name };
      const { data } = await api.post(endpoint, payload);
      setAuthToken(data.access_token);
      setUser(data);
      toast.success(mode === "login" ? "Sikeres belépés" : "Fiók létrehozva");
      navigate("/");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={HERO} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/70" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl bg-[#00E676] flex items-center justify-center">
            <TrendingUp size={24} className="text-black" />
          </div>
          <div>
            <div className="font-head text-2xl font-bold text-white tracking-tight">Bet Tracker Pro</div>
            <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">Bankroll & Analitika</div>
          </div>
        </div>

        <div className="glass rounded-3xl p-8">
          <h1 className="font-head text-3xl font-light tracking-tighter text-white mb-1">
            {mode === "login" ? "Üdv újra!" : "Fiók létrehozása"}
          </h1>
          <p className="text-sm text-zinc-400 mb-7">
            {mode === "login"
              ? "Jelentkezz be a bankrollod követéséhez."
              : "Regisztrálj és kezdd el követni a teljesítményed."}
          </p>

          <form onSubmit={submit} className="space-y-5">
            {mode === "register" && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">Név</Label>
                <Input
                  data-testid="register-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Neved"
                  className="mt-1.5 bg-transparent border-0 border-b border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-white text-white"
                />
              </div>
            )}
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Email</Label>
              <Input
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="te@email.com"
                className="mt-1.5 bg-transparent border-0 border-b border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-white text-white"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">Jelszó</Label>
              <Input
                data-testid="login-password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 bg-transparent border-0 border-b border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-white text-white"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              data-testid="login-form-submit-button"
              className="w-full bg-white text-black hover:bg-zinc-200 rounded-full h-11 font-semibold transition-colors active:scale-95"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : mode === "login" ? "Belépés" : "Regisztráció"}
            </Button>
          </form>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Bet Tracker Pro</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <p className="text-center text-sm text-zinc-400 mt-6">
            {mode === "login" ? "Még nincs fiókod?" : "Van már fiókod?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              data-testid="toggle-auth-mode"
              className="text-[#00E676] hover:underline font-medium"
            >
              {mode === "login" ? "Regisztrálj" : "Lépj be"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
