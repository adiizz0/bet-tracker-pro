import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api, formatApiErrorDetail, setAuthToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import LanguageSelector from "@/components/LanguageSelector";
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
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { setUser } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    // Ask backend whether Google OAuth is configured; hide the button if not.
    api.get("/auth/google/config")
      .then((r) => setGoogleAvailable(Boolean(r.data?.enabled)))
      .catch(() => setGoogleAvailable(false));

    // Surface any redirect-error from a failed Google flow
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) {
      const map = {
        google_disabled: t("googleDisabled"),
        invalid_state: t("invalidGoogleState"),
        google_token: t("googleTokenExchangeFailed"),
        google_userinfo: t("googleUserInfoFailed"),
        google_network: t("googleNetworkError"),
        google_no_email: t("googleNoEmail"),
      };
      toast.error(map[err] || t("loginError").replace("{error}", err));
      // Remove the error param so it doesn't reshow on refresh
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [t]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login" ? { email, password } : { email, password, name };
      const { data } = await api.post(endpoint, payload);
      setAuthToken(data.access_token);
      setUser(data);
      toast.success(mode === "login" ? t("loginSuccess") : t("accountCreated"));
      navigate("/");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  const googleLogin = async () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    setGoogleLoading(true);
    try {
      const { data } = await api.get("/auth/google/login");
      if (data?.url) window.location.href = data.url;
      else throw new Error(t("googleAuthUrlMissing"));
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || t("googleLoginStartFailed"));
      setGoogleLoading(false);
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
            <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-400">{t("brandSubtitle")}</div>
          </div>
        </div>

        <div className="glass rounded-3xl p-8">
          <div className="flex justify-end mb-4">
            <LanguageSelector />
          </div>
          <h1 className="font-head text-3xl font-light tracking-tighter text-white mb-1">
            {mode === "login" ? t("welcomeBack") : t("createAccount")}
          </h1>
          <p className="text-sm text-zinc-400 mb-7">
            {mode === "login" ? t("loginSubtitle") : t("registerSubtitle")}
          </p>

          <form onSubmit={submit} className="space-y-5">
            {mode === "register" && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-zinc-500">{t("name")}</Label>
                <Input
                  data-testid="register-name-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("name")}
                  className="mt-1.5 bg-transparent border-0 border-b border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-white text-white"
                />
              </div>
            )}
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">{t("email")}</Label>
              <Input
                data-testid="login-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="mt-1.5 bg-transparent border-0 border-b border-white/20 rounded-none px-0 focus-visible:ring-0 focus-visible:border-white text-white"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-500">{t("password")}</Label>
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
              {loading ? <Loader2 className="animate-spin" size={18} /> : mode === "login" ? t("login") : t("register")}
            </Button>
          </form>

          {googleAvailable && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-zinc-500 uppercase tracking-wider">{t("or")}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <Button
                type="button"
                onClick={googleLogin}
                disabled={googleLoading}
                data-testid="google-login-button"
                variant="outline"
                className="w-full bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-full h-11 transition-colors"
              >
                {googleLoading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <img src="https://www.google.com/favicon.ico" alt="" className="w-4 h-4 mr-2" />
                    {t("googleLogin")}
                  </>
                )}
              </Button>
            </>
          )}

          <p className="text-center text-sm text-zinc-400 mt-6">
            {mode === "login" ? t("noAccount") : t("haveAccount")}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              data-testid="toggle-auth-mode"
              className="text-[#00E676] hover:underline font-medium"
            >
              {mode === "login" ? t("registerAction") : t("loginAction")}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
