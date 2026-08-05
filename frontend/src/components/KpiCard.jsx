import React from "react";
import { motion } from "framer-motion";
import { fmtMoney, fmtPct } from "@/lib/api";

export function KpiCard({ label, value, sub, tone = "neutral", icon: Icon, delay = 0, mono = true, testId }) {
  const toneColor =
    tone === "profit" ? "#00E676" : tone === "loss" ? "#FF3B30" : "#FFFFFF";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="glass card-hover rounded-2xl p-6 relative overflow-hidden"
      data-testid={testId}
    >
      {tone !== "neutral" && (
        <div
          className="absolute -top-16 -right-16 w-40 h-40 rounded-full blur-3xl opacity-20"
          style={{ background: toneColor }}
        />
      )}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-400">
          {label}
        </span>
        {Icon && <Icon size={18} className="text-zinc-500" />}
      </div>
      <div
        className={`text-3xl lg:text-4xl font-bold tracking-tighter relative z-10 ${mono ? "font-mono-data" : "font-head"}`}
        style={{ color: toneColor }}
      >
        {value}
      </div>
      {sub && <div className="mt-2 text-sm text-zinc-500 relative z-10 font-mono-data">{sub}</div>}
    </motion.div>
  );
}

export { fmtMoney, fmtPct };
