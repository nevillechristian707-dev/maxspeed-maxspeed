import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useListMasterOnlineShop, useCreateMasterOnlineShop, useDeleteMasterOnlineShop, useGetMe } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Store, Trash2 } from "lucide-react";
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
  };

  return (
    <Layout>
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
          <Store className="text-primary w-8 h-8"/> Master Online Shop
        </h1>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {canAdd && (
        <Card className="h-fit"><CardHeader><CardTitle>Add OS</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input type="text" placeholder="Platform (e.g., Shopee)" required value={form.namaOnlineShop} onChange={e=>setForm({namaOnlineShop:e.target.value})} className="w-full bg-background border border-border p-2 rounded" />
              <button type="submit" className="w-full py-2 bg-primary text-white rounded font-bold">Save</button>
            </form>
          </CardContent>
        </Card>
        )}
        <Card className={canAdd ? "md:col-span-2" : "md:col-span-3"}>
          <CardContent className="p-0">
             <table className="w-full text-sm text-left"><thead className="bg-secondary/50"><tr><th className="p-3">Platform</th><th className="p-3">Act</th></tr></thead>
             <tbody>{data?.map(b => <tr key={b.id} className="border-b border-border/50"><td className="p-3 font-bold">{b.namaOnlineShop}</td><td className="p-3">{canDelete && <button onClick={()=>deleteMutation.mutate({id: b.id},{onSuccess:()=>queryClient.invalidateQueries()})}><Trash2 className="w-4 h-4 text-destructive"/></button>}</td></tr>)}</tbody>
             </table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
