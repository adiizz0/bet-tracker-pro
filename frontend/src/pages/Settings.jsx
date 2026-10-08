import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { CURRENCIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Target, ShieldAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";

function Card({ title, icon: Icon, iconColor, children, delay }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <Icon size={18} style={{ color: iconColor }} />
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">{title}</span>
      </div>
      {children}
    </motion.div>
  );
}

export default function Settings() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });
  const [form, setForm] = useState(null);
  const fields = [
    { key: "starting_bankroll", label: t("startBankroll"), card: "bankroll" },
    { key: "unit_size", label: t("unitSize"), card: "bankroll" },
    { key: "profit_goal", label: t("profitGoal"), card: "goal" },
    { key: "daily_limit", label: t("dailyLimit"), card: "limit" },
    { key: "weekly_limit", label: t("weeklyLimit"), card: "limit" },
  ];

  useEffect(() => {
    if (settings && !form) setForm(settings);
  }, [settings, form]);

  const mutation = useMutation({
    mutationFn: (data) => api.put("/settings", data),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t("settingsSaved"));
    },
    onError: () => toast.error(t("saveFailed")),
  });

  if (!form) return <div className="text-zinc-500">{t("loading")}</div>;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    const payload = {
      starting_bankroll: Number(form.starting_bankroll),
      unit_size: Number(form.unit_size),
      profit_goal: Number(form.profit_goal),
      daily_limit: Number(form.daily_limit),
      weekly_limit: Number(form.weekly_limit),
      currency: form.currency,
    };
    mutation.mutate(payload);
  };

  const renderField = (f) => (
    <div key={f.key}>
      <Label className="text-xs text-zinc-500">{f.label}</Label>
      <Input
        data-testid={`settings-${f.key}`}
        type="number"
        value={form[f.key] ?? 0}
        onChange={(e) => set(f.key, e.target.value)}
        className="mt-1.5 bg-white/5 border-white/10 text-white font-mono-data"
      />
    </div>
  );

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="font-head text-4xl sm:text-5xl font-light tracking-tighter text-white">{t("settings")}</h1>
        <p className="text-sm text-zinc-500 mt-1">{t("settingsSubtitle")}</p>
      </div>

      <div className="space-y-6">
        <Card title={t("capital")} icon={Wallet} iconColor="#00E676" delay={0}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {fields.filter((f) => f.card === "bankroll").map(renderField)}
            <div>
              <Label className="text-xs text-zinc-500">{t("currencyLabel")}</Label>
              <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                <SelectTrigger data-testid="settings-currency" className="mt-1.5 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0A0A0A] border-white/10 text-white">
                  {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card title={t("profitGoalCard")} icon={Target} iconColor="#00E676" delay={0.1}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.filter((f) => f.card === "goal").map(renderField)}
          </div>
        </Card>

        <Card title={t("responsibleGambling")} icon={ShieldAlert} iconColor="#FFCC00" delay={0.2}>
          <p className="text-sm text-zinc-500 mb-4">
            {t("responsibleDescription")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fields.filter((f) => f.card === "limit").map(renderField)}
          </div>
        </Card>

        <Button
          onClick={save}
          disabled={mutation.isPending}
          data-testid="settings-save-button"
          className="bg-white text-black hover:bg-zinc-200 rounded-full h-11 px-8 font-semibold active:scale-95 transition-colors"
        >
          {mutation.isPending ? <Loader2 className="animate-spin" size={18} /> : t("save")}
        </Button>
      </div>
    </div>
  );
}
