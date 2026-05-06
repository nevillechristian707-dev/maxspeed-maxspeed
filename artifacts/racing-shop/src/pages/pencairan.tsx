import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useListPencairan, useMarkSettled, useListMasterBank, useListTransaksiBank, useDeletePenjualan, useGetMe } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { CetakPencairanModal } from "@/components/cetak-pencairan-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { formatRupiah, formatDate, cn, getIndonesianPeriodLabel, formatDateToYYYYMMDD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, CheckCircle, Search, Hash, Building2, Landmark, History, PlusCircle, XCircle, Store, CreditCard, Calendar, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useMonthYear } from "@/context/month-year-context";

export default function Pencairan() {
  const { dateParams, selectedMonth, selectedYear, setSelectedYear, setSelectedMonth } = useMonthYear();
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: "all", label: "Setahun Penuh" },
    { value: 1, label: "Januari" },
    { value: 2, label: "Februari" },
    { value: 3, label: "Maret" },
    { value: 4, label: "April" },
    { value: 5, label: "Mei" },
    { value: 6, label: "Juni" },
    { value: 7, label: "Juli" },
    { value: 8, label: "Agustus" },
    { value: 9, label: "September" },
    { value: 10, label: "Oktober" },
    { value: 11, label: "November" },
    { value: 12, label: "Desember" }
  ];
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data, isLoading, isFetching } = useListPencairan(dateParams);
  const { data: banks } = useListMasterBank();
  const { data: bankTransactions, isLoading: isLoadingHistory, isFetching: isFetchingHistory } = useListTransaksiBank(dateParams);
  const markSettledMutation = useMarkSettled({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/pencairan"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/profit"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/top-products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/pencairan/transaksi-bank"] });
      }
    }
  });
  const deleteMutation = useDeletePenjualan();

  // Custom cancellation mutation
  const cancelSettledMutation = useMutation({
    mutationFn: async (id: number) => {
      const resp = await fetch(`/api/pencairan/${id}/cancel-settled`, {
        method: 'POST',
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.error || 'Failed to cancel settlement');
      }
      return resp.json();
    },
    onMutate: async (id: number) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ["/api/pencairan"] });
      await queryClient.cancelQueries({ queryKey: ["/api/pencairan/transaksi-bank"] });

      // Snapshot the previous value
      const previousPencairan = queryClient.getQueryData(["/api/pencairan", dateParams]);
      const previousBankTransactions = queryClient.getQueryData(["/api/pencairan/transaksi-bank", dateParams]);

      // Optimistically update History (remove the cancelled item)
      if (previousBankTransactions) {
        queryClient.setQueryData(["/api/pencairan/transaksi-bank", dateParams], (old: any) => 
          old?.filter((tx: any) => tx.penjualanId !== id)
        );
      }

      // Optimistically update Pencairan List (mark item as pending)
      if (previousPencairan) {
        queryClient.setQueryData(["/api/pencairan", dateParams], (old: any) => 
          old?.map((item: any) => {
            if (item.id === id) {
              return { ...item, status: 'pending', totalPaid: 0 };
            }
            return item;
          })
        );
      }

      return { previousPencairan, previousBankTransactions };
    },
    onSuccess: () => {
      toast({ title: "Berhasil", description: "Pencairan berhasil dibatalkan." });
    },
    onError: (err: any, id: number, context: any) => {
      // Rollback if mutation fails
      if (context?.previousBankTransactions) {
        queryClient.setQueryData(["/api/pencairan/transaksi-bank", dateParams], context.previousBankTransactions);
      }
      if (context?.previousPencairan) {
        queryClient.setQueryData(["/api/pencairan", dateParams], context.previousPencairan);
      }
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
      onSettled: () => {
        // Always refetch after error or success to ensure we are in sync with the server
        queryClient.invalidateQueries({ queryKey: ["/api/pencairan"] });
        queryClient.invalidateQueries({ queryKey: ["/api/pencairan/transaksi-bank"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/profit"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/top-products"] });
        queryClient.invalidateQueries({ queryKey: ["/api/master-bank"] });
      }
  });
  
  const handleDeletePenjualan = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Terhapus", description: "Data transaksi berhasil dihapus." });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/pencairan"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/pencairan/transaksi-bank"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/profit"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/top-products"] })
      ]);
      setDeleteConfirmId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const periodLabel = getIndonesianPeriodLabel(selectedMonth, selectedYear);

  const [selectedDate, setSelectedDate] = useState(formatDateToYYYYMMDD(new Date()));
  const [markedIds, setMarkedIds] = useState<Set<number>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Individual Search States
  const [searchOnlineShop, setSearchOnlineShop] = useState("");
  const [searchKredit, setSearchKredit] = useState("");
  const [searchHistory, setSearchHistory] = useState("");
  
  // Bank Selection Modal State
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [itemToSettle, setItemToSettle] = useState<number | null>(null);
  const [isBulkSettle, setIsBulkSettle] = useState(false);
  const [nilaiPembayaran, setNilaiPembayaran] = useState<string>("");
  const [isCetakModalOpen, setIsCetakModalOpen] = useState(false);

  const selectedBankInfo = useMemo(() => {
    return banks?.find(b => b.id.toString() === selectedBankId);
  }, [banks, selectedBankId]);

  const handleOpenBankModal = (item: any | null, isBulk: boolean = false) => {
    if (isBulk) {
      setItemToSettle(null);
      setNilaiPembayaran(""); 
      setCustomKodePencairan(""); // Reset custom code
    } else {
      setItemToSettle(item.id);
      setNilaiPembayaran(item.nilai.toString());
      setCustomKodePencairan(""); // Reset custom code
    }
    setIsBulkSettle(isBulk);
    setIsBankModalOpen(true);
  };

  const [customKodePencairan, setCustomKodePencairan] = useState("");

  const handleConfirmSettle = async () => {
    try {
      const baseSettleData = {
        tanggalCair: selectedDate,
        namaBank: selectedBankId === "cash" ? "CASH" : selectedBankInfo?.namaBank,
        rekeningBank: selectedBankId === "cash" ? "KAS TUNAI" : selectedBankInfo?.nomorRekening,
        kodePencairan: customKodePencairan || undefined,
      };
      if (selectedBankId !== "cash" && !selectedBankInfo) {
        toast({ title: "Error", description: "Silakan pilih bank terlebih dahulu.", variant: "destructive" });
        return;
      }

      if (isBulkSettle) {
        const payload = {
          ids: Array.from(markedIds),
          tanggalCair: selectedDate,
          namaBank: selectedBankId === "cash" ? "CASH" : selectedBankInfo?.namaBank,
          rekeningBank: selectedBankId === "cash" ? "KAS TUNAI" : selectedBankInfo?.nomorRekening,
          kodePencairan: customKodePencairan || undefined,
        };

        try {
          const response = await fetch(`/api/pencairan/bulk-settle`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Gagal melakukan pencairan massal di server.");
          }

          const result = await response.json();
          toast({ 
            title: "Berhasil", 
            description: `${result.count} transaksi berhasil dicairkan dengan kode: ${result.kodePencairan}` 
          });
          
          setMarkedIds(new Set());
          setIsBankModalOpen(false);
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/pencairan"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/laporan/profit"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/laporan/top-products"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/pencairan/transaksi-bank"] })
          ]);
        } catch (err: any) {
          toast({ title: "Gagal", description: err.message, variant: "destructive" });
        }
      } else if (itemToSettle !== null) {
        const amountToPay = parseFloat(nilaiPembayaran) || 0;
        if (amountToPay <= 0) {
          toast({ title: "Gagal", description: "Nilai pembayaran harus lebih besar dari 0.", variant: "destructive" });
          return;
        }
        await markSettledMutation.mutateAsync({ 
          id: itemToSettle, 
          data: { ...baseSettleData, nilai: amountToPay } as any 
        });
        toast({ title: "Berhasil", description: `Transaksi berhasil dicairkan.` });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/pencairan"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/profit"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/top-products"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/pencairan/transaksi-bank"] })
      ]);
      setIsBankModalOpen(false);
      setItemToSettle(null);
      setCustomKodePencairan("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleMark = (id: number) => {
    setMarkedIds((prev: Set<number>) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const { data: user } = useGetMe();
  const checkPermission = (action: string) => {
    const role = String(user?.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('superadmin')) return true;
    const permissions = (user as any)?.permissions || {};
    const perms = permissions['Pencairan'] || permissions['pencairan'] || [];
    return perms.some((p: string) => p.toLowerCase() === action.toLowerCase());
  };

  const canEdit = checkPermission('edit');
  const canDelete = checkPermission('delete');

  const allOnlineShopItems = useMemo(() => {
    return data?.filter(x => (x.status === 'pending' || x.status === 'partial') && x.paymentMethod === 'online_shop') || [];
  }, [data]);

  const onlineShopPending = useMemo(() => {
    let items = allOnlineShopItems;
    if (searchOnlineShop) {
      const query = searchOnlineShop.toLowerCase();
      items = items.filter(item => 
        formatDate(item.tanggal).toLowerCase().includes(query) ||
        item.kodeTransaksi.toLowerCase().includes(query) ||
        (item.noFaktur || "").toLowerCase().includes(query) ||
        item.namaBarang.toLowerCase().includes(query) ||
        (item.namaOnlineShop || "").toLowerCase().includes(query)
      );
    }
    return [...items].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [allOnlineShopItems, searchOnlineShop]);

  const allKreditItems = useMemo(() => {
    return data?.filter(x => (x.status === 'pending' || x.status === 'partial') && x.paymentMethod === 'kredit') || [];
  }, [data]);

  const kreditPending = useMemo(() => {
    let items = allKreditItems;
    if (searchKredit) {
      const query = searchKredit.toLowerCase();
      items = items.filter(item => 
        formatDate(item.tanggal).toLowerCase().includes(query) ||
        item.kodeTransaksi.toLowerCase().includes(query) ||
        (item.noFaktur || "").toLowerCase().includes(query) ||
        item.namaBarang.toLowerCase().includes(query) ||
        (item.namaCustomer || "").toLowerCase().includes(query)
      );
    }
    return [...items].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [allKreditItems, searchKredit]);

  const totalMarked = useMemo(() => {
    return Array.from(markedIds).reduce((sum, id) => {
      const item = data?.find(x => x.id === id);
      return sum + (item?.nilai || 0);
    }, 0);
  }, [markedIds, data]);

  const totalOnlineShopMarkedNum = useMemo(() => {
    return Array.from(markedIds).filter(id => allOnlineShopItems.some(item => item.id === id)).length;
  }, [markedIds, allOnlineShopItems]);

  const totalOnlineShopMarked = useMemo(() => {
    return Array.from(markedIds).reduce((sum, id) => {
      const item = allOnlineShopItems.find(x => x.id === id);
      return sum + (item ? (item.nilai || 0) : 0);
    }, 0);
  }, [markedIds, allOnlineShopItems]);

  const totalKreditMarkedNum = useMemo(() => {
    return Array.from(markedIds).filter(id => allKreditItems.some(item => item.id === id)).length;
  }, [markedIds, allKreditItems]);

  const totalKreditMarked = useMemo(() => {
    return Array.from(markedIds).reduce((sum, id) => {
      const item = allKreditItems.find(x => x.id === id);
      return sum + (item ? (item.nilai || 0) : 0);
    }, 0);
  }, [markedIds, allKreditItems]);

  const totalAllOnlineShop = useMemo(() => {
    return onlineShopPending.reduce((sum, item) => sum + (item.nilai || 0), 0);
  }, [onlineShopPending]);

  const totalAllKredit = useMemo(() => {
    return kreditPending.reduce((sum, item) => sum + (item.nilai || 0), 0);
  }, [kreditPending]);

  const bankSummaries = useMemo(() => {
    if (!bankTransactions) return [];
    
    // Filter by search query first
    let filteredTransactions = bankTransactions;
    if (searchHistory) {
      const query = searchHistory.toLowerCase();
      filteredTransactions = bankTransactions.filter((tx: any) => 
        formatDate(tx.tanggal).toLowerCase().includes(query) ||
        (tx.noFaktur || "").toLowerCase().includes(query) ||
        tx.kodeTransaksi?.toLowerCase().includes(query) ||
        tx.namaBarang?.toLowerCase().includes(query) ||
        (tx.brand || "").toLowerCase().includes(query) ||
        tx.namaBank.toLowerCase().includes(query) ||
        (tx.rekeningBank || "").toLowerCase().includes(query) ||
        (tx.namaOnlineShop || "").toLowerCase().includes(query) ||
        (tx.namaCustomer || "").toLowerCase().includes(query)
      );
    }

    // Group by Date first
    const dailyGroups: Record<string, { date: string; kodePencairan: string | null; banks: Record<string, any>; total: number }> = {};
    
    filteredTransactions.forEach(tx => {
      const dateKey = tx.tanggalCair || "Unknown";
      const groupKey = `${dateKey}_${tx.kodePencairan || "manual"}`;
      
      if (!dailyGroups[groupKey]) {
        dailyGroups[groupKey] = { date: dateKey, kodePencairan: tx.kodePencairan || null, banks: {}, total: 0 };
      }
      
      const bankKey = `${tx.namaBank}-${tx.rekeningBank}`;
      if (!dailyGroups[groupKey].banks[bankKey]) {
        dailyGroups[groupKey].banks[bankKey] = { bank: tx.namaBank, account: tx.rekeningBank, total: 0, count: 0, items: [] };
      }
      
      const amount = Number(tx.nilai);
      dailyGroups[groupKey].banks[bankKey].total += amount;
      dailyGroups[groupKey].banks[bankKey].count += 1;
      dailyGroups[groupKey].banks[bankKey].items.push(tx);
      dailyGroups[groupKey].total += amount;
    });

    return Object.values(dailyGroups)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(day => ({
        ...day,
        banks: Object.values(day.banks).sort((a: any, b: any) => b.total - a.total)
      }));
  }, [bankTransactions, searchHistory]);

  const currentInstallments = useMemo(() => {
    if (!itemToSettle || !bankTransactions) return [];
    return bankTransactions.filter(tx => tx.penjualanId === itemToSettle)
      .sort((a, b) => new Date(b.tanggalCair).getTime() - new Date(a.tanggalCair).getTime());
  }, [itemToSettle, bankTransactions]);

  const handleFixKode = async () => {
    try {
      const resp = await fetch("/api/pencairan/fix-kode-pencairan", { method: "POST" });
      if (!resp.ok) throw new Error("Gagal migrasi kode pencairan");
      const r = await resp.json();
      toast({ title: "Berhasil", description: r.message });
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Layout>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-black text-neu-text flex items-center gap-3">
              <Wallet className="text-neu-accent w-8 h-8" /> Pencairan Dana
            </h1>
            <p className="text-neu-text mt-1 text-sm font-black">Kelola pelunasan dari Online Shop dan Penjualan Kredit.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 bg-secondary/30 p-2 rounded-2xl border border-border/50">
              <Calendar className="w-4 h-4 text-primary ml-2" />
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer p-1"
              >
                {years.map(y => <option key={y} value={y} className="bg-card">{y}</option>)}
              </select>
              <div className="w-px h-4 bg-border mx-1" />
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="bg-transparent text-sm font-bold outline-none cursor-pointer p-1"
              >
                {months.map(m => <option key={m.value} value={m.value} className="bg-card">{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2">
            {canEdit && (
              <Button
                variant="outline"
                onClick={handleFixKode}
                className="gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/10 font-bold"
              >
                Fix Data Double
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsCetakModalOpen(true)}
              className="gap-2 border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10 font-bold"
            >
              <Printer className="w-4 h-4" />
              Cetak Laporan
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 bg-neu-bg/50 rounded-2xl border border-neu-dark/10">
               <span className="text-xs font-black text-neu-text uppercase tracking-widest px-2">Periode Aktif:</span>
               <span className="text-sm font-black text-neu-accent uppercase">{periodLabel}</span>
            </div>
          </div>
        </div>

      <CetakPencairanModal 
        open={isCetakModalOpen} 
        onOpenChange={setIsCetakModalOpen}
        dateParams={dateParams}
      />

      <div className="grid grid-cols-1 gap-8">
        {/* Online Shop Section */}
        <Card className="border-purple-500/20 shadow-lg shadow-purple-500/5">
          <CardHeader className="border-b border-border/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-purple-400 flex items-center gap-3 uppercase tracking-tighter decoration-purple-500/30 underline-offset-4 underline">
                <Store className="w-5 h-5 text-purple-500" /> 
                <span>Piutang Online Shop</span>
                {totalAllOnlineShop > 0 && (
                  <span className="ml-3 px-3 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full text-sm font-black text-purple-300 no-underline tracking-normal shadow-lg shadow-purple-500/10">
                    {formatRupiah(totalAllOnlineShop)}
                  </span>
                )}
              </CardTitle>
              <p className="text-xs font-black text-neu-text uppercase tracking-widest pl-8">Dana marketplace belum cair</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Cari Tgl, Faktur, TRX, Produk..." 
                  value={searchOnlineShop}
                  onChange={(e) => setSearchOnlineShop(e.target.value)}
                  className="pl-9 h-9 text-xs bg-secondary/5 border-border/50"
                />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {totalOnlineShopMarked > 0 && (
                  <div className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-lg flex items-center gap-2 whitespace-nowrap">
                    <span className="text-[10px] font-black uppercase text-purple-400">Total {totalOnlineShopMarkedNum} Item:</span>
                    <span className="text-xs font-black text-purple-500 tabular-nums">{formatRupiah(totalOnlineShopMarked)}</span>
                  </div>
                )}
                {canEdit && totalOnlineShopMarked > 0 && (
                  <Button 
                    onClick={() => handleOpenBankModal(null, true)}
                    disabled={markSettledMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 font-bold h-9 px-4 text-sm"
                  >
                    Cairkan
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs font-black text-neu-text uppercase bg-neu-bg/50 border-b border-neu-bg">
                  <tr>
                    <th className="px-4 py-3.5 w-10">
                      <Checkbox
                        checked={onlineShopPending.length > 0 && onlineShopPending.every(i => markedIds.has(i.id))}
                        onCheckedChange={(checked) => {
                          const newMarked = new Set(markedIds);
                          onlineShopPending.forEach(i => checked ? newMarked.add(i.id) : newMarked.delete(i.id));
                          setMarkedIds(newMarked);
                        }}
                      />
                    </th>
                    <th className="px-4 py-3.5 font-black uppercase tracking-widest">Tgl TRX</th>
                    <th className="px-4 py-3.5 font-black uppercase tracking-widest">Faktur / TRX</th>
                    <th className="px-4 py-3.5 font-black uppercase tracking-widest">Platform / Produk</th>
                    <th className="px-4 py-3.5 text-right font-black uppercase tracking-widest">TOTAL</th>
                    <th className="px-4 py-3.5 text-center font-black uppercase tracking-widest">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading || isFetching ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground italic">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        Memuat data...
                      </div>
                    </td></tr>
                  ) : onlineShopPending.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground font-medium italic">Tidak ada piutang online shop.</td></tr>
                  ) : onlineShopPending.map((item: any) => (
                    <tr key={item.id} className={cn(
                      "border-b border-border/20 transition-colors group",
                      markedIds.has(item.id) ? "bg-primary/5" : "hover:bg-secondary/5"
                    )}>
                      <td className="px-4 py-3">
                        <Checkbox checked={markedIds.has(item.id)} onCheckedChange={() => toggleMark(item.id)} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-neu-text font-black">{formatDate(item.tanggal)}</td>
                      <td className="px-4 py-3">
                        <div className="font-black text-neu-text text-sm">{item.noFaktur || '-'}</div>
                        <div className="font-mono text-xs font-black text-neu-text leading-none">{item.kodeTransaksi}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-black text-purple-600 text-xs uppercase block mb-1">{item.namaOnlineShop}</span>
                        <div className="text-sm leading-tight text-neu-text font-bold">{item.namaBarang}</div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="font-black text-emerald-500">{formatRupiah(item.totalAmount)}</div>
                        <div className="flex flex-col items-end mt-1">
                          {item.status === 'partial' && (
                            <>
                              <span className="text-xs font-medium bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-emerald-500/20 mb-1">Piutang Terbayar</span>
                              <span className="text-xs font-bold text-orange-400 font-bold italic">Sisa Piutang: {formatRupiah(item.nilai)}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 transition-opacity">
                          {canEdit && <button onClick={() => handleOpenBankModal(item)} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white text-xs font-black rounded transition-all uppercase">Cairkan</button>}
                          {canDelete && (
                            <button 
                              onClick={() => {
                                if ((item.totalPaid || 0) > 0) {
                                  toast({ 
                                    title: "Tindakan Ditolak", 
                                    description: "Transaksi ini sudah masuk pencairan. Batalkan dulu di riwayat pencairan.", 
                                    variant: "destructive" 
                                  });
                                } else {
                                  setDeleteConfirmId(item.id);
                                }
                              }} 
                              className={cn(
                                "p-1 rounded border",
                                (item.totalPaid || 0) > 0 
                                  ? "text-muted-foreground/30 border-muted-foreground/10 cursor-not-allowed" 
                                  : "text-rose-500 hover:bg-rose-500/10 border-rose-500/20"
                              )}
                              title={(item.totalPaid || 0) > 0 ? "Tidak bisa dihapus karena sudah masuk pencairan" : "Hapus Piutang"}
                            >
                              <XCircle className="w-3.5 h-3.5"/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-border/20 p-2">
              {isLoading || isFetching ? (
                <div className="p-10 text-center text-muted-foreground animate-pulse flex flex-col items-center gap-2">
                   <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                   Memuat data...
                </div>
              ) : onlineShopPending.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">Tidak ada data.</div>
              ) : onlineShopPending.map((item: any) => (
                <div key={item.id} className={cn("p-4 mb-3 rounded-xl border transition-all space-y-3", markedIds.has(item.id) ? "bg-primary/10 border-primary/40" : "bg-card/60 border-border/40")}>
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-start">
                      <Checkbox checked={markedIds.has(item.id)} onCheckedChange={() => toggleMark(item.id)} className="mt-1" />
                      <div>
                        <div className="text-xs font-black text-purple-500 uppercase tracking-widest">{item.namaOnlineShop}</div>
                        <div className="text-sm font-black text-neu-text mt-0.5">{item.noFaktur || '-'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs font-black text-neu-text uppercase">{formatDate(item.tanggal)}</div>
                       <div className="text-xs font-black font-mono text-neu-text">{item.kodeTransaksi}</div>
                    </div>
                  </div>
                  <div className="text-sm text-neu-text font-bold pl-2 border-l-2 border-purple-500/30">{item.namaBarang}</div>
                  <div className="flex justify-between items-center pt-1">
                    <div>
                      <div className="text-sm font-black text-emerald-500">{formatRupiah(item.totalAmount)}</div>
                      {item.status === 'partial' && <div className="text-xs font-black text-orange-400 uppercase tracking-tighter italic">Sisa: {formatRupiah(item.nilai)}</div>}
                    </div>
                    <div className="flex gap-2">
                      {canEdit && <button onClick={() => handleOpenBankModal(item)} className="px-4 py-2 bg-emerald-500 text-white text-xs font-black rounded-lg uppercase shadow-lg shadow-emerald-500/20">Cairkan</button>}
                      {canDelete && (
                         <button 
                         onClick={() => {
                           if ((item.totalPaid || 0) > 0) {
                             toast({ 
                               title: "Ditolak", 
                               description: "Sudah masuk pencairan. Batalkan dulu riwayatnya.", 
                               variant: "destructive" 
                             });
                           } else {
                             setDeleteConfirmId(item.id);
                           }
                         }} 
                         className={cn(
                           "p-2 rounded-lg border",
                           (item.totalPaid || 0) > 0 
                             ? "text-muted-foreground/30 border-muted-foreground/10 cursor-not-allowed" 
                             : "text-rose-500 hover:bg-rose-500/10 border-rose-500/20"
                         )}
                         >
                           <XCircle className="w-4 h-4"/>
                         </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Credit Section */}
        <Card className="border-orange-500/20 shadow-lg shadow-orange-500/5">
          <CardHeader className="border-b border-border/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-orange-400 flex items-center gap-3 uppercase tracking-tighter decoration-orange-500/30 underline-offset-4 underline">
                <CreditCard className="w-5 h-5 text-orange-500" /> 
                <span>Piutang Penjualan Kredit</span>
                {totalAllKredit > 0 && (
                  <span className="ml-3 px-3 py-1 bg-orange-500/20 border border-orange-500/40 rounded-full text-sm font-black text-orange-300 no-underline tracking-normal shadow-lg shadow-orange-500/10">
                    {formatRupiah(totalAllKredit)}
                  </span>
                )}
              </CardTitle>
              <p className="text-xs font-black text-neu-text uppercase tracking-widest pl-8">Tagihan jatuh tempo customer</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Cari Tgl, Faktur, TRX, Produk..." 
                  value={searchKredit}
                  onChange={(e) => setSearchKredit(e.target.value)}
                  className="pl-9 h-9 text-xs bg-secondary/5 border-border/50"
                />
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                {totalKreditMarked > 0 && (
                  <div className="px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-2 whitespace-nowrap">
                    <span className="text-[10px] font-black uppercase text-orange-400">Total {totalKreditMarkedNum} Item:</span>
                    <span className="text-xs font-black text-orange-500 tabular-nums">{formatRupiah(totalKreditMarked)}</span>
                  </div>
                )}
                {canEdit && totalKreditMarked > 0 && (
                  <Button 
                    onClick={() => handleOpenBankModal(null, true)}
                    disabled={markSettledMutation.isPending}
                    className="bg-emerald-600 hover:bg-emerald-700 font-bold h-9 px-4 text-sm"
                  >
                    Lunasi
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-xs font-black text-neu-text uppercase bg-neu-bg/50 border-b border-neu-bg">
                  <tr>
                    <th className="px-4 py-3.5 w-10">
                      <Checkbox
                        checked={kreditPending.length > 0 && kreditPending.every(i => markedIds.has(i.id))}
                        onCheckedChange={(checked) => {
                          const newMarked = new Set(markedIds);
                          kreditPending.forEach(i => checked ? newMarked.add(i.id) : newMarked.delete(i.id));
                          setMarkedIds(newMarked);
                        }}
                      />
                    </th>
                    <th className="px-4 py-3.5 font-black uppercase tracking-widest">Tgl TRX</th>
                    <th className="px-4 py-3.5 font-black uppercase tracking-widest">Faktur / TRX</th>
                    <th className="px-4 py-3.5 font-black uppercase tracking-widest">Customer / Produk</th>
                    <th className="px-4 py-3.5 text-right font-black uppercase tracking-widest">TOTAL</th>
                    <th className="px-4 py-3.5 text-center font-black uppercase tracking-widest">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading || isFetching ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground italic">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                        Memuat data...
                      </div>
                    </td></tr>
                  ) : kreditPending.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground font-medium italic">Tidak ada piutang kredit.</td></tr>
                  ) : kreditPending.map((item: any) => (
                    <tr key={item.id} className={cn(
                      "border-b border-border/20 transition-colors group",
                      markedIds.has(item.id) ? "bg-primary/5" : "hover:bg-secondary/5"
                    )}>
                      <td className="px-4 py-3">
                        <Checkbox checked={markedIds.has(item.id)} onCheckedChange={() => toggleMark(item.id)} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-neu-text font-black">{formatDate(item.tanggal)}</td>
                      <td className="px-4 py-3">
                        <div className="font-black text-neu-text text-sm">{item.noFaktur || '-'}</div>
                        <div className="font-mono text-xs font-black text-neu-text leading-none">{item.kodeTransaksi}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-black text-orange-600 text-xs uppercase block mb-1">{item.namaCustomer}</span>
                        <div className="text-sm leading-tight text-neu-text font-bold">{item.namaBarang}</div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="font-black text-orange-500">{formatRupiah(item.totalAmount)}</div>
                        <div className="flex flex-col items-end mt-1">
                          {item.status === 'partial' && (
                            <>
                              <span className="text-xs font-medium bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-orange-500/20 mb-1">Terbayar Sebagian</span>
                              <span className="text-xs font-black text-orange-400 uppercase tracking-tighter">Sisa: {formatRupiah(item.nilai)}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 transition-opacity">
                          {canEdit && <button onClick={() => handleOpenBankModal(item)} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white text-xs font-black rounded transition-all uppercase">Lunasi</button>}
                          {canDelete && (
                            <button 
                              onClick={() => {
                                if ((item.totalPaid || 0) > 0) {
                                  toast({ 
                                    title: "Tindakan Ditolak", 
                                    description: "Transaksi sudah memiliki riwayat angsuran. Batalkan pencairan terlebih dahulu.", 
                                    variant: "destructive" 
                                  });
                                } else {
                                  setDeleteConfirmId(item.id);
                                }
                              }}
                              className={cn(
                                "p-1 rounded border",
                                (item.totalPaid || 0) > 0 
                                  ? "text-muted-foreground/30 border-muted-foreground/10 cursor-not-allowed" 
                                  : "text-rose-500 hover:bg-rose-500/10 border-rose-500/20"
                              )}
                              title={(item.totalPaid || 0) > 0 ? "Tidak bisa dihapus" : "Hapus"}
                            >
                              <XCircle className="w-3.5 h-3.5"/>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="md:hidden divide-y divide-border/20 p-2">
              {isLoading || isFetching ? (
                <div className="p-10 text-center text-neu-text font-black uppercase flex flex-col items-center gap-2">
                   <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                   Memuat data...
                </div>
              ) : kreditPending.length === 0 ? (
                <div className="p-10 text-center text-neu-text font-black uppercase">Tidak ada piutang kredit.</div>
              ) : kreditPending.map((item: any) => (
                <div key={item.id} className={cn("p-4 mb-3 rounded-xl border transition-all space-y-3", markedIds.has(item.id) ? "bg-primary/10 border-primary/40" : "bg-card/60 border-border/40")}>
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-start">
                      <Checkbox checked={markedIds.has(item.id)} onCheckedChange={() => toggleMark(item.id)} className="mt-1" />
                      <div>
                        <div className="text-xs font-black text-orange-500 uppercase tracking-widest">{item.namaCustomer}</div>
                        <div className="text-sm font-black text-foreground mt-0.5">{item.noFaktur || '-'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-xs font-black text-neu-text uppercase">{formatDate(item.tanggal)}</div>
                       <div className="text-xs font-black font-mono text-neu-text">{item.kodeTransaksi}</div>
                    </div>
                  </div>
                  <div className="text-sm text-neu-text font-black pl-2 border-l-2 border-orange-500/30">{item.namaBarang}</div>
                  <div className="flex justify-between items-center pt-1">
                    <div>
                      <div className="text-sm font-black text-orange-500">{formatRupiah(item.totalAmount)}</div>
                      {item.status === 'partial' && <div className="text-xs font-black text-orange-400 uppercase tracking-tighter">Sisa: {formatRupiah(item.nilai)}</div>}
                    </div>
                    <div className="flex gap-2">
                      {canEdit && <button onClick={() => handleOpenBankModal(item)} className="px-4 py-2 bg-emerald-500 text-white text-xs font-black rounded-lg uppercase shadow-lg shadow-emerald-500/20">Lunasi</button>}
                      {canDelete && <button onClick={() => setDeleteConfirmId(item.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg border border-rose-500/20"><XCircle className="w-4 h-4"/></button>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Disbursement Data by Bank */}
        <Card className="border-emerald-500/20 shadow-lg shadow-emerald-500/5">
          <CardHeader className="border-b border-border/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-emerald-500 flex items-center gap-2 uppercase tracking-tighter decoration-emerald-500/30 underline-offset-4 underline">
                <Building2 className="w-5 h-5 text-emerald-500" /> Data Pencairan per Bank
              </CardTitle>
              <p className="text-xs font-black text-neu-text uppercase tracking-widest pl-7">Rekapitulasi kas masuk periode ini</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neu-text" />
                <Input 
                  placeholder="Cari Tgl, Faktur, TRX, Produk, Bank..." 
                  value={searchHistory}
                  onChange={(e) => setSearchHistory(e.target.value)}
                  className="pl-10 h-10 text-sm bg-secondary/10 border-emerald-500/20 shadow-inner"
                />
              </div>
              <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">
                  Periode: {periodLabel}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingHistory || isFetchingHistory ? (
              <div className="p-12 text-center text-neu-text font-black uppercase flex flex-col items-center gap-3">
                 <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin shadow-lg" />
                 <span className="font-black uppercase tracking-widest text-xs">Memperbarui riwayat pencairan...</span>
              </div>
            ) : bankSummaries.length === 0 ? (
              <div className="p-12 text-center text-neu-text font-black uppercase">Belum ada data pencairan periode ini.</div>
            ) : (
              <div className="p-4 space-y-8 bg-secondary/5">
                {bankSummaries.map((dayGroup, i) => (
                  <div key={i} className={`${i > 0 ? 'mt-12' : ''} group/day`}>
                    <div className="h-1 w-24 bg-indigo-500 rounded-full mb-3 opacity-50 group-hover/day:opacity-100 transition-opacity" />
                    {/* Date Header */}
                    <div className="bg-indigo-500/10 px-4 py-3 rounded-t-2xl border-x border-t border-indigo-500/30 flex flex-row items-center justify-between sticky top-0 z-10 backdrop-blur-xl shadow-sm">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center shadow-inner">
                            <Calendar className="w-5 h-5 text-indigo-400" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs sm:text-sm font-black uppercase tracking-[0.1em] sm:tracking-[0.2em] text-indigo-100 whitespace-nowrap">{formatDate(dayGroup.date)}</span>
                              {dayGroup.kodePencairan && (
                                <span className="px-1.5 py-0.5 sm:px-3 sm:py-1 rounded-md sm:rounded-lg bg-indigo-500/40 border sm:border-2 border-indigo-400/60 text-xs sm:text-2xl font-black font-mono text-white shadow-lg shadow-indigo-500/20 whitespace-nowrap">
                                  {dayGroup.kodePencairan}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] sm:text-xs font-black text-indigo-400 uppercase mt-0.5 tracking-tighter truncate">Riwayat Pencairan Harian</div>
                          </div>
                       </div>
                        <div className="text-[10px] sm:text-xs font-black text-neu-text uppercase flex items-center gap-2 sm:gap-3 shrink-0">
                          <span className="tracking-[0.1em] sm:tracking-[0.2em] hidden xs:inline">Total:</span>
                          <span className="bg-emerald-500/20 text-emerald-600 px-2 py-1 sm:px-4 sm:py-1.5 rounded-full border border-emerald-500/30 shadow-lg shadow-emerald-500/10 font-black text-[11px] sm:text-sm whitespace-nowrap">{formatRupiah(dayGroup.total)}</span>
                        </div>
                    </div>

                    <div className="space-y-6 p-5 border-x border-b border-indigo-500/20 bg-gradient-to-b from-indigo-500/[0.03] to-transparent rounded-b-2xl shadow-inner">
                      {dayGroup.banks.map((bankGroup: any, j: number) => (
                        <div key={j} className="overflow-hidden border border-border/20 rounded-xl bg-card shadow-sm hover:shadow-md transition-all duration-300">
                          {/* Bank Header Section */}
                          <div className="bg-emerald-500/[0.03] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/10">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-emerald-500/30 shadow-sm">
                                <Landmark className="w-6 h-6 text-emerald-500" />
                              </div>
                              <div>
                                <h3 className="text-sm font-black text-neu-text uppercase tracking-tight">{bankGroup.bank}</h3>
                                <p className="text-xs font-mono font-black text-neu-text tracking-tight">{bankGroup.account}</p>
                              </div>
                            </div>
                            <div className="text-left sm:text-right flex flex-row sm:flex-col justify-between items-center sm:items-end gap-2">
                              <div className="text-xl font-black text-emerald-600 drop-shadow-sm">{formatRupiah(bankGroup.total)}</div>
                              <div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-xs font-medium font-black uppercase rounded border border-emerald-500/20">{bankGroup.count} Transaksi</div>
                            </div>
                          </div>

                          {/* Transaction Detail Table for this Bank */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left">
                              <thead className="text-xs font-black text-neu-text uppercase bg-neu-bg/50 border-b border-neu-bg">
                                  <tr>
                                    <th className="px-2 sm:px-4 py-2.5 font-black uppercase tracking-widest whitespace-nowrap">Tgl Faktur</th>
                                    <th className="px-3 sm:px-6 py-2.5 font-black uppercase tracking-widest whitespace-nowrap">Faktur / TRX</th>
                                    <th className="px-2 sm:px-4 py-2.5 font-black uppercase tracking-widest whitespace-nowrap">Produk & Brand</th>
                                    <th className="px-2 sm:px-4 py-2.5 font-black uppercase tracking-widest whitespace-nowrap">Sumber Dana</th>
                                    <th className="px-2 sm:px-4 py-2.5 text-right font-black uppercase tracking-widest whitespace-nowrap">TOTAL</th>
                                    <th className="px-2 sm:px-4 py-2.5 text-center font-black uppercase tracking-widest whitespace-nowrap">Aksi</th>
                                  </tr>
                              </thead>
                              <tbody className="divide-y divide-border/10">
                                {bankGroup.items.map((tx: any) => (
                                  <tr key={tx.id} className="hover:bg-emerald-500/[0.01] transition-colors group/row">
                                    <td className="px-2 sm:px-4 py-3 whitespace-nowrap text-[10px] sm:text-xs text-neu-text font-black">
                                      {formatDate(tx.tanggal)}
                                    </td>
                                      <td className="px-3 sm:px-6 py-3">
                                      <span className="font-black text-neu-text text-[10px] sm:text-xs">{tx.noFaktur || "-"}</span>
                                      <div className="text-[9px] sm:text-xs font-black text-neu-text/50 font-mono tracking-tighter uppercase">ID: {tx.kodeTransaksi}</div>
                                    </td>
                                    <td className="px-2 sm:px-4 py-3">
                                      <div className="font-bold text-foreground text-[10px] sm:text-xs line-clamp-2">{tx.namaBarang}</div>
                                      <div className="text-[9px] sm:text-xs font-bold text-primary font-black uppercase mt-1 tracking-widest truncate">{tx.brand || '-'} • {tx.kodeBarang}</div>
                                    </td>
                                    <td className="px-2 sm:px-4 py-3">
                                      <span className="px-1.5 py-0.5 bg-neu-bg rounded text-[8px] sm:text-xs font-black text-neu-text uppercase tracking-tighter border border-neu-bg block mb-1 w-fit">
                                        {tx.sumber.replace('_', ' ')}
                                      </span>
                                      <div className="text-[9px] sm:text-xs font-black text-neu-text truncate">
                                        {tx.sumber === 'online_shop' ? tx.namaOnlineShop : tx.namaCustomer}
                                      </div>
                                    </td>
                                    <td className="px-2 sm:px-4 py-3 text-right font-black text-emerald-500/80 text-[10px] sm:text-xs whitespace-nowrap">{formatRupiah(tx.nilai)}</td>
                                    <td className="px-2 sm:px-4 py-3 text-center">
                                      {canEdit && (
                                        <button
                                          onClick={() => {
                                            if (window.confirm('Batalkan pencairan untuk faktur ini? Data akan kembali ke daftar tunggu.')) {
                                              cancelSettledMutation.mutate(tx.penjualanId);
                                            }
                                          }}
                                          disabled={cancelSettledMutation.isPending}
                                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-50"
                                          title="Batalkan Pencairan"
                                        >
                                          <XCircle className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bank Selection Dialog */}
      <Dialog open={isBankModalOpen} onOpenChange={setIsBankModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="text-primary w-5 h-5" />
              Pilih Bank Tujuan
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank" className="text-sm font-bold uppercase text-muted-foreground">Bank</Label>
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger id="bank" className="font-bold">
                  <SelectValue placeholder="Pilih bank..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash" className="font-black text-emerald-600 bg-emerald-50/50">
                    KAS / TUNAI (CASH)
                  </SelectItem>
                  {banks?.map((bank: any) => (
                    <SelectItem key={bank.id} value={bank.id.toString()} className="font-medium">
                      {bank.namaBank} - {bank.nomorRekening}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-bold uppercase text-muted-foreground">Tanggal Cair</Label>
              <DatePicker 
                date={selectedDate ? new Date(selectedDate) : undefined}
                onChange={(date) => setSelectedDate(formatDateToYYYYMMDD(date))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kode_pencairan" className="text-sm font-bold uppercase text-muted-foreground">Kode Pencairan / Ref (Opsional)</Label>
              <Input 
                id="kode_pencairan"
                placeholder="Contoh: REF-MAR-28 atau No. Resi"
                value={customKodePencairan}
                onChange={(e) => setCustomKodePencairan(e.target.value)}
                className="font-mono font-bold border-indigo-500/20 bg-indigo-500/5 focus:border-indigo-500"
              />
              <p className="text-[10px] text-muted-foreground italic">Gunakan kode yang sama untuk merekap data menjadi satu nilai gabungan.</p>
            </div>

            {currentInstallments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase text-muted-foreground tracking-widest">Riwayat Pembayaran Sebelumnya</Label>
                <div className="max-h-[120px] overflow-y-auto space-y-1.5 p-2 bg-secondary/10 rounded-xl border border-border/10">
                  {currentInstallments.map((tx: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-card/60 p-2 rounded-lg border border-border/5">
                      <div className="flex flex-col">
                        <span className="font-black text-foreground">{formatDate(tx.tanggalCair)}</span>
                        <span className="text-xs font-bold text-muted-foreground uppercase">{tx.namaBank}</span>
                      </div>
                      <span className="font-black text-emerald-500 tabular-nums">{formatRupiah(tx.nilai)}</span>
                    </div>
                  ))}
                  <div className="pt-1.5 mt-1 border-t border-border/20 flex justify-between items-center px-1">
                    <span className="text-xs font-medium font-black text-muted-foreground uppercase">Total Terbayar</span>
                    <span className="text-[11px] font-black text-emerald-600">{formatRupiah(currentInstallments.reduce((s: number, c: any) => s + Number(c.nilai), 0))}</span>
                  </div>
                </div>
              </div>
            )}

            {!isBulkSettle && (
              <div className="space-y-2">
                <Label htmlFor="nilai" className="text-sm font-bold uppercase text-muted-foreground">Nilai Pembayaran / Cicilan</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">Rp</div>
                  <Input 
                    id="nilai"
                    type="number"
                    value={nilaiPembayaran}
                    onChange={e => setNilaiPembayaran(e.target.value)}
                    onFocus={() => { if (nilaiPembayaran === "0") setNilaiPembayaran(""); }}
                    className="pl-10 font-bold text-emerald-600"
                  />
                </div>
              </div>
            )}            {selectedBankId === "cash" ? (
              <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20 text-sm">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-emerald-700 font-bold uppercase">Metode Pembayaran:</span>
                  <span className="font-black text-emerald-600">TUNAI / CASH</span>
                </div>
                <div className="text-xs text-emerald-500/70 italic">Uang akan dicatat masuk ke saldo Kas Toko.</div>
              </div>
            ) : selectedBankInfo && (
              <div className="p-3 bg-secondary/30 rounded-lg border border-border/50 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Penerima:</span>
                  <span className="font-bold">{selectedBankInfo.namaBank}</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-xs">
                  <span>Nomor Rekening:</span>
                  <span className="font-mono">{selectedBankInfo.nomorRekening}</span>
                </div>
              </div>
            )}

            {itemToSettle && (
              <div className="mt-2 p-3 bg-card rounded-2xl border border-border/50 shadow-inner">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Total Tagihan Saat Ini</span>
                   <span className="text-sm font-black text-foreground">{formatRupiah(data?.find(x => x.id === itemToSettle)?.nilai)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                   <span className="text-xs font-black text-muted-foreground uppercase tracking-wider">Sisa Setelah Bayar</span>
                   <span className={cn(
                     "text-sm font-black tabular-nums",
                     (data?.find(x => x.id === itemToSettle)?.nilai || 0) - (parseFloat(nilaiPembayaran) || 0) > 0 
                       ? "text-orange-500" 
                       : "text-emerald-500"
                   )}>
                     {formatRupiah(Math.max(0, (data?.find(x => x.id === itemToSettle)?.nilai || 0) - (parseFloat(nilaiPembayaran) || 0)))}
                   </span>
                </div>
                {(data?.find(x => x.id === itemToSettle)?.nilai || 0) - (parseFloat(nilaiPembayaran) || 0) > 0 && (
                  <div className="mt-2 text-center">
                    <span className="text-xs font-bold bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-orange-500/20">Akan dicatat sebagai Cicilan</span>
                  </div>
                )}
              </div>
            )}

            {isBulkSettle && (
              <div className="mt-2 p-4 bg-emerald-600/10 rounded-2xl border-2 border-emerald-600/30 shadow-lg shadow-emerald-600/5 animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center gap-1.5 text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600/70">Estimasi Dana Cair Masuk:</span>
                  <div className="text-2xl font-black text-emerald-600 font-mono tracking-tighter drop-shadow-sm">
                    {formatRupiah(totalMarked)}
                  </div>
                  <span className="px-3 py-1 bg-emerald-600/20 rounded-full text-[10px] font-black text-emerald-700 uppercase tracking-tight border border-emerald-600/20">
                    {totalOnlineShopMarkedNum + totalKreditMarkedNum} Item Akan Direkap
                  </span>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="custom-kode">Kode Pencairan (Opsional / Manual)</Label>
              <Input
                id="custom-kode"
                placeholder="Contoh: TRANSFER-SHOPEE-28MAR"
                value={customKodePencairan}
                onChange={(e) => setCustomKodePencairan(e.target.value)}
              />
              <p className="text-xs text-muted-foreground italic">
                *Kosongkan jika ingin sistem membuat kode PC-XXXXXX otomatis.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsBankModalOpen(false)}>Batal</Button>
            <Button 
              onClick={handleConfirmSettle}
              disabled={markSettledMutation.isPending || !selectedBankId}
              className="bg-emerald-600 hover:bg-emerald-700 font-bold px-8 shadow-md shadow-emerald-500/20"
            >
              Simpan & Lunasi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Piutang?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data piutang akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirmId && handleDeletePenjualan(deleteConfirmId)}
              className="bg-rose-600 hover:bg-rose-700 font-bold"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
