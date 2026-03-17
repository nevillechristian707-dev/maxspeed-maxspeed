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

export default function Biaya() {
  const { dateParams } = useMonthYear();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const { data, isLoading } = useListBiaya(dateParams);
  const createMutation = useCreateBiaya();
  const deleteMutation = useDeleteBiaya();
  
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
      toast({ title: "Success", description: "Expense recorded." });
      setForm(prev => ({ ...prev, keterangan: "", nilai: "" }));
      queryClient.invalidateQueries({ queryKey: ["/api/biaya"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Hapus biaya ini?")) {
      await deleteMutation.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: ["/api/biaya"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      toast({ title: "Berhasil dihapus" });
    }
  };

  const totalBiaya = data?.reduce((sum, item) => sum + item.nilai, 0) || 0;

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Receipt className="text-primary" /> Biaya Operasional
          </h1>
          <p className="text-muted-foreground mt-1">Kelola pencatatan biaya pengeluaran toko.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {canAdd && (
        <Card className="md:col-span-1 h-fit border-primary/20">
          <CardHeader className="bg-secondary/50 border-b border-border/50">
            <CardTitle className="text-lg">Input Biaya</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Tanggal</label>
                <DatePicker 
                  date={form.tanggal ? new Date(form.tanggal) : undefined}
                  onChange={(date) => setForm({...form, tanggal: formatDateToYYYYMMDD(date)})}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Keterangan</label>
                <input 
                  type="text" 
                  required
                  placeholder="Misal: Listrik, Internet, Bensin"
                  value={form.keterangan}
                  onChange={e => setForm({...form, keterangan: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Nilai (Rp)</label>
                <input 
                  type="number" 
                  required
                  min="0"
                  value={form.nilai}
                  onChange={e => setForm({...form, nilai: e.target.value})}
                  onFocus={() => { if (form.nilai === "0") setForm({...form, nilai: ""}); }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-primary" 
                />
              </div>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="w-full font-bold py-6"
              >
                <Plus className="w-4 h-4 mr-2" /> Simpan Biaya
              </Button>
            </form>
          </CardContent>
        </Card>
        )}

        <Card className={canAdd ? "md:col-span-2" : "md:col-span-3"}>
          <CardHeader className="border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Daftar Biaya Biaya</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="font-bold text-destructive text-lg">{formatRupiah(totalBiaya)}</span>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-secondary/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Keterangan</th>
                  <th className="px-4 py-3 text-right">Nilai</th>
                  <th className="px-4 py-3 text-center">Act</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                   <tr><td colSpan={4} className="text-center py-8">Loading...</td></tr>
                ) : data?.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Tidak ada pencatatan biaya pada periode ini.</td></tr>
                ) : data?.map(item => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.tanggal)}</td>
                    <td className="px-4 py-3 font-medium">{item.keterangan}</td>
                    <td className="px-4 py-3 text-right font-bold text-destructive">{formatRupiah(item.nilai)}</td>
                    <td className="px-4 py-3 text-center">
                      {canDelete && (
                        <button onClick={() => handleDelete(item.id)} className="p-2 text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
