import { useGetDashboardSummary, useGetDashboardChart } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, ShoppingCart, TrendingUp, TrendingDown, DollarSign, Wallet, Package, Store, CreditCard, Activity, Landmark, Calendar, Printer, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { useState } from "react";
import { motion } from "framer-motion";
import { useMonthYear } from "@/context/month-year-context";

export default function Dashboard() {
  const { selectedYear, selectedMonth, setSelectedYear, setSelectedMonth, dateParams } = useMonthYear();
  const currentYear = new Date().getFullYear();

  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: summary, isLoading: loadingSummary, isError: isErrorSummary, refetch: refetchSummary } = useGetDashboardSummary(dateParams);
  const { data: chartData, isLoading: loadingChart, isError: isErrorChart, error: chartError, refetch: refetchChart } = useGetDashboardChart(dateParams);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchSummary(), refetchChart()]);
    setIsRefreshing(false);
  };

  const ErrorState = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
    <div className="flex flex-col items-center justify-center p-8 bg-card/40 rounded-3xl border border-dashed border-rose-500/20 text-center gap-3">
       <Activity className="w-8 h-8 text-rose-500/50 animate-pulse" />
       <div>
         <p className="text-rose-500 font-black uppercase tracking-widest text-[10px] mb-1">Gagal Memuat Data</p>
         <p className="text-muted-foreground text-[10px] leading-relaxed max-w-[200px] mx-auto">{message}</p>
       </div>
       <button 
         onClick={onRetry} 
         className="px-4 py-2 rounded-xl bg-secondary border border-border text-[9px] font-black uppercase hover:bg-secondary/80 transition-all active:scale-95"
       >
         Coba Lagi
       </button>
    </div>
  );

  if (loadingSummary && !summary) {
    return (
      <Layout>
        <div className="flex flex-col h-64 items-center justify-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
          <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest animate-pulse">Menghubungkan ke Server...</p>
        </div>
      </Layout>
    );
  }

  // Safe formatting for chart data
  const formattedChartData = (chartData?.labels || []).map((label, i) => {
    const date = new Date(label);
    const compactDate = !isNaN(date.getTime()) ? `${date.getDate()}/${date.getMonth() + 1}` : label;
    return {
      name: compactDate,
      fullDate: formatDate(label),
      rawDate: label,
      Penjualan: Number(chartData?.penjualan?.[i] || 0),
      Laba: Number(chartData?.laba?.[i] || 0),
      Transaksi: Number((chartData as any)?.counts?.[i] || 0)
    };
  });

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden relative group border-border/40 hover:border-primary/50 transition-colors h-full">
        <div className={`absolute right-0 top-0 w-24 h-24 bg-gradient-to-br ${colorClass} opacity-10 rounded-bl-full group-hover:scale-110 transition-transform`} />
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{title}</CardTitle>
          <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClass} bg-opacity-20`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-display font-black tracking-tight">{value}</div>
          {subtitle && <p className="text-[9px] text-muted-foreground mt-1 font-bold uppercase tracking-tight">{subtitle}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );

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

  return (
    <Layout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Ringkasan performa finansial Max Speed.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2.5 rounded-2xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-all active:scale-95 disabled:opacity-50"
          >
            <Activity className={cn("w-4 h-4 text-primary", isRefreshing && "animate-spin")} />
          </button>
          
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {isErrorSummary ? (
          <div className="sm:col-span-2 lg:col-span-5">
            <ErrorState message="Gagal memuat ringkasan data finansial." onRetry={refetchSummary} />
          </div>
        ) : (
          <>
            <StatCard 
              title="Total Penjualan" 
              value={formatRupiah(summary?.totalPenjualan)} 
              icon={Activity}
              colorClass="from-blue-500 to-cyan-500"
              subtitle={`${summary?.totalTransaksi || 0} Transaksi`}
            />
            <StatCard 
              title="Total Modal" 
              value={formatRupiah(summary?.totalModal)} 
              icon={Package}
              colorClass="from-orange-500 to-yellow-500"
            />
            <StatCard 
              title="Total Biaya" 
              value={formatRupiah(summary?.totalBiaya)} 
              icon={Receipt}
              colorClass="from-red-500 to-pink-500"
              subtitle="Biaya Operasional"
            />
            <StatCard 
              title="Laba Bersih" 
              value={formatRupiah(summary?.laba)} 
              icon={TrendingUp}
              colorClass="from-primary to-orange-600"
            />
            <StatCard 
              title="Laba Shared (10%)" 
              value={formatRupiah(summary?.labaShared)} 
              icon={Wallet}
              colorClass="from-emerald-500 to-teal-500"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
            <div>
              <CardTitle className="text-lg uppercase font-black tracking-tight">Rekapan Harian: Penjualan & Laba</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-1 font-bold uppercase tracking-widest italic opacity-70">Mencakup semua transaksi (Lunas & Tempo)</p>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 h-[300px] sm:h-[400px] overflow-y-auto">
            {loadingChart ? (
              <div className="flex h-full items-center justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : isErrorChart ? (
              <div className="flex flex-col h-full items-center justify-center p-8 text-center">
                <p className="text-rose-500 font-bold text-xs uppercase mb-1">Gagal memuat rekapan harian</p>
                <p className="text-muted-foreground text-[10px] italic opacity-70">{(chartError as any)?.message || "Internal Server Error"}</p>
              </div>
            ) : (
              <table className="w-full text-xs text-left border-collapse sticky-header">
                <thead className="text-[10px] text-muted-foreground uppercase bg-secondary/40 border-b border-border/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-black tracking-widest">Tanggal</th>
                    <th className="px-4 py-4 text-center font-black tracking-widest">TRX</th>
                    <th className="px-4 py-4 text-right font-black tracking-widest">Penjualan (Daily)</th>
                    <th className="px-6 py-4 text-right font-black tracking-widest text-emerald-500">Laba (Harian)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/10">
                  {[...formattedChartData].sort((a, b) => {
                    return new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime();
                  }).map((item, idx) => (
                    <tr key={idx} className="hover:bg-primary/[0.02] transition-colors group/row">
                      <td className="px-6 py-3 whitespace-nowrap font-bold text-muted-foreground group-hover/row:text-foreground transition-colors">
                        {item.fullDate}
                      </td>
                      <td className="px-4 py-3 text-center font-black text-muted-foreground/60">
                        {item.Transaksi}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black tabular-nums tracking-tighter">
                        {formatRupiah(item.Penjualan)}
                      </td>
                      <td className="px-6 py-3 text-right font-mono font-black tabular-nums tracking-tighter text-emerald-500">
                        {formatRupiah(item.Laba)}
                      </td>
                    </tr>
                  ))}
                  {formattedChartData.length === 0 && (
                    <tr>
                      <td colSpan={3} className="text-center py-20 text-muted-foreground italic font-medium opacity-50">
                        Tidak ada data transaksi di periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-lg">Metode Pembayaran</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Distribusi nilai transaksi</p>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-6">
            {isErrorSummary ? (
              <div className="py-10 text-center text-muted-foreground italic text-xs">Data tidak tersedia</div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium"><DollarSign className="w-4 h-4 text-emerald-500"/> Cash</span>
                    <span className="font-bold whitespace-nowrap">{formatRupiah(summary?.cashTotal)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${(summary?.totalPenjualan ?? 0) > 0 ? ((summary?.cashTotal ?? 0) / (summary?.totalPenjualan ?? 1)) * 100 : 0}%` }}></div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium"><Landmark className="w-4 h-4 text-blue-500"/> Bank Transfer</span>
                    <span className="font-bold whitespace-nowrap">{formatRupiah(summary?.bankTotal)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(summary?.totalPenjualan ?? 0) > 0 ? ((summary?.bankTotal ?? 0) / (summary?.totalPenjualan ?? 1)) * 100 : 0}%` }}></div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium"><Store className="w-4 h-4 text-purple-500"/> Online Shop</span>
                    <span className="font-bold whitespace-nowrap">{formatRupiah(summary?.onlineShopTotal)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${(summary?.totalPenjualan ?? 0) > 0 ? ((summary?.onlineShopTotal ?? 0) / (summary?.totalPenjualan ?? 1)) * 100 : 0}%` }}></div>
                  </div>
                  {(summary?.onlineShopBelumCair ?? 0) > 0 && (
                    <p className="text-[10px] text-orange-400 text-right font-bold uppercase tracking-wider">Belum Cair: {formatRupiah(summary?.onlineShopBelumCair)}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium"><CreditCard className="w-4 h-4 text-orange-500"/> Kredit/Tempo</span>
                    <span className="font-bold whitespace-nowrap">{formatRupiah(summary?.kreditTotal)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${(summary?.totalPenjualan ?? 0) > 0 ? ((summary?.kreditTotal ?? 0) / (summary?.totalPenjualan ?? 1)) * 100 : 0}%` }}></div>
                  </div>
                  {(summary?.kreditBelumCair ?? 0) > 0 && (
                    <p className="text-[10px] text-orange-400 text-right font-bold uppercase tracking-wider">Belum Cair: {formatRupiah(summary?.kreditBelumCair)}</p>
                  )}
                </div>

                <div className="mt-8 pt-6 border-t border-border/50">
                   <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10">
                      <div className="text-xs font-bold text-muted-foreground uppercase">Profit Bersih</div>
                      <div className="text-lg lg:text-xl font-black text-primary whitespace-nowrap">{formatRupiah(summary?.laba)}</div>
                   </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
