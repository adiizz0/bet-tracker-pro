import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/constants";
import { Wallet, Target, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

const BG =
  "https://images.unsplash.com/photo-1509928015542-fcc9b3bcd048?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDF8MHwxfHNlYXJjaHwxfHxkYXJrJTIwc3BvcnRzJTIwc3RhZGl1bSUyMGxpZ2h0c3xlbnwwfHx8fDE3ODU1NzI4MDN8MA&ixlib=rb-4.1.0&q=85";

export default function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [form, setForm] = useState({
    starting_bankroll: 100000,
    currency: "HUF",
    unit_size: 1000,
    profit_goal: 50000,
    daily_limit: 10000,
    weekly_limit: 50000,
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (data) => api.put("/settings", { ...data, onboarded: true }),
    onSuccess: (res) => {
      qc.setQueryData(["settings"], res.data);
      toast.success(t("settingsSaved"));
      navigate("/");
    },
    onError: () => toast.error(t("saveFailed")),
  });

  const submit = (e) => {
    e.preventDefault();
    const numeric = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, k === "currency" ? v : Number(v)])
    );
    mutation.mutate(numeric);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={BG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-lg"
      >
        <div className="mb-6 text-center">
          <h1 className="font-head text-4xl font-light tracking-tighter text-white">{t("setCapital")}</h1>
          <p className="text-sm text-zinc-400 mt-2">{t("setupSubtitle")}</p>
        </div>

        <form onSubmit={submit} className="glass rounded-3xl p-8 space-y-6">
          <div className="flex items-center gap-2 text-zinc-300">
            <Wallet size={18} className="text-[#00E676]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">{t("capital")}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-zinc-500">{t("startBankroll")}</Label>
              <Input
                data-testid="onboarding-bankroll-input"
                type="number"
                value={form.starting_bankroll}
                onChange={(e) => set("starting_bankroll", e.target.value)}
                className="mt-1.5 bg-white/5 border-white/10 text-white font-mono-data"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">{t("currencyLabel")}</Label>
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger data-testid="onboarding-currency-select" className="mt-1.5 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0A0A0A] border-white/10 text-white">
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-500">{t("unitSize")}</Label>
              <Input
                type="number"
                value={form.unit_size}
                onChange={(e) => set("unit_size", e.target.value)}
                className="mt-1.5 bg-white/5 border-white/10 text-white font-mono-data"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 text-zinc-300 pt-2">
            <Target size={18} className="text-[#00E676]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">{t("profitGoal")}</span>
          </div>
          <div>
            <Label className="text-xs text-zinc-500">{t("profitGoal")}</Label>
            <Input
              type="number"
              value={form.profit_goal}
              onChange={(e) => set("profit_goal", e.target.value)}
              className="mt-1.5 bg-white/5 border-white/10 text-white font-mono-data"
            />
          </div>

          <div className="flex items-center gap-2 text-zinc-300 pt-2">
            <ShieldAlert size={18} className="text-[#FFCC00]" />
            <span className="text-xs font-bold uppercase tracking-[0.2em]">{t("responsibleGambling")}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-zinc-500">{t("dailyLimit")}</Label>
              <Input
                type="number"
                value={form.daily_limit}
                onChange={(e) => set("daily_limit", e.target.value)}
                className="mt-1.5 bg-white/5 border-white/10 text-white font-mono-data"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">{t("weeklyLimit")}</Label>
              <Input
                type="number"
                value={form.weekly_limit}
                onChange={(e) => set("weekly_limit", e.target.value)}
                className="mt-1.5 bg-white/5 border-white/10 text-white font-mono-data"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={mutation.isPending}
            data-testid="onboarding-submit-button"
            className="w-full bg-white text-black hover:bg-zinc-200 rounded-full h-11 font-semibold active:scale-95 transition-colors"
          >
            {mutation.isPending ? <Loader2 className="animate-spin" size={18} /> : t("startNow")}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
