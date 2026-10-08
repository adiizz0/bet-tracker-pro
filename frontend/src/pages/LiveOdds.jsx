import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import BetFormDialog from "@/components/BetFormDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Radio, Plus, Clock, Loader2 } from "lucide-react";

export default function LiveOdds() {
  const [sport, setSport] = useState("upcoming");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prefill, setPrefill] = useState(null);

  const { data: sportsResp } = useQuery({
    queryKey: ["odds-sports"],
    queryFn: async () => (await api.get("/odds/sports")).data,
  });

  const { data: oddsResp, isLoading, isFetching } = useQuery({
    queryKey: ["odds", sport],
    queryFn: async () => (await api.get(`/odds/${sport}`)).data,
  });

  const sports = sportsResp?.data || [];
  const games = oddsResp?.data || [];
  const demo = oddsResp?.demo;

  const quickAdd = (game, outcome) => {
    setPrefill({
      sport: game.sport_title || "Egyéb",
      market: "Meccs kimenetel",
      selection: `${game.home_team} – ${game.away_team}: ${outcome.name}`,
      odds: outcome.price,
      bookmaker: game.bookmakers?.[0]?.title || "",
    });
    setDialogOpen(true);
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-4xl sm:text-5xl font-light tracking-tighter text-white">Élő Szorzók</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Élő és közelgő meccsek {demo && <span className="text-[#FFCC00]">· demo adatok</span>}
          </p>
        </div>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger data-testid="odds-sport-select" className="w-64 bg-white/5 border-white/10 text-white rounded-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#0A0A0A] border-white/10 text-white max-h-72">
            <SelectItem value="upcoming">Közelgő / Élő (összes)</SelectItem>
            {sports.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-zinc-500">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : games.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center text-zinc-500">
          <Radio size={32} className="mx-auto mb-3 opacity-40" />
          Nincs elérhető meccs ehhez a sporthoz.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {isFetching && (
            <div className="col-span-full text-xs text-zinc-500 flex items-center gap-2">
              <Loader2 className="animate-spin" size={12} /> Frissítés…
            </div>
          )}
          {games.map((g, idx) => {
            const outcomes = g.bookmakers?.[0]?.markets?.[0]?.outcomes || [];
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.4) }}
                className="glass card-hover rounded-2xl p-5"
                data-testid={`odds-card-${idx}`}
              >
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-3">
                  <Clock size={13} />
                  <span className="font-mono-data">
                    {new Date(g.commence_time).toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {g.bookmakers?.[0]?.title && (
                    <span className="ml-auto px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-zinc-300">
                      {g.bookmakers[0].title}
                    </span>
                  )}
                </div>
                <div className="mb-4">
                  <div className="text-white font-medium">{g.home_team}</div>
                  <div className="text-zinc-500 text-sm">vs</div>
                  <div className="text-white font-medium">{g.away_team}</div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {outcomes.slice(0, 3).map((o, i) => (
                    <button
                      key={i}
                      onClick={() => quickAdd(g, o)}
                      data-testid={`quick-add-${idx}-${i}`}
                      className="group flex flex-col items-center gap-1 py-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-[#00E676]/50 hover:bg-[#00E676]/[0.06] transition-colors"
                    >
                      <span className="text-[10px] text-zinc-500 truncate max-w-full px-1">
                        {o.name === g.home_team ? "1" : o.name === g.away_team ? "2" : o.name === "Döntetlen" ? "X" : o.name}
                      </span>
                      <span className="font-mono-data font-semibold text-white group-hover:text-[#00E676] transition-colors">
                        {Number(o.price).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
                {outcomes.length > 0 && (
                  <Button
                    onClick={() => quickAdd(g, outcomes[0])}
                    variant="ghost"
                    className="w-full mt-3 text-xs text-zinc-400 hover:text-white hover:bg-white/5 rounded-full h-8"
                  >
                    <Plus size={13} className="mr-1" /> Fogadás rögzítése
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <BetFormDialog open={dialogOpen} onOpenChange={setDialogOpen} prefill={prefill} />
    </div>
  );
}
