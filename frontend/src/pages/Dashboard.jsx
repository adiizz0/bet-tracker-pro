import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { KpiCard, fmtMoney, fmtPct } from "@/components/KpiCard";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Wallet,
  TrendingUp,
  Percent,
  Target,
  Trophy,
  AlertTriangle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

function ChartTooltip({ active, payload, currency }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-xs">
      <div className="text-zinc-400 mb-1 font-mono-data">
        {new Date(payload[0].payload.date).toLocaleDateString("hu-HU")}
      </div>
      <div className="text-white font-mono-data font-semibold">
        {fmtMoney(payload[0].value, currency)}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { data: a, isLoading } = useQuery({
    queryKey: ["analytics"],
    queryFn: async () => (await api.get("/analytics")).data,
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });
  const { data: limits } = useQuery({
    queryKey: ["limits"],
    queryFn: async () => (await api.get("/limits/status")).data,
  });

  if (isLoading || !a) {
    return <div className="text-zinc-500">Betöltés…</div>;
  }

  const k = a.kpis;
  const currency = a.currency;
  const positive = k.total_profit >= 0;
  const profitGoal = settings?.profit_goal || 0;
  const goalPct = profitGoal > 0 ? Math.min(100, (k.total_profit / profitGoal) * 100) : 0;
  const green = "#00E676";
  const red = "#FF3B30";
  const lineColor = positive ? green : red;

  const curveData = a.bankroll_curve.length
    ? a.bankroll_curve
    : [{ date: new Date().toISOString(), bankroll: k.starting_bankroll }];

  return (
    <div>
      <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="font-head text-4xl sm:text-5xl font-light tracking-tighter text-white">Vezérlőpult</h1>
          <p className="text-sm text-zinc-500 mt-1">Valós idejű bankroll áttekintés</p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Aktuális bankroll</div>
          <div className="font-head text-3xl font-bold tracking-tighter text-white font-mono-data">
            {fmtMoney(k.current_bankroll, currency)}
          </div>
        </div>
      </div>

      {limits && (limits.daily_exceeded || limits.weekly_exceeded || limits.daily_near || limits.weekly_near) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          data-testid="limit-warning"
          className={`glass rounded-xl p-4 mb-6 flex items-center gap-3 ${
            limits.daily_exceeded || limits.weekly_exceeded ? "border-[#FF3B30]/40" : "border-[#FFCC00]/40"
          }`}
        >
          <AlertTriangle
            className={`shrink-0 ${limits.daily_exceeded || limits.weekly_exceeded ? "text-loss" : "text-[#FFCC00]"}`}
            size={20}
          />
          <span className={`text-sm ${limits.daily_exceeded || limits.weekly_exceeded ? "text-loss" : "text-[#FFCC00]"}`}>
            {limits.daily_exceeded
              ? "Túllépted a napi tét-limitedet. Fogadj felelősséggel!"
              : limits.weekly_exceeded
              ? "Túllépted a heti tét-limitedet. Fogadj felelősséggel!"
              : limits.daily_near
              ? `Közelítesz a napi tét-limitedhez (${limits.daily_pct}%). Vigyázz a tétekkel!`
              : `Közelítesz a heti tét-limitedhez (${limits.weekly_pct}%).`}
          </span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <KpiCard
          label="Profit / Veszteség"
          value={fmtMoney(k.total_profit, currency)}
          tone={positive ? "profit" : "loss"}
          icon={TrendingUp}
          sub={`${k.settled_bets} lezárt fogadás`}
          delay={0}
          testId="dashboard-profit-value"
        />
        <KpiCard
          label="ROI"
          value={fmtPct(k.roi)}
          tone={k.roi >= 0 ? "profit" : "loss"}
          icon={Percent}
          sub={`${fmtMoney(k.total_staked, currency)} megtéve`}
          delay={0.1}
          testId="dashboard-roi-value"
        />
        <KpiCard
          label="Találati arány"
          value={`${k.win_rate.toFixed(1)}%`}
          icon={Target}
          sub={`Átlag odds ${k.avg_odds.toFixed(2)}`}
          delay={0.2}
          testId="dashboard-winrate-value"
        />
        <KpiCard
          label="Nyerő sorozat"
          value={`${k.best_win_streak}`}
          tone="profit"
          icon={Trophy}
          sub={`Vesztő sorozat: ${k.best_lose_streak}`}
          delay={0.3}
          testId="dashboard-streak-value"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6 lg:col-span-2"
          data-testid="bankroll-chart-container"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Wallet size={18} className="text-zinc-400" />
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Bankroll görbe</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={curveData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="bankrollFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#52525B", fontSize: 11, fontFamily: "JetBrains Mono" }}
                tickFormatter={(d) => new Date(d).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "#52525B", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
                width={70}
                tickFormatter={(v) => new Intl.NumberFormat("hu-HU", { notation: "compact" }).format(v)}
              />
              <Tooltip content={<ChartTooltip currency={currency} />} />
              <Area
                type="monotone"
                dataKey="bankroll"
                stroke={lineColor}
                strokeWidth={2.5}
                fill="url(#bankrollFill)"
                dot={false}
                activeDot={{ r: 4, fill: lineColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-6 flex flex-col"
        >
          <div className="flex items-center gap-2 mb-6">
            <Target size={18} className="text-zinc-400" />
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Profit cél</span>
          </div>
          {profitGoal > 0 ? (
            <>
              <div className="font-head text-4xl font-bold tracking-tighter font-mono-data text-white mb-1">
                {goalPct.toFixed(0)}%
              </div>
              <div className="text-sm text-zinc-500 mb-5 font-mono-data">
                {fmtMoney(k.total_profit, currency)} / {fmtMoney(profitGoal, currency)}
              </div>
              <Progress value={Math.max(0, goalPct)} className="h-2 bg-white/10" />
            </>
          ) : (
            <p className="text-sm text-zinc-500">Állíts be profit célt a Beállításokban.</p>
          )}

          <div className="mt-auto pt-6 space-y-3">
            {limits && (limits.daily_limit > 0 || limits.weekly_limit > 0) && (
              <div className="space-y-3 pb-4 mb-1 border-b border-white/[0.06]">
                {limits.daily_limit > 0 && (
                  <div data-testid="daily-limit-bar">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-zinc-500">Napi tét-limit</span>
                      <span className="font-mono-data text-zinc-300">
                        {fmtMoney(limits.daily_staked, currency)} / {fmtMoney(limits.daily_limit, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, limits.daily_pct)}%`,
                          background: limits.daily_exceeded ? "#FF3B30" : limits.daily_near ? "#FFCC00" : "#00E676",
                        }}
                      />
                    </div>
                  </div>
                )}
                {limits.weekly_limit > 0 && (
                  <div data-testid="weekly-limit-bar">
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-zinc-500">Heti tét-limit</span>
                      <span className="font-mono-data text-zinc-300">
                        {fmtMoney(limits.weekly_staked, currency)} / {fmtMoney(limits.weekly_limit, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, limits.weekly_pct)}%`,
                          background: limits.weekly_exceeded ? "#FF3B30" : limits.weekly_near ? "#FFCC00" : "#00E676",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Yield</span>
              <span className="font-mono-data text-white">{fmtPct(k.yield)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Függő fogadások</span>
              <span className="font-mono-data text-white">{k.pending_bets}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-zinc-500">Összes fogadás</span>
              <span className="font-mono-data text-white">{k.total_bets}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
