import React, { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, API, fmtMoney } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { RESULT_MAP, RESULTS, SPORTS } from "@/lib/constants";
import BetFormDialog from "@/components/BetFormDialog";
import ReportsDialog from "@/components/ReportsDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Download, Cloud, Upload, TrendingUp, TrendingDown } from "lucide-react";
import { formatApiErrorDetail } from "@/lib/api";
import { toast } from "sonner";

function fmtOdds(v, locale) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 });
}

function ResultBadge({ result, t }) {
  const r = RESULT_MAP[result] || RESULT_MAP.pending;
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
      <span style={{ color: r.color }}>{t(r.label)}</span>
    </span>
  );
}

export default function Bets() {
  const qc = useQueryClient();
  const { t, locale, language } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [editBet, setEditBet] = useState(null);
  const csvInputRef = useRef(null);
  const [deleteBet, setDeleteBet] = useState(null);
  const [search, setSearch] = useState("");
  const [sportFilter, setSportFilter] = useState("all");
  const [resultFilter, setResultFilter] = useState("all");

  const { data: bets = [], isLoading } = useQuery({
    queryKey: ["bets"],
    queryFn: async () => (await api.get("/bets")).data,
  });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: async () => (await api.get("/settings")).data,
  });
  const currency = settings?.currency || "HUF";

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/bets/${id}`),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t("betDeleted"));
      setDeleteBet(null);
    },
  });

  const filtered = useMemo(() => {
    return bets.filter((b) => {
      if (sportFilter !== "all" && b.sport !== sportFilter) return false;
      if (resultFilter !== "all" && b.result !== resultFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          (b.selection || "").toLowerCase().includes(q) ||
          (b.bookmaker || "").toLowerCase().includes(q) ||
          (b.market || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bets, sportFilter, resultFilter, search]);

  // Running bankroll after each bet (chronological cumulative)
  const runningMap = useMemo(() => {
    const start = Number(settings?.starting_bankroll || 0);
    const chrono = [...bets].sort((a, b) => new Date(a.date) - new Date(b.date));
    let bal = start;
    const map = {};
    for (const b of chrono) {
      bal += Number(b.profit || 0);
      map[b.bet_id] = bal;
    }
    return map;
  }, [bets, settings?.starting_bankroll]);

  const exportCsv = () => {
    window.open(`${API}/export/csv`, "_blank");
  };

  const exportPdf = async () => {
    const { default: jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Bet Tracker Pro - ${t("bets")}`, 14, 18);
    autoTable(doc, {
      startY: 24,
      head: [[t("date"), t("sport"), t("pick"), t("stake"), t("odds"), t("result"), t("profit")]],
      body: filtered.map((b) => [
        new Date(b.date).toLocaleDateString(locale),
        t(b.sport),
        b.selection || "-",
        b.stake,
        b.odds,
        t((RESULT_MAP[b.result] || {}).label || b.result),
        b.profit,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [0, 230, 118] },
    });
    doc.save(language === "en" ? "bets.pdf" : "fogadasok.pdf");
    toast.success(t("pdfDownloaded"));
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/bets/import", fd);
      qc.invalidateQueries();
      const importedMessage = t("importedBets").replace("{count}", data.imported);
      const skippedMessage = data.errors
        ? `, ${t("importSkippedRows").replace("{count}", data.errors)}`
        : "";
      toast.success(`${importedMessage}${skippedMessage}`);
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || t("importFailed"));
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-head text-4xl sm:text-5xl font-light tracking-tighter text-white">{t("bets")}</h1>
          <p className="text-sm text-zinc-500 mt-1">{t("totalRecorded").replace("{count}", bets.length)}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={exportCsv}
            data-testid="export-csv-button"
            variant="outline"
            className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <Download size={16} className="mr-2" /> CSV
          </Button>
          <Button
            onClick={exportPdf}
            data-testid="export-pdf-button"
            variant="outline"
            className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <Download size={16} className="mr-2" /> PDF
          </Button>
          <Button
            onClick={() => setReportsOpen(true)}
            data-testid="cloud-reports-button"
            variant="outline"
            className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <Cloud size={16} className="mr-2" /> {t("reports")}
          </Button>
          <Button
            onClick={() => csvInputRef.current?.click()}
            data-testid="import-csv-button"
            variant="outline"
            className="bg-white/5 border-white/10 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <Upload size={16} className="mr-2" /> {t("import")}
          </Button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" onChange={handleCsvImport} className="hidden" data-testid="csv-file-input" />
          <Button
            onClick={() => { setEditBet(null); setDialogOpen(true); }}
            data-testid="bet-log-add-button"
            className="bg-[#00E676] text-black hover:bg-[#00c765] rounded-full font-semibold active:scale-95 transition-colors"
          >
            <Plus size={18} className="mr-1.5" /> {t("newBet")}
          </Button>
        </div>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <Input
            data-testid="bets-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchHint")}
            className="pl-9 bg-white/5 border-white/10 text-white rounded-full"
          />
        </div>
        <Select value={sportFilter} onValueChange={setSportFilter}>
          <SelectTrigger data-testid="bets-sport-filter" className="w-44 bg-white/5 border-white/10 text-white rounded-full">
            <SelectValue placeholder={t("sportMarket")} />
          </SelectTrigger>
          <SelectContent className="bg-[#0A0A0A] border-white/10 text-white">
            <SelectItem value="all">{t("allSports")}</SelectItem>
            {SPORTS.map((s) => <SelectItem key={s} value={s}>{t(s)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="w-44 bg-white/5 border-white/10 text-white rounded-full">
            <SelectValue placeholder={t("result")} />
          </SelectTrigger>
          <SelectContent className="bg-[#0A0A0A] border-white/10 text-white">
            <SelectItem value="all">{t("allResults")}</SelectItem>
            {RESULTS.map((r) => <SelectItem key={r.value} value={r.value}>{t(r.label)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="glass rounded-2xl overflow-hidden" data-testid="bets-table">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500 text-xs uppercase tracking-wider">
                <th className="text-left px-5 py-4 font-medium">{t("date")}</th>
                <th className="text-left px-5 py-4 font-medium">{t("sportMarket")}</th>
                <th className="text-left px-5 py-4 font-medium">{t("pick")}</th>
                <th className="text-right px-5 py-4 font-medium">{t("stake")}</th>
                <th className="text-right px-5 py-4 font-medium">{t("odds")}</th>
                <th className="text-left px-5 py-4 font-medium">{t("result")}</th>
                <th className="text-right px-5 py-4 font-medium">{t("profit")}</th>
                <th className="text-right px-5 py-4 font-medium">{t("balance")}</th>
                <th className="text-right px-5 py-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-5 py-10 text-center text-zinc-500">{t("loading")}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-16 text-center text-zinc-500">
                  {t("noBets")}
                </td></tr>
              ) : (
                filtered.map((b) => (
                  <tr key={b.bet_id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-4 text-zinc-400 font-mono-data whitespace-nowrap">
                      {new Date(b.date).toLocaleDateString(locale)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-white">{t(b.sport)}</div>
                      <div className="text-xs text-zinc-500">{t(b.market)}</div>
                    </td>
                    <td className="px-5 py-4 text-zinc-300 max-w-[200px] truncate">{b.selection || "—"}</td>
                    <td className="px-5 py-4 text-right font-mono-data text-white">{fmtMoney(b.stake, currency)}</td>
                    <td className="px-5 py-4 text-right font-mono-data text-white">{fmtOdds(b.odds, locale)}</td>
                    <td className="px-5 py-4"><ResultBadge result={b.result} t={t} /></td>
                    <td className={`px-5 py-4 text-right font-mono-data font-semibold ${b.profit > 0 ? "text-profit" : b.profit < 0 ? "text-loss" : "text-zinc-400"}`}>
                      {b.profit > 0 ? "+" : ""}{fmtMoney(b.profit, currency)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono-data whitespace-nowrap" data-testid={`bankroll-after-${b.bet_id}`}>
                      <span className="inline-flex items-center gap-1.5 text-white">
                        {b.profit > 0 ? (
                          <TrendingUp size={13} className="text-profit" />
                        ) : b.profit < 0 ? (
                          <TrendingDown size={13} className="text-loss" />
                        ) : null}
                        {fmtMoney(runningMap[b.bet_id], currency)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => { setEditBet(b); setDialogOpen(true); }}
                        data-testid={`edit-bet-${b.bet_id}`}
                        className="text-zinc-500 hover:text-white p-1.5 transition-colors"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeleteBet(b)}
                        data-testid={`delete-bet-${b.bet_id}`}
                        className="text-zinc-500 hover:text-loss p-1.5 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BetFormDialog open={dialogOpen} onOpenChange={setDialogOpen} editBet={editBet} />
      <ReportsDialog open={reportsOpen} onOpenChange={setReportsOpen} />

      <AlertDialog open={!!deleteBet} onOpenChange={(o) => !o && setDeleteBet(null)}>
        <AlertDialogContent className="bg-[#0A0A0A] border-white/10 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteBetTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {t("deleteBetDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-white/5 border-white/10 text-white hover:bg-white/10">{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="confirm-delete-bet"
              onClick={() => deleteMutation.mutate(deleteBet.bet_id)}
              className="bg-loss text-white hover:bg-red-600"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
