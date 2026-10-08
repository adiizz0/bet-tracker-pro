import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, fmtMoney } from "@/lib/api";
import { useLanguage } from "@/context/LanguageContext";
import { CURRENCIES } from "@/lib/constants";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, ChevronsUpDown, Plus, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";

const DATA_KEYS = ["bankrolls", "settings", "bets", "analytics", "limits"];

export default function BankrollSwitcher() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const [createOpen, setCreateOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ name: "", starting_bankroll: "100000", currency: "HUF" });
  const [renameName, setRenameName] = useState("");

  const refreshAll = () => DATA_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));

  const { data } = useQuery({
    queryKey: ["bankrolls"],
    queryFn: async () => (await api.get("/bankrolls")).data,
  });
  const bankrolls = data?.bankrolls || [];
  const activeId = data?.active_bankroll_id;
  const active = bankrolls.find((b) => b.bankroll_id === activeId);

  const activateMut = useMutation({
    mutationFn: (id) => api.post(`/bankrolls/${id}/activate`),
    onSuccess: refreshAll,
  });

  const createMut = useMutation({
    mutationFn: (body) => api.post("/bankrolls", body),
    onSuccess: () => {
      refreshAll();
      setCreateOpen(false);
      setForm({ name: "", starting_bankroll: "100000", currency: "HUF" });
      toast.success(t("booked"));
    },
    onError: () => toast.error(t("bankrollCreateFailed")),
  });

  const renameMut = useMutation({
    mutationFn: ({ id, name }) => api.put(`/bankrolls/${id}`, { name }),
    onSuccess: () => {
      refreshAll();
      setRenameTarget(null);
      toast.success(t("renamed"));
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/bankrolls/${id}`),
    onSuccess: () => {
      refreshAll();
      setDeleteTarget(null);
      toast.success(t("bankRollRemoved"));
    },
    onError: (e) => toast.error(e.response?.data?.detail || t("bankrollDeleteFailed")),
  });

  const submitCreate = (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return toast.error(t("bankrollNameRequired"));
    createMut.mutate({
      name,
      starting_bankroll: Number(String(form.starting_bankroll).replace(",", ".")) || 0,
      currency: form.currency,
    });
  };

  return (
    <div className="px-1 mb-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            data-testid="bankroll-switcher-trigger"
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] transition-colors text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-[#00E676]/15 flex items-center justify-center shrink-0">
              <Wallet size={15} className="text-[#00E676]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{t("bankroll")}</div>
              <div className="text-sm text-white font-medium truncate" data-testid="bankroll-active-name">
                {active?.name || "—"}
              </div>
            </div>
            <ChevronsUpDown size={15} className="text-zinc-500 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-64 bg-[#0A0A0A] border-white/10 text-white"
          data-testid="bankroll-switcher-menu"
        >
          <DropdownMenuLabel className="text-zinc-500 text-[10px] uppercase tracking-[0.15em]">
            {t("bankrollsLabel")}
          </DropdownMenuLabel>
          {bankrolls.map((b) => (
            <DropdownMenuItem
              key={b.bankroll_id}
              onSelect={(e) => { e.preventDefault(); if (b.bankroll_id !== activeId) activateMut.mutate(b.bankroll_id); }}
              data-testid={`bankroll-item-${b.bankroll_id}`}
              className="flex items-center gap-2 cursor-pointer focus:bg-white/[0.06]"
            >
              <span className="w-4 shrink-0">
                {b.bankroll_id === activeId && <Check size={14} className="text-[#00E676]" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{b.name}</div>
                <div className="text-[11px] text-zinc-500 font-mono-data">
                  {fmtMoney(b.starting_bankroll, b.currency)}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setRenameTarget(b); setRenameName(b.name); }}
                data-testid={`bankroll-rename-${b.bankroll_id}`}
                className="p-1 text-zinc-500 hover:text-white"
                title={t("rename")}
              >
                <Pencil size={13} />
              </button>
              {bankrolls.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(b); }}
                  data-testid={`bankroll-delete-${b.bankroll_id}`}
                  className="p-1 text-zinc-500 hover:text-loss"
                  title={t("delete")}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onSelect={(e) => { e.preventDefault(); setCreateOpen(true); }}
            data-testid="bankroll-create-open"
            className="flex items-center gap-2 cursor-pointer text-[#00E676] focus:bg-white/[0.06] focus:text-[#00E676]"
          >
            <Plus size={15} />
            {t("newBankroll")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 text-white" data-testid="bankroll-create-dialog">
          <DialogHeader>
            <DialogTitle>{t("newBankroll")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-4">
            <div>
              <Label className="text-xs text-zinc-500">{t("name")}</Label>
              <Input
                data-testid="bankroll-name-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("bankrollPlaceholder")}
                className="mt-1.5 bg-white/5 border-white/10 text-white"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-zinc-500">{t("startBankroll")}</Label>
                <Input
                  data-testid="bankroll-starting-input"
                  inputMode="decimal"
                  value={form.starting_bankroll}
                  onChange={(e) => setForm((f) => ({ ...f, starting_bankroll: e.target.value }))}
                  className="mt-1.5 bg-white/5 border-white/10 text-white font-mono-data"
                />
              </div>
              <div>
                <Label className="text-xs text-zinc-500">{t("currencyLabel")}</Label>
                <Select value={form.currency} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger data-testid="bankroll-currency-select" className="mt-1.5 bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0A0A0A] border-white/10 text-white">
                    {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)} className="text-zinc-400">
                {t("cancel")}
              </Button>
              <Button type="submit" data-testid="bankroll-create-submit" disabled={createMut.isPending} className="bg-[#00E676] text-black hover:bg-[#00c766]">
                {t("create")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="bg-[#0A0A0A] border-white/10 text-white" data-testid="bankroll-rename-dialog">
          <DialogHeader>
            <DialogTitle>{t("renameBankroll")}</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs text-zinc-500">{t("name")}</Label>
            <Input
              data-testid="bankroll-rename-input"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              className="mt-1.5 bg-white/5 border-white/10 text-white"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)} className="text-zinc-400">{t("cancel")}</Button>
            <Button
              data-testid="bankroll-rename-submit"
              disabled={renameMut.isPending || !renameName.trim()}
              onClick={() => renameMut.mutate({ id: renameTarget.bankroll_id, name: renameName.trim() })}
              className="bg-[#00E676] text-black hover:bg-[#00c766]"
            >
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="bg-[#0A0A0A] border-white/10 text-white" data-testid="bankroll-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteBankroll")}</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              {t("confirmDeleteBankroll").replace("{name}", deleteTarget?.name || "")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-white/10 text-zinc-300 hover:bg-white/5 hover:text-white">
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              data-testid="bankroll-delete-confirm"
              onClick={() => deleteMut.mutate(deleteTarget.bankroll_id)}
              className="bg-loss text-white hover:bg-loss/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
