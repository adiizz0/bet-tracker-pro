import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api, fmtMoney, fmtPct } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
  PieChart, Pie,
} from "recharts";
import { BarChart3, PieChart as PieIcon, CalendarRange, Activity } from "lucide-react";

const COLORS = ["#00E676", "#0A84FF", "#FFCC00", "#FF3B30", "#A78BFA", "#34D399", "#F472B6"];

const PERIODS = [
  { value: "all", label: "Teljes időszak" },
  { value: "7", label: "Utolsó 7 nap" },
  { value: "30", label: "Utolsó 30 nap" },
  { value: "90", label: "Utolsó 90 nap" },
  { value: "month", label: "Aktuális hónap" },
  { value: "year", label: "Aktuális év" },
  { value: "custom", label: "Egyéni tartomány" },
];

function computeRange(period, customStart, customEnd) {
  const now = new Date();
  if (period === "all") return {};
  if (period === "custom") {
    return {
      start_date: customStart ? new Date(customStart).toISOString() : undefined,
      end_date: customEnd ? new Date(customEnd + "T23:59:59").toISOString() : undefined,
    };
  }
  let start;
  if (period === "month") start = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === "year") start = new Date(now.getFullYear(), 0, 1);
  else start = new Date(now.getTime() - Number(period) * 24 * 60 * 60 * 1000);
  return { start_date: start.toISOString() };
}

function Section({ title, icon: Icon, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass rounded-2xl p-6"
    >
      <div className="flex items-center gap-2 mb-6">
        <Icon size={18} className="text-zinc-400" />
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">{title}</span>
      </div>
      {children}
    </motion.div>
  );
}

export default function Analytics() {
  const [period, setPeriod] = useState("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const range = useMemo(() => computeRange(period, customStart, customEnd), [period, customStart, customEnd]);

  const { data: a, isLoading, isFetching } = useQuery({
    queryKey: ["analytics", range],
    queryFn: async () => (await api.get("/analytics", { params: range })).data,
    keepPreviousData: true,
  });

  if ((isLoading && !a) || !a) return <div className="text-zinc-500">Betöltés…</div>;
  const currency = a.currency;
  const k = a.kpis;

  return (
    <div>
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-4xl sm:text-5xl font-light tracking-tighter text-white">Elemzés</h1>
          <p className="text-sm text-zinc-500 mt-1">Részletes teljesítmény bontások</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarRange size={16} className="text-zinc-500" />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger data-testid="analytics-period-select" className="w-52 bg-white/5 border-white/10 text-white rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#0A0A0A] border-white/10 text-white">
              {PERIODS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {period === "custom" && (
            <>
              <Input
                data-testid="analytics-start-date"
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-40 bg-white/5 border-white/10 text-white rounded-full font-mono-data"
              />
              <span className="text-zinc-500">–</span>
              <Input
                data-testid="analytics-end-date"
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-40 bg-white/5 border-white/10 text-white rounded-full font-mono-data"
              />
            </>
          )}
          {isFetching && <span className="text-xs text-zinc-500">frissítés…</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { l: "Megtett tét", v: fmtMoney(k.total_staked, currency) },
          { l: "Nettó profit", v: fmtMoney(k.total_profit, currency), tone: k.total_profit >= 0 },
          { l: "ROI", v: fmtPct(k.roi), tone: k.roi >= 0 },
          { l: "Átlag odds", v: k.avg_odds.toFixed(2) },
        ].map((s, i) => (
          <div key={i} className="glass rounded-xl p-5">
            <div className="text-xs uppercase tracking-wider text-zinc-500 mb-2">{s.l}</div>
            <div
              className="font-head text-2xl font-bold tracking-tighter font-mono-data"
              style={{ color: s.tone === undefined ? "#fff" : s.tone ? "#00E676" : "#FF3B30" }}
            >
              {s.v}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Profit sportonként" icon={BarChart3} delay={0.1}>          {a.by_sport.length === 0 ? (
            <p className="text-sm text-zinc-500 py-12 text-center">Nincs elég adat.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={a.by_sport} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#52525B", fontSize: 11, fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} tickFormatter={(v) => new Intl.NumberFormat("hu-HU", { notation: "compact" }).format(v)} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#A1A1AA", fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  contentStyle={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [fmtMoney(v, currency), "Profit"]}
                />
                <Bar dataKey="profit" radius={[0, 6, 6, 0]}>
                  {a.by_sport.map((e, i) => (
                    <Cell key={i} fill={e.profit >= 0 ? "#00E676" : "#FF3B30"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Tét megoszlás piaconként" icon={PieIcon} delay={0.2}>
          {a.by_market.length === 0 ? (
            <p className="text-sm text-zinc-500 py-12 text-center">Nincs elég adat.</p>
          ) : (
            <div className="flex items-center gap-6 flex-wrap">
              <ResponsiveContainer width={200} height={200}>
                <PieChart>
                  <Pie data={a.by_market} dataKey="staked" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {a.by_market.map((e, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => fmtMoney(v, currency)}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1 min-w-[140px]">
                {a.by_market.map((e, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-zinc-300">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      {e.name}
                    </span>
                    <span className="font-mono-data text-zinc-400">{e.count} db</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass rounded-2xl p-6 mt-6"
        data-testid="profit-timeline-chart"
      >
        <div className="flex items-center gap-2 mb-6">
          <Activity size={18} className="text-zinc-400" />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">Profit / Veszteség idővonal</span>
        </div>
        {(!a.profit_timeline || a.profit_timeline.length === 0) ? (
          <p className="text-sm text-zinc-500 py-12 text-center">Nincs lezárt fogadás ebben az időszakban.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={a.profit_timeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#52525B", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
                minTickGap={30}
                tickFormatter={(d) => new Date(d).toLocaleDateString("hu-HU", { month: "short", day: "numeric" })}
              />
              <YAxis
                tick={{ fill: "#52525B", fontSize: 11, fontFamily: "JetBrains Mono" }}
                axisLine={false}
                tickLine={false}
                width={70}
                tickFormatter={(v) => new Intl.NumberFormat("hu-HU", { notation: "compact" }).format(v)}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
                contentStyle={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => new Date(d).toLocaleDateString("hu-HU")}
                formatter={(v) => [fmtMoney(v, currency), "Profit"]}
              />
              <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                {a.profit_timeline.map((e, i) => (
                  <Cell key={i} fill={e.profit >= 0 ? "#00E676" : "#FF3B30"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <div className="glass rounded-2xl p-6 mt-6">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400 mb-5">Sportonkénti bontás</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs uppercase tracking-wider border-b border-white/[0.06]">
                <th className="text-left py-3 font-medium">Sport</th>
                <th className="text-right py-3 font-medium">Fogadások</th>
                <th className="text-right py-3 font-medium">Megtett tét</th>
                <th className="text-right py-3 font-medium">Profit</th>
                <th className="text-right py-3 font-medium">ROI</th>
              </tr>
            </thead>
            <tbody>
              {a.by_sport.map((e, i) => (
                <tr key={i} className="border-b border-white/[0.04]">
                  <td className="py-3 text-white">{e.name}</td>
                  <td className="py-3 text-right font-mono-data text-zinc-400">{e.count}</td>
                  <td className="py-3 text-right font-mono-data text-zinc-400">{fmtMoney(e.staked, currency)}</td>
                  <td className={`py-3 text-right font-mono-data font-semibold ${e.profit >= 0 ? "text-profit" : "text-loss"}`}>
                    {e.profit > 0 ? "+" : ""}{fmtMoney(e.profit, currency)}
                  </td>
                  <td className={`py-3 text-right font-mono-data ${e.roi >= 0 ? "text-profit" : "text-loss"}`}>{fmtPct(e.roi)}</td>
                </tr>
              ))}
              {a.by_sport.length === 0 && (
                <tr><td colSpan={5} className="py-10 text-center text-zinc-500">Nincs lezárt fogadás.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
