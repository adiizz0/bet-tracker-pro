import React from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function LanguageSelector({ className = "" }) {
  const { language, setLanguage, t } = useLanguage();

  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{t("language")}</span>
      <select
        data-testid="language-selector"
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-sm text-white outline-none focus:border-[#00E676]"
      >
        <option value="hu">{t("hungarian")}</option>
        <option value="en">{t("english")}</option>
      </select>
    </label>
  );
}
