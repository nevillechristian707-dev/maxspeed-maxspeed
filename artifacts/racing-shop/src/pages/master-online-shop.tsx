import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListMasterOnlineShop, useCreateMasterOnlineShop, useDeleteMasterOnlineShop, useGetMe } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MasterOnlineShop() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data } = useListMasterOnlineShop();
  const createMutation = useCreateMasterOnlineShop();
  const deleteMutation = useDeleteMasterOnlineShop();
  const [form, setForm] = useState({ namaOnlineShop: "" });

  const { data: user } = useGetMe();
  const checkPermission = (action: string) => {
    const role = String(user?.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('superadmin')) return true;
    const permissions = (user as any)?.permissions || {};
    const perms = permissions['Master Online Shop'] || permissions['master online shop'] || [];
    return perms.some((p: string) => p.toLowerCase() === action.toLowerCase());
  };

  const canAdd = checkPermission('add');
  const canDelete = checkPermission('delete');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({ data: form });
    setForm({ namaOnlineShop: "" });
    queryClient.invalidateQueries({ queryKey: ["/api/master-online-shop"] });
    toast({ title: "Berhasil", description: "Platform online shop ditambahkan." });
  };

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-neu-text flex items-center gap-3">
            <Store className="text-neu-accent w-8 h-8"/> Master Online Shop
          </h1>
          <p className="text-neu-text mt-1 text-sm font-black">Kelola platform online shop untuk pencairan dana.</p>
        </div>
      </div>
      <div className="max-w-5xl mx-auto grid md:grid-cols-3 gap-6">
        {canAdd && (
        <Card className="h-fit nm-flat bg-neu-bg">
          <CardHeader className="bg-secondary/30 border-b border-border/50">
            <CardTitle className="text-lg font-black text-neu-text">Tambah Platform</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-neu-text tracking-widest pl-1">Nama Platform</label>
                <input 
                  type="text" 
                  placeholder="Misal: Shopee, Tokopedia, TikTok" 
                  required 
                  value={form.namaOnlineShop} 
                  onChange={e=>setForm({namaOnlineShop:e.target.value})} 
                  className="w-full bg-neu-bg nm-inset border-none px-4 py-3 rounded-2xl text-neu-text font-black outline-none focus:ring-2 ring-neu-accent/20" 
                />
              </div>
              <button type="submit" className="w-full py-4 bg-primary text-white rounded-2xl font-black shadow-lg shadow-primary/20 flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95">
                <Plus className="w-5 h-5" /> SIMPAN PLATFORM
              </button>
            </form>
          </CardContent>
        </Card>
        )}
        <Card className={canAdd ? "md:col-span-2 nm-flat bg-neu-bg" : "md:col-span-3 nm-flat bg-neu-bg"}>
          <CardHeader className="border-b border-border/50">
            <CardTitle className="text-lg font-black text-neu-text">Daftar Platform Tersedia</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-neu-bg text-neu-text uppercase text-xs font-black border-b border-neu-bg">
                  <tr>
                    <th className="px-6 py-4 font-black tracking-widest">NAMA PLATFORM ONLINE SHOP</th>
                    <th className="px-6 py-4 font-black text-center tracking-widest">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {data?.length === 0 && (
                    <tr><td colSpan={2} className="px-6 py-12 text-center text-neu-text font-black uppercase">Belum ada platform terdaftar</td></tr>
                  )}
                  {data?.map(b => (
                    <tr key={b.id} className="hover:bg-primary/[0.02] transition-colors">
                      <td className="px-6 py-4 font-black text-neu-text text-base">{b.namaOnlineShop}</td>
                      <td className="px-6 py-4 text-center">
                        {canDelete && (
                          <button onClick={()=>deleteMutation.mutate({id: b.id},{onSuccess:()=>queryClient.invalidateQueries()})} className="p-2 text-rose-600 hover:bg-rose-600/10 rounded-xl border border-rose-600/20 active:scale-90 transition-all">
                            <Trash2 className="w-5 h-5"/>
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
