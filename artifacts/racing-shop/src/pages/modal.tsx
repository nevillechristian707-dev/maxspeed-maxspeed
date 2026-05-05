import { useState } from "react";
import { useListModal, useGetMe } from "@workspace/api-client-react";
import { useMonthYear } from "@/context/month-year-context";
import { Layout } from "@/components/layout";
import { formatRupiah, formatDate, formatDateToYYYYMMDD } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Briefcase, Printer, Filter, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Modal() {
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

  const { data, isLoading } = useListModal(dateParams);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Briefcase className="text-primary w-8 h-8" /> Analisa Modal & Margin
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Evaluasi perbandingan harga beli vs harga jual secara mendalam.</p>
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
          
          <div className="w-px h-8 bg-border/50 mx-2 hidden md:block" />
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
        <CardContent className="p-0">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs font-medium tracking-tight text-muted-foreground uppercase bg-secondary/40 border-b border-border/50">
                <tr>
                  <th className="px-6 py-4 font-black tracking-widest uppercase">Tgl</th>
                  <th className="px-4 py-4 font-black tracking-widest uppercase">TRX</th>
                  <th className="px-4 py-4 font-black tracking-widest uppercase">Barang</th>
                  <th className="px-4 py-4 text-center font-black tracking-widest uppercase">Qty</th>
                  <th className="px-4 py-4 text-right font-black tracking-widest text-orange-500 uppercase">Tot Modal</th>
                  <th className="px-4 py-4 text-right font-black tracking-widest text-blue-500 uppercase">Tot Jual</th>
                  <th className="px-4 py-4 text-right font-black tracking-widest text-emerald-500 uppercase">Laba</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-20 text-muted-foreground italic font-medium">Memuat data analisa...</td></tr>
                ) : data?.items.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-20 text-muted-foreground italic font-medium uppercase font-black tracking-tighter opacity-30">Belum ada data pada periode ini.</td></tr>
                ) : data?.items.map(item => {
                  const laba = item.total - item.totalModal;
                  return (
                    <tr key={item.id} className="hover:bg-primary/[0.03] transition-colors group/row">
                      <td className="px-6 py-4 whitespace-nowrap text-muted-foreground/80 font-medium">{formatDate(item.tanggal)}</td>
                      <td className="px-4 py-4 font-mono text-xs text-primary font-black tracking-tighter">{item.kodeTransaksi}</td>
                      <td className="px-4 py-4 font-bold text-foreground group-hover/row:text-primary transition-colors">{item.namaBarang}</td>
                      <td className="px-4 py-4 text-center font-black tabular-nums">{item.qty}</td>
                      <td className="px-4 py-4 text-right font-black text-orange-500/80 tabular-nums">{formatRupiah(item.totalModal)}</td>
                      <td className="px-4 py-4 text-right font-black text-blue-500/80 tabular-nums">{formatRupiah(item.total)}</td>
                      <td className="px-4 py-4 text-right font-black text-emerald-500 tabular-nums">{formatRupiah(laba)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-border/20 p-2">
            {isLoading ? (
               <div className="text-center py-20 text-muted-foreground animate-pulse font-black uppercase tracking-widest text-xs">Sedang Menganalisa...</div>
            ) : data?.items.length === 0 ? (
               <div className="text-center py-10 text-muted-foreground italic font-black uppercase tracking-widest text-xs opacity-50">Tidak ada rincian data.</div>
            ) : data?.items.map(item => {
              const laba = item.total - item.totalModal;
              return (
                <div key={item.id} className="p-4 bg-card/60 my-2 rounded-2xl border border-border/20 space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                       <div className="text-[10px] font-black text-primary uppercase tracking-widest">{formatDate(item.tanggal)}</div>
                       <div className="text-[9px] font-mono text-muted-foreground/60 tracking-tighter uppercase">{item.kodeTransaksi}</div>
                    </div>
                    <div className="text-right">
                       <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Profit</div>
                       <div className="text-xs font-black text-emerald-500 whitespace-nowrap">{formatRupiah(laba)}</div>
                    </div>
                  </div>
                  
                  <div className="px-3 py-2 bg-secondary/30 rounded-lg border border-border/10">
                     <div className="text-xs font-black text-foreground leading-tight">{item.namaBarang}</div>
                     <div className="text-[9px] font-black text-primary/80 mt-1 uppercase tracking-widest">{item.qty} Unit</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                     <div className="bg-orange-500/5 p-2 rounded-xl border border-orange-500/10">
                        <div className="text-[8px] font-black text-orange-400 uppercase tracking-widest">Modal Pokok</div>
                        <div className="text-xs font-black text-orange-500">{formatRupiah(item.totalModal)}</div>
                     </div>
                     <div className="bg-blue-500/5 p-2 rounded-xl border border-blue-500/10">
                        <div className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Penjualan</div>
                        <div className="text-xs font-black text-blue-500">{formatRupiah(item.total)}</div>
                     </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
