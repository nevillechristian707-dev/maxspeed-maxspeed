import { useState } from "react";
import { useListModal, useGetMe } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatRupiah, formatDate, formatDateToYYYYMMDD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Printer, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Modal() {
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [y, m] = filterMonth.split('-');
  const startDate = `${y}-${m}-01`;
  const endDate = formatDateToYYYYMMDD(new Date(Number(y), Number(m), 0));

  const { data, isLoading } = useListModal({ startDate, endDate });
  const { data: user } = useGetMe();
  const canPrint = (() => {
    const role = String(user?.role || '').toLowerCase();
    if (role.includes('admin') || role.includes('superadmin')) return true;
    const permissions = (user as any)?.permissions || {};
    const perms = permissions['Modal'] || permissions['modal'] || [];
    return perms.some((p: string) => p.toLowerCase() === 'export');
  })();


  return (
    <Layout>
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3 uppercase tracking-tighter">
            <Briefcase className="text-primary w-8 h-8" /> Analisa Modal & Margin
          </h1>
          <p className="text-muted-foreground mt-1 font-medium italic">Evaluasi perbandingan harga beli vs harga jual secara mendalam.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary/50 px-3 py-2 rounded-xl border border-border/50">
            <Filter className="w-4 h-4 text-primary" />
            <input 
              type="month" 
              value={filterMonth}
              onChange={e => setFilterMonth(e.target.value)}
              className="bg-transparent text-sm font-black outline-none cursor-pointer uppercase"
            />
          </div>
          {canPrint && (
            <Button variant="outline" onClick={() => window.print()} className="bg-primary/5 text-primary border-primary/20 hover:bg-primary hover:text-white transition-all font-bold">
              <Printer className="w-4 h-4 mr-2" /> CETAK ANALISA
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20 shadow-xl shadow-blue-500/5 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 p-8 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors" />
          <CardContent className="p-6 relative z-10">
            <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-2">Total Penjualan</p>
            <p className="text-3xl font-black text-foreground tracking-tight tabular-nums">{formatRupiah(data?.totalPenjualan)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-transparent border-orange-500/20 shadow-xl shadow-orange-500/5 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 p-8 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-colors" />
          <CardContent className="p-6 relative z-10">
            <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest mb-2">Total Modal Pokok</p>
            <p className="text-3xl font-black text-foreground tracking-tight tabular-nums">{formatRupiah(data?.totalModal)}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20 shadow-xl shadow-emerald-500/5 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 p-8 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <CardContent className="p-6 relative z-10">
            <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-2">Laba Kotor</p>
            <p className="text-3xl font-black text-emerald-500 tracking-tight tabular-nums">{formatRupiah(data?.totalLaba)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/40 shadow-2xl overflow-hidden bg-card/40 backdrop-blur-md">
        <CardHeader className="border-b border-border/50 bg-secondary/10 py-4">
          <CardTitle className="text-lg uppercase tracking-tight font-black flex items-center justify-between">
            Rincian Transaksi
            <span className="text-[10px] bg-secondary/50 px-3 py-1 rounded-full text-muted-foreground font-black tracking-widest">{data?.items.length || 0} DATA</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/40 border-b border-border/50">
              <tr>
                <th className="px-6 py-4 font-black tracking-widest">Tgl</th>
                <th className="px-4 py-4 font-black tracking-widest">TRX</th>
                <th className="px-4 py-4 font-black tracking-widest">Barang</th>
                <th className="px-4 py-4 text-center font-black tracking-widest">Qty</th>
                <th className="px-4 py-4 text-right font-black tracking-widest">H. Beli</th>
                <th className="px-4 py-4 text-right font-black tracking-widest text-orange-500">Tot Modal</th>
                <th className="px-4 py-4 text-right font-black tracking-widest">H. Jual</th>
                <th className="px-4 py-4 text-right font-black tracking-widest text-blue-500">Tot Jual</th>
                <th className="px-4 py-4 text-right font-black tracking-widest text-emerald-500">Laba</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              {isLoading ? (
                 <tr><td colSpan={9} className="text-center py-20 text-muted-foreground italic font-medium">Memuat data analisa...</td></tr>
              ) : data?.items.map(item => {
                const laba = item.total - item.totalModal;
                return (
                  <tr key={item.id} className="hover:bg-primary/[0.03] transition-colors group/row">
                    <td className="px-6 py-4 whitespace-nowrap text-muted-foreground/80 font-medium">{formatDate(item.tanggal)}</td>
                    <td className="px-4 py-4 font-mono text-[10px] text-primary font-black tracking-tighter">{item.kodeTransaksi}</td>
                    <td className="px-4 py-4 font-bold text-foreground group-hover/row:text-primary transition-colors">{item.namaBarang}</td>
                    <td className="px-4 py-4 text-center font-black tabular-nums">{item.qty}</td>
                    <td className="px-4 py-4 text-right text-muted-foreground font-medium tabular-nums">{formatRupiah(item.hargaBeli)}</td>
                    <td className="px-4 py-4 text-right font-black text-orange-500/80 tabular-nums">{formatRupiah(item.totalModal)}</td>
                    <td className="px-4 py-4 text-right text-muted-foreground font-medium tabular-nums">{formatRupiah(item.harga)}</td>
                    <td className="px-4 py-4 text-right font-black text-blue-500/80 tabular-nums">{formatRupiah(item.total)}</td>
                    <td className="px-4 py-4 text-right font-black text-emerald-500 tabular-nums">{formatRupiah(laba)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </Layout>
  );
}
