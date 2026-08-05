import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatApiErrorDetail } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SPORTS, MARKETS, RESULTS } from "@/lib/constants";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const empty = {
  sport: "Labdarúgás",
  market: "Meccs kimenetel",
  selection: "",
  stake: "",
  odds: "",
  result: "pending",
  bookmaker: "",
  note: "",
  date: "",
};

export default function BetFormDialog({ open, onOpenChange, editBet, prefill }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (editBet) {
      setForm({
        sport: editBet.sport,
        market: editBet.market,
        selection: editBet.selection || "",
        stake: editBet.stake,
        odds: editBet.odds,
        result: editBet.result,
        bookmaker: editBet.bookmaker || "",
        note: editBet.note || "",
        date: editBet.date ? editBet.date.slice(0, 16) : "",
      });
    } else if (prefill) {
      setForm({ ...empty, ...prefill });
    } else {
      setForm(empty);
    }
  }, [editBet, prefill, open]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const parseDecimal = (v) => Number(String(v ?? "").trim().replace(/\s/g, "").replace(",", "."));

  const mutation = useMutation({
    mutationFn: (data) => {
      const payload = {
        ...data,
        stake: parseDecimal(data.stake),
        odds: parseDecimal(data.odds),
        date: data.date ? new Date(data.date).toISOString() : undefined,
      };
      return editBet ? api.put(`/bets/${editBet.bet_id}`, payload) : api.post("/bets", payload);
    },
    onSuccess: async () => {
      qc.invalidateQueries();
      toast.success(editBet ? "Fogadás frissítve" : "Fogadás rögzítve");
      onOpenChange(false);
      try {
        const { data } = await api.get("/limits/status");
        if (data.daily_exceeded) toast.warning("Túllépted a napi tét-limitedet!");
        else if (data.weekly_exceeded) toast.warning("Túllépted a heti tét-limitedet!");
        else if (data.daily_near) toast.warning(`Közelítesz a napi tét-limitedhez (${data.daily_pct}%)`);
        else if (data.weekly_near) toast.warning(`Közelítesz a heti tét-limitedhez (${data.weekly_pct}%)`);
      } catch (e) {}
    },
    onError: (e) => toast.error(formatApiErrorDetail(e.response?.data?.detail)),
  });

  const submit = (e) => {
    e.preventDefault();
    const stakeNum = parseDecimal(form.stake);
    const oddsNum = parseDecimal(form.odds);
    if (!form.stake || !form.odds || !Number.isFinite(stakeNum) || !Number.isFinite(oddsNum)) {
      toast.error("Adj meg érvényes tétet és oddsot (pl. 1000 és 1.55)");
      return;
    }
    if (stakeNum <= 0 || oddsNum < 1) {
      toast.error("A tét legyen 0-nál nagyobb, az odds legalább 1.00");
      return;
    }
    mutation.mutate(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-head text-2xl font-light tracking-tight">
            {editBet ? "Fogadás szerkesztése" : "Új fogadás"}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm">
            Add meg a fogadás részleteit. A profit automatikusan számolódik az eredmény alapján.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-zinc-500">Sport</Label>
              <Select value={form.sport} onValueChange={(v) => set("sport", v)}>
                <SelectTrigger data-testid="bet-sport-select" className="mt-1.5 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0A0A0A] border-white/10 text-white">
                  {SPORTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Piac</Label>
              <Select value={form.market} onValueChange={(v) => set("market", v)}>
                <SelectTrigger className="mt-1.5 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0A0A0A] border-white/10 text-white">
                  {MARKETS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs text-zinc-500">Tipp / esemény</Label>
            <Input
              data-testid="bet-selection-input"
              value={form.selection}
              onChange={(e) => set("selection", e.target.value)}
              placeholder="pl. Arsenal – Chelsea, Hazai győzelem"
              className="mt-1.5 bg-white/5 border-white/10 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-zinc-500">Tét</Label>
              <Input
                data-testid="bet-stake-input"
                type="text"
                inputMode="decimal"
                value={form.stake}
                onChange={(e) => set("stake", e.target.value)}
                placeholder="1000"
                className="mt-1.5 bg-white/5 border-white/10 text-white font-mono-data"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Odds</Label>
              <Input
                data-testid="bet-odds-input"
                type="text"
                inputMode="decimal"
                value={form.odds}
                onChange={(e) => set("odds", e.target.value)}
                placeholder="1.95 vagy 1,95"
                className="mt-1.5 bg-white/5 border-white/10 text-white font-mono-data"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-zinc-500">Eredmény</Label>
              <Select value={form.result} onValueChange={(v) => set("result", v)}>
                <SelectTrigger data-testid="bet-result-select" className="mt-1.5 bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0A0A0A] border-white/10 text-white">
                  {RESULTS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-zinc-500">Fogadóiroda</Label>
              <Input
                value={form.bookmaker}
                onChange={(e) => set("bookmaker", e.target.value)}
                placeholder="pl. Bet365"
                className="mt-1.5 bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-zinc-500">Dátum</Label>
            <Input
              type="datetime-local"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className="mt-1.5 bg-white/5 border-white/10 text-white font-mono-data"
            />
          </div>

          <div>
            <Label className="text-xs text-zinc-500">Jegyzet</Label>
            <Textarea
              value={form.note}
              onChange={(e) => set("note", e.target.value)}
              placeholder="Opcionális jegyzet…"
              className="mt-1.5 bg-white/5 border-white/10 text-white resize-none"
              rows={2}
            />
          </div>

          <Button
            type="submit"
            disabled={mutation.isPending}
            data-testid="bet-form-submit-button"
            className="w-full bg-[#00E676] text-black hover:bg-[#00c765] rounded-full h-11 font-semibold active:scale-95 transition-colors"
          >
            {mutation.isPending ? <Loader2 className="animate-spin" size={18} /> : editBet ? "Mentés" : "Rögzítés"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
