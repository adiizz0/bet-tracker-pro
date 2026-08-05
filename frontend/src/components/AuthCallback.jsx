import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, setAuthToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const hash = location.hash || window.location.hash;
    const sessionId = new URLSearchParams(hash.replace("#", "")).get("session_id");

    const run = async () => {
      try {
        const { data } = await api.post(
          "/auth/google/session",
          {},
          { headers: { "X-Session-ID": sessionId } }
        );
        setAuthToken(data.access_token);
        setUser(data);
        window.history.replaceState(null, "", window.location.pathname);
        navigate("/", { replace: true });
      } catch (e) {
        navigate("/belepes", { replace: true });
      }
    };
    if (sessionId) run();
    else navigate("/belepes", { replace: true });
  }, [location, navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-4 text-white">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-sm text-zinc-400 font-mono-data">Bejelentkezés folyamatban…</p>
      </div>
    </div>
  );
}
