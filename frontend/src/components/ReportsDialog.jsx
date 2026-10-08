import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, Download, Trash2, Loader2, FileDown, FolderArchive } from "lucide-react";
import { toast } from "sonner";

export default function ReportsDialog({ open, onOpenChange }) {
  const qc = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => (await api.get("/reports")).data,
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: () => api.post("/reports/pdf"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Jelentés elmentve a fiókodhoz");
    },
    onError: () => toast.error("Nem sikerült elmenteni a jelentést"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/reports/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reports"] });
      toast.success("Jelentés törölve");
    },
  });

  const download = async (r) => {
    try {
      const res = await api.get(`/reports/${r.report_id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Letöltés sikertelen");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0A0A0A] border-white/10 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-head text-2xl font-light tracking-tight flex items-center gap-2">
            <FolderArchive size={22} className="text-[#00E676]" /> Mentett jelentések
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-sm">
            Mentsd el az aktuális statisztikáid és fogadásaid PDF-be a fiókodba, és érd el bármely eszközről bejelentkezés után.
          </DialogDescription>
        </DialogHeader>

        <Button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          data-testid="create-cloud-report-button"
          className="bg-[#00E676] text-black hover:bg-[#00c765] rounded-full h-11 font-semibold active:scale-95 transition-colors"
        >
          {createMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <><FileDown size={18} className="mr-2" /> Új jelentés mentése</>}
        </Button>

        <div className="max-h-72 overflow-y-auto space-y-2 mt-1" data-testid="reports-list">
          {isLoading ? (
            <div className="py-8 text-center text-zinc-500"><Loader2 className="animate-spin inline" size={20} /></div>
          ) : reports.length === 0 ? (
            <div className="py-8 text-center text-zinc-500 text-sm">Még nincs mentett jelentés.</div>
          ) : (
            reports.map((r) => (
              <div
                key={r.report_id}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
              >
                <FileText size={18} className="text-zinc-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-white truncate font-mono-data">{r.filename}</div>
                  <div className="text-xs text-zinc-500">
                    {new Date(r.created_at).toLocaleString("hu-HU")} · {(r.size / 1024).toFixed(1)} KB
                  </div>
                </div>
                <button
                  onClick={() => download(r)}
                  data-testid={`download-report-${r.report_id}`}
                  className="text-zinc-400 hover:text-[#00E676] p-2 transition-colors"
                >
                  <Download size={16} />
                </button>
                <button
                  onClick={() => deleteMutation.mutate(r.report_id)}
                  className="text-zinc-400 hover:text-loss p-2 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
