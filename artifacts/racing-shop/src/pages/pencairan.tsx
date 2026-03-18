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
import { DatePicker } from "@/components/ui/date-picker";
import { formatRupiah, formatDate, cn, getIndonesianPeriodLabel, formatDateToYYYYMMDD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, CheckCircle, Search, Hash, Building2, Landmark, History, PlusCircle, XCircle, Store, CreditCard, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { useMonthYear } from "@/context/month-year-context";

export default function Pencairan() {
  const { dateParams, selectedMonth, selectedYear } = useMonthYear();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data, isLoading } = useListPencairan(dateParams);
  const { data: banks } = useListMasterBank();
  const { data: bankTransactions, isLoading: isLoadingHistory } = useListTransaksiBank(dateParams);
  const markSettledMutation = useMarkSettled();
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
    onSuccess: () => {
      toast({ title: "Berhasil", description: "Pencairan berhasil dibatalkan." });
      queryClient.invalidateQueries({ queryKey: ["/api/pencairan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pencairan/transaksi-bank"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/master-bank"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });
  
  const handleDeletePenjualan = async (id: number) => {
    try {
      await deleteMutation.mutateAsync({ id });
      toast({ title: "Terhapus", description: "Data transaksi berhasil dihapus." });
      queryClient.invalidateQueries({ queryKey: ["/api/pencairan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pencairan/transaksi-bank"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] });
      setDeleteConfirmId(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const periodLabel = getIndonesianPeriodLabel(selectedMonth, selectedYear);

  const [selectedDate, setSelectedDate] = useState(formatDateToYYYYMMDD(new Date()));
  const [searchQuery, setSearchQuery] = useState("");
  const [markedIds, setMarkedIds] = useState<Set<number>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  // Bank Selection Modal State
  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [itemToSettle, setItemToSettle] = useState<number | null>(null);
  const [isBulkSettle, setIsBulkSettle] = useState(false);
  const [nilaiPembayaran, setNilaiPembayaran] = useState<string>("");

  const selectedBankInfo = useMemo(() => {
    return banks?.find(b => b.id.toString() === selectedBankId);
  }, [banks, selectedBankId]);

  const handleOpenBankModal = (item: any | null, isBulk: boolean = false) => {
    if (isBulk) {
      setItemToSettle(null);
      setNilaiPembayaran(""); // Nilai taken from selection sum
    } else {
      setItemToSettle(item.id);
      setNilaiPembayaran(item.nilai.toString());
    }
    setIsBulkSettle(isBulk);
    setIsBankModalOpen(true);
  };

  const handleConfirmSettle = async () => {
    try {
      let settleData: any;
      
      if (selectedBankId === "cash") {
        settleData = {
          tanggalCair: selectedDate,
          namaBank: "CASH",
          rekeningBank: "KAS TUNAI",
          nilai: parseFloat(nilaiPembayaran) || 0
        };
      } else {
        if (!selectedBankInfo) {
          toast({ title: "Error", description: "Silakan pilih bank terlebih dahulu.", variant: "destructive" });
          return;
        }
        settleData = {
          tanggalCair: selectedDate,
          namaBank: selectedBankInfo.namaBank,
          rekeningBank: selectedBankInfo.nomorRekening,
          nilai: parseFloat(nilaiPembayaran) || 0
        };
      }

      if (isBulkSettle) {
        let successCount = 0;
        const idsToProcess = Array.from(markedIds);
        for (const id of idsToProcess) {
          await markSettledMutation.mutateAsync({ id, data: settleData });
          successCount++;
        }
        toast({ title: "Success", description: `${successCount} transaksi berhasil dicairkan.` });
        setMarkedIds(new Set());
      } else if (itemToSettle !== null) {
        await markSettledMutation.mutateAsync({ id: itemToSettle, data: settleData });
        toast({ title: "Success", description: `Transaksi berhasil dicairkan.` });
      }

      queryClient.invalidateQueries({ queryKey: ["/api/pencairan"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/pencairan/transaksi-bank"] });
      setIsBankModalOpen(false);
      setItemToSettle(null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleMark = (id: number) => {
    setMarkedIds(prev => {
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

  const onlineShopPending = useMemo(() => {
    let items = data?.filter(x => (x.status === 'pending' || x.status === 'partial') && x.paymentMethod === 'online_shop') || [];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        formatDate(item.tanggal).toLowerCase().includes(query) ||
        item.kodeTransaksi.toLowerCase().includes(query) ||
        (item.noFaktur || "").toLowerCase().includes(query) ||
        item.namaBarang.toLowerCase().includes(query) ||
        (item.namaOnlineShop || "").toLowerCase().includes(query)
      );
    }
    return [...items].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [data, searchQuery]);

  const kreditPending = useMemo(() => {
    let items = data?.filter(x => (x.status === 'pending' || x.status === 'partial') && x.paymentMethod === 'kredit') || [];
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        formatDate(item.tanggal).toLowerCase().includes(query) ||
        item.kodeTransaksi.toLowerCase().includes(query) ||
        (item.noFaktur || "").toLowerCase().includes(query) ||
        item.namaBarang.toLowerCase().includes(query) ||
        (item.namaCustomer || "").toLowerCase().includes(query)
      );
    }
    return [...items].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [data, searchQuery]);

  const totalMarked = useMemo(() => {
    return Array.from(markedIds).reduce((sum, id) => {
      const item = data?.find(x => x.id === id);
      return sum + (item?.nilai || 0);
    }, 0);
  }, [markedIds, data]);

  const totalOnlineShopMarked = useMemo(() => {
    return Array.from(markedIds).reduce((sum, id) => {
      const item = onlineShopPending.find(x => x.id === id);
      return sum + (item ? (item.nilai || 0) : 0);
    }, 0);
  }, [markedIds, onlineShopPending]);

  const bankSummaries = useMemo(() => {
    if (!bankTransactions) return [];
    
    // Group by Date first
    const dailyGroups: Record<string, { date: string; banks: Record<string, any>; total: number }> = {};
    
    bankTransactions.forEach(tx => {
      const dateKey = tx.tanggalCair || "Unknown";
      if (!dailyGroups[dateKey]) {
        dailyGroups[dateKey] = { date: dateKey, banks: {}, total: 0 };
      }
      
      const bankKey = `${tx.namaBank}-${tx.rekeningBank}`;
      if (!dailyGroups[dateKey].banks[bankKey]) {
        dailyGroups[dateKey].banks[bankKey] = { bank: tx.namaBank, account: tx.rekeningBank, total: 0, count: 0, items: [] };
      }
      
      const amount = Number(tx.nilai);
      dailyGroups[dateKey].banks[bankKey].total += amount;
      dailyGroups[dateKey].banks[bankKey].count += 1;
      dailyGroups[dateKey].banks[bankKey].items.push(tx);
      dailyGroups[dateKey].total += amount;
    });

    return Object.values(dailyGroups)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(day => ({
        ...day,
        banks: Object.values(day.banks).sort((a: any, b: any) => b.total - a.total)
      }));
  }, [bankTransactions]);

  const currentInstallments = useMemo(() => {
    if (!itemToSettle || !bankTransactions) return [];
    return bankTransactions.filter(tx => tx.penjualanId === itemToSettle)
      .sort((a, b) => new Date(b.tanggalCair).getTime() - new Date(a.tanggalCair).getTime());
  }, [itemToSettle, bankTransactions]);

  return (
    <Layout>
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
              <Wallet className="text-primary" /> Pencairan Dana
            </h1>
            <p className="text-muted-foreground mt-1">Kelola pelunasan dari Online Shop dan Penjualan Kredit.</p>
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari transaksi atau platform..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 bg-secondary/10 border-none ring-1 ring-border"
            />
          </div>
        </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Online Shop Section */}
        <Card className="border-purple-500/20 shadow-lg shadow-purple-500/5">
          <CardHeader className="border-b border-border/50 flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-4">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-purple-400 flex items-center gap-2 uppercase tracking-tighter decoration-purple-500/30 underline-offset-4 underline">
                <Store className="w-5 h-5 text-purple-500" /> Piutang Online Shop
              </CardTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-7">Menunggu pencairan dari dana tertahan marketplace</p>
            </div>
            <div className="flex items-center gap-3">
              {totalOnlineShopMarked > 0 && (
                <div className="mr-4 px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center gap-2">
                   <span className="text-[10px] font-black uppercase text-purple-400">Total Cair:</span>
                   <span className="text-sm font-black text-purple-500 tabular-nums">{formatRupiah(totalOnlineShopMarked)}</span>
                </div>
              )}
              {canEdit && markedIds.size > 0 && Array.from(markedIds).some(id => onlineShopPending.some(p => p.id === id)) && (
                <Button 
                  onClick={() => handleOpenBankModal(null, true)}
                  disabled={markSettledMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold h-9 px-4 text-xs"
                >
                  Lunasi Terpilih
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/10 border-b border-border/30">
                  <tr>
                    <th className="px-4 py-2.5 w-10">
                      <Checkbox 
                        checked={onlineShopPending.length > 0 && onlineShopPending.every(i => markedIds.has(i.id))}
                        onCheckedChange={(checked) => {
                          const newMarked = new Set(markedIds);
                          onlineShopPending.forEach(i => checked ? newMarked.add(i.id) : newMarked.delete(i.id));
                          setMarkedIds(newMarked);
                        }}
                      />
                    </th>
                    <th className="px-4 py-2.5 font-bold uppercase tracking-widest">Tgl TRX</th>
                    <th className="px-4 py-2.5 font-bold uppercase tracking-widest">Faktur / TRX</th>
                    <th className="px-4 py-2.5 font-bold uppercase tracking-widest">Platform / Produk</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase tracking-widest">TOTAL</th>
                    <th className="px-4 py-2.5 text-center font-bold uppercase tracking-widest">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground italic">Memuat data...</td></tr>
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
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatDate(item.tanggal)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground text-xs">{item.noFaktur || '-'}</div>
                        <div className="font-mono text-[9px] text-muted-foreground leading-none">{item.kodeTransaksi}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-black text-purple-400 text-[10px] uppercase block mb-1">{item.namaOnlineShop}</span>
                        <div className="text-xs leading-tight text-muted-foreground">{item.namaBarang}</div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="font-black text-emerald-500">{formatRupiah(item.totalAmount)}</div>
                        <div className="flex flex-col items-end mt-1">
                          {item.status === 'partial' && (
                            <>
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-emerald-500/20 mb-1">Piutang Terbayar</span>
                              <span className="text-[8px] text-orange-400 font-bold italic">Sisa Piutang: {formatRupiah(item.nilai)}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 transition-opacity">
                          {canEdit && <button onClick={() => handleOpenBankModal(item)} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white text-[10px] font-black rounded transition-all uppercase">Cairkan</button>}
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
              {isLoading ? (
                <div className="p-10 text-center text-muted-foreground animate-pulse">Memuat data...</div>
              ) : onlineShopPending.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">Tidak ada data.</div>
              ) : onlineShopPending.map((item: any) => (
                <div key={item.id} className={cn("p-4 mb-3 rounded-xl border transition-all space-y-3", markedIds.has(item.id) ? "bg-primary/10 border-primary/40" : "bg-card/60 border-border/40")}>
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-start">
                      <Checkbox checked={markedIds.has(item.id)} onCheckedChange={() => toggleMark(item.id)} className="mt-1" />
                      <div>
                        <div className="text-[10px] font-black text-purple-500 uppercase tracking-widest">{item.namaOnlineShop}</div>
                        <div className="text-xs font-bold text-foreground mt-0.5">{item.noFaktur || '-'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-[9px] font-black text-muted-foreground uppercase">{formatDate(item.tanggal)}</div>
                       <div className="text-[9px] font-mono text-muted-foreground/60">{item.kodeTransaksi}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground pl-2 border-l-2 border-purple-500/30">{item.namaBarang}</div>
                  <div className="flex justify-between items-center pt-1">
                    <div>
                      <div className="text-sm font-black text-emerald-500">{formatRupiah(item.totalAmount)}</div>
                      {item.status === 'partial' && <div className="text-[8px] text-orange-400 font-bold uppercase tracking-tighter italic">Sisa: {formatRupiah(item.nilai)}</div>}
                    </div>
                    <div className="flex gap-2">
                      {canEdit && <button onClick={() => handleOpenBankModal(item)} className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black rounded-lg uppercase shadow-lg shadow-emerald-500/20">Cairkan</button>}
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
              <CardTitle className="text-orange-400 flex items-center gap-2 uppercase tracking-tighter decoration-orange-500/30 underline-offset-4 underline">
                <CreditCard className="w-5 h-5 text-orange-500" /> Piutang Penjualan Kredit
              </CardTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pl-7">Tagihan jatuh tempo yang belum dibayarkan oleh customer</p>
            </div>
            <div className="flex items-center gap-3">
              {canEdit && markedIds.size > 0 && Array.from(markedIds).some(id => kreditPending.some(p => p.id === id)) && (
                <Button 
                  onClick={() => handleOpenBankModal(null, true)}
                  disabled={markSettledMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold h-9 px-4 text-xs"
                >
                  Lunasi Terpilih
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/10 border-b border-border/30">
                  <tr>
                    <th className="px-4 py-2.5 w-10">
                      <Checkbox 
                        checked={kreditPending.length > 0 && kreditPending.every(i => markedIds.has(i.id))}
                        onCheckedChange={(checked) => {
                          const newMarked = new Set(markedIds);
                          kreditPending.forEach(i => checked ? newMarked.add(i.id) : newMarked.delete(i.id));
                          setMarkedIds(newMarked);
                        }}
                      />
                    </th>
                    <th className="px-4 py-2.5 font-bold uppercase tracking-widest">Tgl TRX</th>
                    <th className="px-4 py-2.5 font-bold uppercase tracking-widest">Faktur / TRX</th>
                    <th className="px-4 py-2.5 font-bold uppercase tracking-widest">Customer / Produk</th>
                    <th className="px-4 py-2.5 text-right font-bold uppercase tracking-widest">TOTAL</th>
                    <th className="px-4 py-2.5 text-center font-bold uppercase tracking-widest">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={6} className="text-center py-12 text-muted-foreground italic">Memuat data...</td></tr>
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
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">{formatDate(item.tanggal)}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-foreground text-xs">{item.noFaktur || '-'}</div>
                        <div className="font-mono text-[9px] text-muted-foreground leading-none">{item.kodeTransaksi}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-black text-orange-400 text-[10px] uppercase block mb-1">{item.namaCustomer}</span>
                        <div className="text-xs leading-tight text-muted-foreground">{item.namaBarang}</div>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="font-black text-orange-500">{formatRupiah(item.totalAmount)}</div>
                        <div className="flex flex-col items-end mt-1">
                          {item.status === 'partial' && (
                            <>
                              <span className="text-[9px] bg-orange-500/10 text-orange-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border border-orange-500/20 mb-1">Terbayar Sebagian</span>
                              <span className="text-[8px] text-orange-400 font-bold italic">Sisa: {formatRupiah(item.nilai)}</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2 transition-opacity">
                          {canEdit && <button onClick={() => handleOpenBankModal(item)} className="px-3 py-1 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white text-[10px] font-black rounded transition-all uppercase">Lunasi</button>}
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
              {isLoading ? (
                <div className="p-10 text-center text-muted-foreground animate-pulse">Memuat data...</div>
              ) : kreditPending.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">Tidak ada piutang kredit.</div>
              ) : kreditPending.map((item: any) => (
                <div key={item.id} className={cn("p-4 mb-3 rounded-xl border transition-all space-y-3", markedIds.has(item.id) ? "bg-primary/10 border-primary/40" : "bg-card/60 border-border/40")}>
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-start">
                      <Checkbox checked={markedIds.has(item.id)} onCheckedChange={() => toggleMark(item.id)} className="mt-1" />
                      <div>
                        <div className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{item.namaCustomer}</div>
                        <div className="text-xs font-bold text-foreground mt-0.5">{item.noFaktur || '-'}</div>
                      </div>
                    </div>
                    <div className="text-right">
                       <div className="text-[9px] font-black text-muted-foreground uppercase">{formatDate(item.tanggal)}</div>
                       <div className="text-[9px] font-mono text-muted-foreground/60">{item.kodeTransaksi}</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground pl-2 border-l-2 border-orange-500/30">{item.namaBarang}</div>
                  <div className="flex justify-between items-center pt-1">
                    <div>
                      <div className="text-sm font-black text-orange-500">{formatRupiah(item.totalAmount)}</div>
                      {item.status === 'partial' && <div className="text-[8px] text-orange-400 font-bold uppercase tracking-tighter italic">Sisa: {formatRupiah(item.nilai)}</div>}
                    </div>
                    <div className="flex gap-2">
                      {canEdit && <button onClick={() => handleOpenBankModal(item)} className="px-4 py-2 bg-emerald-500 text-white text-[10px] font-black rounded-lg uppercase shadow-lg shadow-emerald-500/20">Lunasi</button>}
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
          <CardHeader className="border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between py-4 gap-2">
            <CardTitle className="text-emerald-500 flex items-center gap-2">
              <Building2 className="w-5 h-5" /> Data Pencairan per Bank
            </CardTitle>
            <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                Periode: {periodLabel}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingHistory ? (
              <div className="p-12 text-center text-muted-foreground italic">Memuat riwayat pencairan...</div>
            ) : bankSummaries.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground italic font-medium">Belum ada data pencairan periode ini.</div>
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
                          <div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-indigo-100">{formatDate(dayGroup.date)}</span>
                            <div className="text-[8px] text-indigo-400 font-bold uppercase mt-0.5 tracking-tighter">Riwayat Pencairan Harian</div>
                          </div>
                       </div>
                       <div className="text-[10px] font-black text-muted-foreground uppercase flex items-center gap-3">
                          <span className="opacity-40 tracking-[0.2em] hidden sm:inline">Total Kas Masuk:</span>
                          <span className="bg-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full border border-emerald-500/30 shadow-lg shadow-emerald-500/10 font-black text-xs">{formatRupiah(dayGroup.total)}</span>
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
                                <h3 className="text-sm font-black text-foreground uppercase tracking-tight">{bankGroup.bank}</h3>
                                <p className="text-[10px] font-mono text-muted-foreground tracking-tight">{bankGroup.account}</p>
                              </div>
                            </div>
                            <div className="text-left sm:text-right flex flex-row sm:flex-col justify-between items-center sm:items-end gap-2">
                              <div className="text-xl font-black text-emerald-600 drop-shadow-sm">{formatRupiah(bankGroup.total)}</div>
                              <div className="px-2 py-0.5 bg-emerald-500/10 text-emerald-600 text-[9px] font-black uppercase rounded border border-emerald-500/20">{bankGroup.count} Transaksi</div>
                            </div>
                          </div>

                          {/* Transaction Detail Table for this Bank */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left">
                              <thead className="text-[9px] text-muted-foreground/60 uppercase bg-secondary/5 border-b border-border/10">
                                <tr>
                                  <th className="px-6 py-2 font-bold uppercase tracking-widest">Faktur / TRX</th>
                                  <th className="px-4 py-2 font-bold uppercase tracking-widest">Produk & Brand</th>
                                  <th className="px-4 py-2 font-bold uppercase tracking-widest">Sumber Dana</th>
                                  <th className="px-4 py-2 text-right font-bold uppercase tracking-widest">TOTAL</th>
                                  <th className="px-4 py-2 text-center font-bold uppercase tracking-widest">Aksi</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/10">
                                {bankGroup.items.map((tx: any) => (
                                  <tr key={tx.id} className="hover:bg-emerald-500/[0.01] transition-colors group/row">
                                    <td className="px-6 py-3">
                                      <span className="font-bold text-foreground text-[10px]">{tx.noFaktur || "-"}</span>
                                      <div className="text-[8px] text-muted-foreground/50 font-mono tracking-tighter uppercase">ID: {tx.kodeTransaksi}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="font-bold text-foreground text-[10px]">{tx.namaBarang}</div>
                                      <div className="text-[8px] text-primary font-black uppercase mt-1 tracking-widest">{tx.brand || '-'} • {tx.kodeBarang}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="px-2 py-0.5 bg-secondary/50 rounded-lg font-black text-muted-foreground/60 uppercase tracking-tighter border border-border/10 text-[9px] block mb-1 w-fit">
                                        {tx.sumber.replace('_', ' ')}
                                      </span>
                                      <div className="text-[10px] font-bold text-foreground">
                                        {tx.sumber === 'online_shop' ? tx.namaOnlineShop : tx.namaCustomer}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-emerald-500/80 text-[10px]">{formatRupiah(tx.nilai)}</td>
                                    <td className="px-4 py-3 text-center">
                                      {canEdit && (
                                        <button
                                          onClick={() => {
                                            if (window.confirm('Batalkan pencairan untuk faktur ini? Data akan kembali ke daftar tunggu.')) {
                                              cancelSettledMutation.mutate(tx.penjualanId);
                                            }
                                          }}
                                          disabled={cancelSettledMutation.isPending}
                                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors opacity-0 group-hover/row:opacity-100 disabled:opacity-50"
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
              <Label htmlFor="bank" className="text-xs font-bold uppercase text-muted-foreground">Bank</Label>
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
              <Label className="text-xs font-bold uppercase text-muted-foreground">Tanggal Cair</Label>
              <DatePicker 
                date={selectedDate ? new Date(selectedDate) : undefined}
                onChange={(date) => setSelectedDate(formatDateToYYYYMMDD(date))}
              />
            </div>

            {currentInstallments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Riwayat Pembayaran Sebelumnya</Label>
                <div className="max-h-[120px] overflow-y-auto space-y-1.5 p-2 bg-secondary/10 rounded-xl border border-border/10">
                  {currentInstallments.map((tx: any, idx: number) => (
                    <div key={idx} className="flex justify-between items-center text-[10px] bg-card/60 p-2 rounded-lg border border-border/5">
                      <div className="flex flex-col">
                        <span className="font-black text-foreground">{formatDate(tx.tanggalCair)}</span>
                        <span className="text-[8px] text-muted-foreground uppercase">{tx.namaBank}</span>
                      </div>
                      <span className="font-black text-emerald-500 tabular-nums">{formatRupiah(tx.nilai)}</span>
                    </div>
                  ))}
                  <div className="pt-1.5 mt-1 border-t border-border/20 flex justify-between items-center px-1">
                    <span className="text-[9px] font-black text-muted-foreground uppercase">Total Terbayar</span>
                    <span className="text-[11px] font-black text-emerald-600">{formatRupiah(currentInstallments.reduce((s: number, c: any) => s + Number(c.nilai), 0))}</span>
                  </div>
                </div>
              </div>
            )}

            {!isBulkSettle && (
              <div className="space-y-2">
                <Label htmlFor="nilai" className="text-xs font-bold uppercase text-muted-foreground">Nilai Pembayaran / Cicilan</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">Rp</div>
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
              <div className="p-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20 text-xs">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-emerald-700 font-bold uppercase">Metode Pembayaran:</span>
                  <span className="font-black text-emerald-600">TUNAI / CASH</span>
                </div>
                <div className="text-[10px] text-emerald-500/70 italic">Uang akan dicatat masuk ke saldo Kas Toko.</div>
              </div>
            ) : selectedBankInfo && (
              <div className="p-3 bg-secondary/30 rounded-lg border border-border/50 text-xs">
                <div className="flex justify-between mb-1">
                  <span className="text-muted-foreground">Penerima:</span>
                  <span className="font-bold">{selectedBankInfo.namaBank}</span>
                </div>
                <div className="flex justify-between text-muted-foreground text-[10px]">
                  <span>Nomor Rekening:</span>
                  <span className="font-mono">{selectedBankInfo.nomorRekening}</span>
                </div>
              </div>
            )}

            {itemToSettle && (
              <div className="mt-2 p-3 bg-card rounded-2xl border border-border/50 shadow-inner">
                <div className="flex justify-between items-center mb-2">
                   <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Total Tagihan Saat Ini</span>
                   <span className="text-sm font-black text-foreground">{formatRupiah(data?.find(x => x.id === itemToSettle)?.nilai)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-border/50">
                   <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Sisa Setelah Bayar</span>
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
                    <span className="text-[8px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-orange-500/20">Akan dicatat sebagai Cicilan</span>
                  </div>
                )}
              </div>
            )}

            {isBulkSettle && (
              <div className="mt-2 p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                <p className="text-xs text-center font-bold text-emerald-600">
                  Total Dana Cair (Bulk): {formatRupiah(totalMarked)}
                </p>
              </div>
            )}
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
