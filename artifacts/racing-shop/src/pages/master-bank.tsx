import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListMasterBank, useCreateMasterBank, useDeleteMasterBank, useListTransaksiBank, useGetMe } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Landmark, Plus, Trash2, History, CreditCard, Search, Calendar, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatRupiah, formatDate, getIndonesianPeriodLabel, cn } from "@/lib/utils";
import { useMonthYear } from "@/context/month-year-context";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function MasterBank() {
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
  const { data: banks, isLoading: loadingBanks } = useListMasterBank();
  const { data: transactions, isLoading: loadingTx } = useListTransaksiBank(dateParams);
  const { data: user } = useGetMe();
  const createMutation = useCreateMasterBank();
  const deleteMutation = useDeleteMasterBank();

  const checkPermission = (menu: string, action: string) => {
    const role = String(user?.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('superadmin')) return true;
    const permissions = (user as any)?.permissions || {};
    const perms = permissions[menu] || permissions[menu.toLowerCase()] || [];
    return perms.some((p: string) => p.toLowerCase() === action.toLowerCase());
  };

  const canAdd = checkPermission('Master Bank', 'add');
  const canDelete = checkPermission('Master Bank', 'delete');


  const [form, setForm] = useState({ namaBank: "", nomorRekening: "", keterangan: "" });
  const [searchTerm, setSearchTerm] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({ data: form });
      toast({ title: "Berhasil", description: "Master bank berhasil ditambahkan." });
      setForm({ namaBank: "", nomorRekening: "", keterangan: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/master-bank"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Hapus master bank ini?")) {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/master-bank"] });
    }
  };

  const bankStats = useMemo(() => {
    if (!banks) return [];
    
    return banks.map(bank => {
      // Handle case where transactions might be loading or null
      const bankTxs = (transactions || []).filter(tx => 
        tx.namaBank === bank.namaBank && tx.rekeningBank === bank.nomorRekening
      );
      const totalNilai = bankTxs.reduce((sum, tx) => sum + Number(tx.nilai), 0);
      return {
        ...bank,
        totalNilai,
        txCount: bankTxs.length,
        transactions: bankTxs
      };
    });
  }, [banks, transactions]);

  const filteredBanks = useMemo(() => {
    return bankStats.filter(b => 
      b.namaBank.toLowerCase().includes(searchTerm.toLowerCase()) || 
      b.nomorRekening.includes(searchTerm)
    );
  }, [bankStats, searchTerm]);

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-neu-text flex items-center gap-3">
            <Landmark className="text-neu-accent w-8 h-8"/> Master Bank
          </h1>
          <p className="text-neu-text mt-1 text-sm font-black">Kelola data perbankan dan lihat riwayat dana masuk.</p>
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

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Cari bank atau rekening..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-secondary/20 border-none ring-1 ring-border"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Top KPI bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
          <div className="text-xs font-black uppercase tracking-widest text-neu-text/60">
            Periode: <span className="text-neu-text">{getIndonesianPeriodLabel(selectedMonth, selectedYear)}</span>
          </div>
          <div className="bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20 flex items-center gap-3">
            <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700/80">Total Dana Masuk</div>
            <div className="text-base font-black text-emerald-600 tabular-nums">
              {formatRupiah(transactions?.reduce((s, t) => s + Number(t.nilai), 0) || 0)}
            </div>
          </div>
        </div>

        {/* Form — compact, horizontal, full-width */}
        {canAdd && (
        <Card className="border-primary/20 shadow-sm">
          <CardContent className="py-5">
            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-[10px] font-black uppercase text-neu-text tracking-widest ml-1 flex items-center gap-1.5">
                  <Plus className="w-3 h-3 text-primary" /> Nama Bank
                </label>
                <Input type="text" placeholder="Contoh: BCA, MANDIRI, BRI" required value={form.namaBank} onChange={e=>setForm({...form, namaBank:e.target.value.toUpperCase()})} />
              </div>
              <div className="md:col-span-5 space-y-1.5">
                <label className="text-[10px] font-black uppercase text-neu-text tracking-widest ml-1">Nomor Rekening</label>
                <Input type="text" placeholder="Masukkan angka rekening" required value={form.nomorRekening} onChange={e=>setForm({...form, nomorRekening:e.target.value})} />
              </div>
              <div className="md:col-span-3">
                <button type="submit" disabled={createMutation.isPending} className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md shadow-primary/20 active:scale-95">
                  {createMutation.isPending ? "Menyimpan..." : "Simpan Bank"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
        )}

        {/* Bank list — horizontal grid of cards */}
        <Card className="border-border/40 overflow-hidden">
          <CardHeader className="border-b border-border/50 py-4 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Daftar Bank Aktif
            </CardTitle>
            {filteredBanks.length > 0 && (
              <span className="text-[10px] font-black uppercase tracking-widest text-neu-text/60 bg-neu-bg/60 px-2.5 py-1 rounded-full border border-border/30">
                {filteredBanks.length} BANK
              </span>
            )}
          </CardHeader>
          <CardContent className="p-4">
            {loadingBanks ? (
              <div className="p-8 text-center text-sm text-neu-text font-black italic">Memuat data bank...</div>
            ) : filteredBanks.length === 0 ? (
              <div className="p-8 text-center text-sm text-neu-text font-black italic">Tidak ada bank terdaftar.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredBanks.map(bank => (
                  <div key={bank.id} className="p-4 rounded-xl bg-neu-bg/40 border border-border/20 flex items-start justify-between gap-3 hover:border-primary/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="font-black text-neu-text flex items-center gap-2 mb-1">
                        <span className="truncate">{bank.namaBank}</span>
                        <span className="text-[10px] font-black tracking-tighter px-1.5 py-0.5 bg-primary/10 text-primary rounded border border-primary/20 flex-shrink-0">{bank.txCount} Trx</span>
                      </div>
                      <div className="text-xs font-mono font-black text-neu-accent truncate">{bank.nomorRekening}</div>
                    </div>
                    {canDelete && (
                      <button onClick={()=>handleDelete(bank.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all flex-shrink-0" title="Hapus bank">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Riwayat Pencairan — full-width table */}
        <Card className="border-orange-500/20 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-border/50 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-orange-500 flex items-center gap-2">
                <History className="w-5 h-5" /> Riwayat Pencairan Dana
              </CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1 text-xs">
                <Calendar className="w-3 h-3" /> {getIndonesianPeriodLabel(selectedMonth, selectedYear)} • {transactions?.length || 0} transaksi
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-xs font-black text-neu-text uppercase bg-neu-bg/50 border-b border-neu-bg">
                    <tr>
                      <th className="px-6 py-4 font-black tracking-widest uppercase">Tanggal Cair</th>
                      <th className="px-4 py-4 font-black tracking-widest uppercase">Bank</th>
                      <th className="px-4 py-4 font-black tracking-widest uppercase">Faktur / Sumber</th>
                      <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {loadingTx ? (
                      <tr><td colSpan={4} className="text-center py-12 text-muted-foreground italic">Memuat riwayat transaksi...</td></tr>
                    ) : transactions?.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-12 text-muted-foreground italic">Belum ada transaksi di periode ini.</td></tr>
                    ) : (transactions || []).sort((a,b) => new Date(b.tanggalCair).getTime() - new Date(a.tanggalCair).getTime()).map((tx, idx) => (
                      <tr key={idx} className="hover:bg-primary/[0.02] transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-black text-sm text-neu-text">{formatDate(tx.tanggalCair)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-black text-neu-accent">{tx.namaBank}</div>
                          <div className="text-xs font-black font-mono text-neu-text tracking-tighter">{tx.rekeningBank}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-black text-neu-text">{tx.noFaktur || "-"}</div>
                          <div className="text-xs font-black uppercase text-neu-text tracking-widest">{tx.sumber}</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm font-black text-emerald-500">{formatRupiah(Number(tx.nilai))}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="md:hidden divide-y divide-border/20 p-2">
                {loadingTx ? (
                  <div className="p-10 text-center text-muted-foreground animate-pulse italic">Memuat data...</div>
                ) : transactions?.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground font-bold">Tidak ada riwayat.</div>
                ) : (transactions || []).sort((a,b) => new Date(b.tanggalCair).getTime() - new Date(a.tanggalCair).getTime()).map((tx, idx) => (
                  <div key={idx} className="p-4 bg-card/60 my-2 rounded-xl border border-border/20 space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="text-xs font-medium tracking-tight font-black text-primary uppercase tracking-widest">{formatDate(tx.tanggalCair)}</div>
                      <div className="text-xs font-medium tracking-tight font-black text-foreground uppercase bg-secondary/50 px-2 py-0.5 rounded tracking-tighter">{tx.namaBank}</div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-bold text-foreground">{tx.noFaktur || "-"}</div>
                        <div className="text-xs italic tracking-tighter text-muted-foreground font-black uppercase tracking-tighter">{tx.sumber}</div>
                      </div>
                      <div className="text-sm font-black text-emerald-500">{formatRupiah(Number(tx.nilai))}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
      </div>
    </Layout>
  );
}
