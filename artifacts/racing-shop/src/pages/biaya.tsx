import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListBiaya, useCreateBiaya, useDeleteBiaya, useGetMe } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { DatePicker } from "@/components/ui/date-picker";
import { formatRupiah, formatDate, formatDateToYYYYMMDD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Receipt, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { useMonthYear } from "@/context/month-year-context";
import { Calendar } from "lucide-react";

export default function Biaya() {
  const { selectedYear, selectedMonth, setSelectedYear, setSelectedMonth, dateParams } = useMonthYear();
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
  
  const { data, isLoading } = useListBiaya(dateParams);
  const createMutation = useCreateBiaya({
    mutation: {
      onMutate: async (newBiaya) => {
        await queryClient.cancelQueries({ queryKey: ["/api/biaya", dateParams] });
        const previousData = queryClient.getQueryData(["/api/biaya", dateParams]);
        
        queryClient.setQueryData(["/api/biaya", dateParams], (old: any) => {
          const newItem = { 
            id: Math.random(),
            ...newBiaya.data,
          };
          return [newItem, ...(old || [])];
        });
        
        return { previousData };
      },
      onError: (err, newBiaya, context: any) => {
        queryClient.setQueryData(["/api/biaya", dateParams], context.previousData);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/biaya"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/chart"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/profit"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/top-products"] });
      }
    }
  });

  const deleteMutation = useDeleteBiaya({
    mutation: {
      onMutate: async ({ id }: { id: number }) => {
        await queryClient.cancelQueries({ queryKey: ["/api/biaya", dateParams] });
        const previousData = queryClient.getQueryData(["/api/biaya", dateParams]);
        
        queryClient.setQueryData(["/api/biaya", dateParams], (old: any) => 
          (old || []).filter((item: any) => item.id !== id)
        );
        
        return { previousData };
      },
      onError: (err, variables, context: any) => {
        queryClient.setQueryData(["/api/biaya", dateParams], context.previousData);
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/biaya"] });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/profit"] });
        queryClient.invalidateQueries({ queryKey: ["/api/laporan/top-products"] });
      }
    }
  });
  
  const { data: user } = useGetMe();
  const checkPermission = (action: string) => {
    const role = String(user?.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('superadmin')) return true;
    const permissions = (user as any)?.permissions || {};
    const perms = permissions['Biaya'] || permissions['biaya'] || [];
    return perms.some((p: string) => p.toLowerCase() === action.toLowerCase());
  };

  const canAdd = checkPermission('add');
  const canDelete = checkPermission('delete');

  const [form, setForm] = useState({
    tanggal: formatDateToYYYYMMDD(new Date()),
    keterangan: "",
    nilai: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        data: {
          tanggal: form.tanggal,
          keterangan: form.keterangan,
          nilai: Number(form.nilai)
        }
      });
      toast({ title: "Berhasil", description: "Biaya operasional dicatat." });
      setForm((prev: any) => ({ ...prev, keterangan: "", nilai: "" }));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Hapus biaya ini?")) {
      try {
        await deleteMutation.mutateAsync({ id });
        toast({ title: "Berhasil", description: "Catatan biaya dihapus." });
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    }
  };

  const totalBiaya = data?.reduce((sum: number, item: any) => sum + item.nilai, 0) || 0;

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-neu-text flex items-center gap-3">
            <Receipt className="text-neu-accent w-8 h-8" /> Biaya Operasional
          </h1>
          <p className="text-neu-text mt-1 text-sm font-black">Kelola pencatatan biaya pengeluaran toko.</p>
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {canAdd && (
        <Card className="md:col-span-1 h-fit border-primary/20">
          <CardHeader className="bg-secondary/50 border-b border-border/50">
            <CardTitle className="text-lg font-black text-neu-text">Input Biaya</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-black text-neu-text">Tanggal</label>
                <DatePicker 
                  date={form.tanggal ? new Date(form.tanggal) : undefined}
                  onChange={(date) => setForm({...form, tanggal: formatDateToYYYYMMDD(date)})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-black text-neu-text">Keterangan</label>
                <input 
                  type="text" 
                  required
                  placeholder="Misal: Listrik, Internet, Bensin"
                  value={form.keterangan}
                  onChange={e => setForm({...form, keterangan: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary font-bold" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-black text-neu-text">Nilai (Rp)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={form.nilai}
                  onChange={e => setForm({...form, nilai: e.target.value})}
                  onFocus={() => { if (form.nilai === "0") setForm({...form, nilai: ""}); }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary font-bold" 
                />
              </div>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="w-full font-black py-6"
              >
                <Plus className="w-4 h-4 mr-2" /> Simpan Biaya
              </Button>
            </form>
          </CardContent>
        </Card>
        )}

        <Card className={canAdd ? "md:col-span-2" : "md:col-span-3"}>
            <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-black text-neu-text">Daftar Biaya Operasional</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-neu-text">Total:</span>
                <span className="font-black text-rose-600 text-lg">{formatRupiah(totalBiaya)}</span>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead className="text-xs font-black text-neu-text uppercase bg-neu-bg/50 border-b border-neu-bg">
                  <tr>
                    <th className="px-6 py-4 font-black tracking-widest uppercase">Tanggal</th>
                    <th className="px-4 py-4 font-black tracking-widest uppercase">Keterangan</th>
                    <th className="px-4 py-4 text-right font-black tracking-widest uppercase">Nilai</th>
                    <th className="px-4 py-4 text-center font-black tracking-widest uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {isLoading ? (
                     <tr><td colSpan={4} className="text-center py-8 text-neu-text font-black uppercase">Memuat data...</td></tr>
                  ) : data?.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-neu-text font-black uppercase">Tidak ada pencatatan biaya pada periode ini.</td></tr>
                  ) : data?.map(item => (
                    <tr key={item.id} className="hover:bg-primary/[0.02] transition-colors border-b border-border/10">
                      <td className="px-6 py-4 whitespace-nowrap text-neu-text font-black">{formatDate(item.tanggal)}</td>
                      <td className="px-4 py-4 font-black text-neu-text">{item.keterangan}</td>
                      <td className="px-4 py-4 text-right font-black text-rose-600">{formatRupiah(item.nilai)}</td>
                      <td className="px-4 py-4 text-center">
                        {canDelete && (
                          <button onClick={() => handleDelete(item.id)} className="p-2 text-rose-600 hover:bg-rose-600/10 rounded-lg transition-colors border border-rose-600/20">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List */}
            <div className="md:hidden divide-y divide-border/20 p-2">
              {isLoading ? (
                  <div className="text-center py-10 text-neu-text font-black uppercase">Memuat data...</div>
               ) : data?.length === 0 ? (
                 <div className="text-center py-10 text-neu-text font-black uppercase">Tidak ada data biaya.</div>
              ) : data?.map(item => (
                <div key={item.id} className="p-4 space-y-2 bg-card/60 my-2 rounded-xl border border-border/20">
                  <div className="flex justify-between items-start">
                    <div className="text-xs font-black uppercase text-primary tracking-widest">{formatDate(item.tanggal)}</div>
                    {canDelete && (
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-rose-600 bg-rose-600/5 rounded-lg border border-rose-600/20">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="text-sm font-black text-neu-text">{item.keterangan}</div>
                  <div className="text-lg font-black text-rose-600">{formatRupiah(item.nilai)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
