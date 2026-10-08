import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api, setAuthToken } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Handles the redirect back from Google OAuth (backend redirects to /?google_token=<jwt>).
 * Extracts the token, stores it in localStorage, cleans the URL, and refreshes
 * the auth context by calling /auth/me.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("google_token");
    if (!token) {
      navigate("/belepes", { replace: true });
      return;
    }
    setAuthToken(token);
    // Immediately clean URL so refresh doesn't retry
    window.history.replaceState(null, "", window.location.pathname);

    api.get("/auth/me")
      .then(({ data }) => {
        setUser(data);
        toast.success("Sikeres belépés Google-lel");
        navigate("/", { replace: true });
      })
      .catch(() => {
        toast.error("Bejelentkezés sikertelen");
        navigate("/belepes", { replace: true });
      });
  }, [navigate, setUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505]">
      <div className="flex flex-col items-center gap-4 text-white">
        <Loader2 className="animate-spin" size={32} />
        <p className="text-sm text-zinc-400 font-mono-data">Bejelentkezés folyamatban…</p>
      </div>
    </div>
  );
}
