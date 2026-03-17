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
  const { dateParams, selectedMonth, selectedYear } = useMonthYear();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: banks, isLoading: loadingBanks } = useListMasterBank();
  const { data: transactions, isLoading: loadingTx } = useListTransaksiBank(dateParams);
  const { data: user } = useGetMe();
  const createMutation = useCreateMasterBank();
  const deleteMutation = useDeleteMasterBank();

  const checkPermission = (menu: string, action: string) => {
    const role = user?.role?.toLowerCase() || '';
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
    if (!banks || !transactions) return [];
    
    return banks.map(bank => {
      const bankTxs = transactions.filter(tx => tx.namaBank === bank.namaBank && tx.rekeningBank === bank.nomorRekening);
      const totalNilai = bankTxs.reduce((sum, tx) => sum + Number(tx.nilai), 0);
      return {
        ...bank,
        totalNilai,
        txCount: bankTxs.length,
        transactions: bankTxs
      };
    });
  }, [banks, transactions]);

  const filteredBanks = bankStats.filter(b => 
    b.namaBank.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.nomorRekening.includes(searchTerm)
  );

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Landmark className="text-primary"/> Master Bank
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Kelola data perbankan dan lihat riwayat dana masuk.</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Col: Master & Form */}
        <div className="xl:col-span-1 space-y-6">
          {canAdd && (
          <Card className="border-primary/20 shadow-lg shadow-primary/5">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="w-4 h-4 text-primary" /> Tambah Bank Baru
              </CardTitle>
              <CardDescription className="text-[10px] uppercase font-bold tracking-wider">Informasi Rekening Utama</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nama Bank</label>
                  <Input type="text" placeholder="Contoh: BCA, MANDIRI, BRI" required value={form.namaBank} onChange={e=>setForm({...form, namaBank:e.target.value.toUpperCase()})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-muted-foreground ml-1">Nomor Rekening</label>
                  <Input type="text" placeholder="Masukkan angka rekening" required value={form.nomorRekening} onChange={e=>setForm({...form, nomorRekening:e.target.value})} />
                </div>
                <button type="submit" disabled={createMutation.isPending} className="w-full py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold transition-all shadow-md shadow-primary/20">
                  {createMutation.isPending ? "Menyimpan..." : "Simpan Master Bank"}
                </button>
              </form>
            </CardContent>
          </Card>
          )}

          <Card className="border-border/40 overflow-hidden">
            <CardHeader className="bg-secondary/10 py-4">
              <CardTitle className="text-base">Daftar Bank Aktif</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/30">
                {loadingBanks ? (
                  <div className="p-8 text-center text-xs text-muted-foreground italic">Memuat data bank...</div>
                ) : filteredBanks.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground italic">Tidak ada bank terdaftar.</div>
                ) : filteredBanks.map(bank => (
                  <div key={bank.id} className="p-4 flex justify-between items-center transition-colors">
                    <div>
                      <div className="font-black text-foreground flex items-center gap-2">
                        {bank.namaBank}
                        <span className="text-[9px] px-1.5 py-0.5 bg-secondary text-muted-foreground rounded">{bank.txCount} Trx</span>
                      </div>
                      <div className="text-xs font-mono text-primary mt-0.5">{bank.nomorRekening}</div>
                    </div>
                    {canDelete && (
                      <button onClick={()=>handleDelete(bank.id)} className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Col: Transactions History */}
        <div className="xl:col-span-2">
          <Card className="border-orange-500/20 shadow-xl shadow-orange-500/5 h-full flex flex-col">
            <CardHeader className="border-b border-border/50 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-orange-500 flex items-center gap-2">
                  <History className="w-5 h-5" /> Riwayat Pencairan Dana
                </CardTitle>
                <CardDescription className="flex items-center gap-2 mt-1">
                  <Calendar className="w-3 h-3" /> {getIndonesianPeriodLabel(selectedMonth, selectedYear)}
                </CardDescription>
              </div>
              <div className="bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                <div className="text-[10px] font-bold text-emerald-600/70 uppercase leading-none mb-1">Total Dana Masuk</div>
                <div className="text-xl font-black text-emerald-600">
                  {formatRupiah(transactions?.reduce((s, t) => s + Number(t.nilai), 0) || 0)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-grow">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/20 border-b border-border/30">
                    <tr>
                      <th className="px-6 py-3 font-bold">Tanggal Cair</th>
                      <th className="px-4 py-3 font-bold">Bank</th>
                      <th className="px-4 py-3 font-bold">Faktur / Sumber</th>
                      <th className="px-4 py-3 text-right font-bold">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {loadingTx ? (
                      <tr><td colSpan={4} className="text-center py-12 text-muted-foreground italic">Memuat riwayat transaksi...</td></tr>
                    ) : transactions?.length === 0 ? (
                      <tr><td colSpan={4} className="text-center py-12 text-muted-foreground italic">Belum ada transaksi di periode ini.</td></tr>
                    ) : (transactions || []).sort((a,b) => new Date(b.tanggalCair).getTime() - new Date(a.tanggalCair).getTime()).map((tx, idx) => (
                      <tr key={idx} className="hover:bg-secondary/10 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-bold text-xs">{formatDate(tx.tanggalCair)}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xs font-black text-primary">{tx.namaBank}</div>
                          <div className="text-[9px] font-mono text-muted-foreground">{tx.rekeningBank}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-xs font-bold text-foreground">{tx.noFaktur || "N/A"}</div>
                          <div className="text-[9px] uppercase font-bold text-muted-foreground/60">{tx.sumber}</div>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="text-sm font-black text-emerald-500">{formatRupiah(Number(tx.nilai))}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
