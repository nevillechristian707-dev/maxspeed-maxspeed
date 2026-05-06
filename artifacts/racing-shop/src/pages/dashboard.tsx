import { useGetDashboardSummary, useGetDashboardChart } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, TrendingUp, DollarSign, Wallet, Package, Store, CreditCard, Activity, Landmark, Calendar, Receipt, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, memo, useMemo } from "react";
import { motion } from "framer-motion";
import { useMonthYear } from "@/context/month-year-context";

const StatCard = memo(({ title, value, icon: Icon, colorClass, subtitle }: any) => (
  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="h-full">
    <div className="h-full relative overflow-hidden group nm-inset bg-neu-bg/20 rounded-neu p-8 transition-all duration-500 hover:scale-[1.02]">
      <div className="flex items-center justify-between mb-6">
        <div className="p-4 rounded-2xl nm-flat bg-white">
          <Icon className="w-5 h-5 text-neu-accent" />
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black tracking-[0.2em] text-neu-text uppercase">{title}</p>
        </div>
      </div>
      <div>
        <h3 className="text-3xl font-display font-black text-neu-text tracking-tight mb-1">{value}</h3>
        {subtitle && <p className="text-[10px] font-black text-neu-text uppercase tracking-widest">{subtitle}</p>}
      </div>
    </div>
  </motion.div>
));
StatCard.displayName = 'StatCard';

const ErrorState = ({ message, onRetry }: { message: string, onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center p-12 bg-neu-bg nm-inset rounded-neu text-center gap-4">
     <Activity className="w-10 h-10 text-rose-500/50 animate-pulse" />
     <div>
       <p className="text-rose-500 font-black uppercase tracking-[0.2em] text-xs mb-1">Gagal Memuat Data</p>
       <p className="text-neu-text text-xs font-black max-w-[250px] mx-auto">{message}</p>
     </div>
     <button 
       onClick={onRetry} 
       className="px-6 py-2.5 rounded-2xl bg-neu-bg nm-flat text-neu-accent text-xs font-black uppercase hover:nm-sm active:nm-inset transition-all"
     >
       Coba Lagi
     </button>
  </div>
);

const DailySummaryTable = memo(({ data }: { data: any[] }) => (
  <Table>
    <TableHeader>
      <TableRow className="nm-flat bg-neu-bg/50 hover:scale-100">
        <TableHead className="font-black text-neu-text uppercase">Tanggal</TableHead>
        <TableHead className="text-center font-black text-neu-text uppercase">TRX</TableHead>
        <TableHead className="text-right font-black text-neu-text uppercase">Cash</TableHead>
        <TableHead className="text-right font-black text-neu-text uppercase">Bank</TableHead>
        <TableHead className="text-right font-black text-neu-text uppercase">OS</TableHead>
        <TableHead className="text-right font-black text-neu-text uppercase">KRD</TableHead>
        <TableHead className="text-right font-black text-neu-text uppercase">Total</TableHead>
        <TableHead className="text-right text-neu-accent font-black uppercase">Laba</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {data.map((item, idx) => (
        <TableRow key={idx}>
          <TableCell className="font-black text-neu-text">{item.fullDate}</TableCell>
          <TableCell className="text-center font-black text-neu-text">{item.Transaksi}</TableCell>
          <TableCell className="text-right font-mono font-black text-emerald-500/80">{formatRupiah(item.Cash)}</TableCell>
          <TableCell className="text-right font-mono font-black text-blue-500/80">{formatRupiah(item.Bank)}</TableCell>
          <TableCell className="text-right font-mono font-black text-purple-500/80">{formatRupiah(item.OnlineShop)}</TableCell>
          <TableCell className="text-right font-mono font-black text-orange-500/80">{formatRupiah(item.Kredit)}</TableCell>
          <TableCell className="text-right font-mono font-black text-neu-text">{formatRupiah(item.Penjualan)}</TableCell>
          <TableCell className="text-right font-mono font-black text-neu-accent">{formatRupiah(item.Laba)}</TableCell>
        </TableRow>
      ))}
      {data.length === 0 && (
        <TableRow className="nm-inset">
          <TableCell colSpan={8} className="h-32 text-center text-neu-text font-black italic uppercase">
            Tidak ada data transaksi di periode ini.
          </TableCell>
        </TableRow>
      )}
    </TableBody>
  </Table>
));
DailySummaryTable.displayName = 'DailySummaryTable';

export default function Dashboard() {
  const { selectedYear, selectedMonth, setSelectedYear, setSelectedMonth, dateParams } = useMonthYear();
  const currentYear = new Date().getFullYear();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: summary, isLoading: loadingSummary, isError: isErrorSummary, refetch: refetchSummary } = useGetDashboardSummary(dateParams);
  const { data: chartData, isLoading: loadingChart, isError: isErrorChart, error: chartError, refetch: refetchChart } = useGetDashboardChart(dateParams);

  const sortedChartData = useMemo(() => {
    if (!chartData?.labels) return [];
    const d = chartData as any;
    const formatted = chartData.labels.map((label, i) => {
      const date = new Date(label);
      const compactDate = !isNaN(date.getTime()) ? `${date.getDate()}/${date.getMonth() + 1}` : label;
      return {
        name: compactDate,
        fullDate: formatDate(label),
        rawDate: label,
        Penjualan: Number(d?.penjualan?.[i] || 0),
        Laba: Number(d?.laba?.[i] || 0),
        Transaksi: Number(d?.counts?.[i] || 0),
        Cash: Number(d?.cash?.[i] || 0),
        Bank: Number(d?.bank?.[i] || 0),
        OnlineShop: Number(d?.onlineShop?.[i] || 0),
        Kredit: Number(d?.kredit?.[i] || 0)
      };
    });
    return formatted.sort((a, b) => new Date(b.rawDate).getTime() - new Date(a.rawDate).getTime());
  }, [chartData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchSummary(), refetchChart()]);
    setIsRefreshing(false);
  };

  if (loadingSummary && !summary) {
    return (
      <Layout>
        <div className="flex flex-col h-64 items-center justify-center gap-6">
          <div className="w-16 h-16 rounded-neu nm-flat flex items-center justify-center bg-neu-bg">
            <Activity className="w-8 h-8 text-neu-accent animate-spin" />
          </div>
          <p className="text-[10px] font-black uppercase text-neu-dark tracking-[0.3em] animate-pulse">Sinkronisasi Data...</p>
        </div>
      </Layout>
    );
  }

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: "all", label: "Setahun Penuh" },
    { value: 1, label: "Januari" }, { value: 2, label: "Februari" }, { value: 3, label: "Maret" },
    { value: 4, label: "April" }, { value: 5, label: "Mei" }, { value: 6, label: "Juni" },
    { value: 7, label: "Juli" }, { value: 8, label: "Agustus" }, { value: 9, label: "September" },
    { value: 10, label: "Oktober" }, { value: 11, label: "November" }, { value: 12, label: "Desember" }
  ];

  return (
    <Layout>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-12 gap-6">
        <div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl nm-flat bg-neu-bg">
              <LayoutDashboard className="text-neu-accent w-6 h-6" />
            </div>
            <div>
              <h1 className="text-4xl font-display font-black text-neu-text tracking-tight">Dashboard</h1>
              <p className="text-neu-text mt-1 text-sm font-black">Ringkasan performa finansial Max Speed.</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="w-12 h-12 rounded-2xl bg-neu-bg nm-flat flex items-center justify-center hover:nm-sm active:nm-inset transition-all disabled:opacity-50"
          >
            <Activity className={cn("w-5 h-5 text-neu-accent", isRefreshing && "animate-spin")} />
          </button>
          
          <div className="flex items-center gap-4 bg-neu-bg p-2 px-4 rounded-neu nm-inset">
            <Calendar className="w-4 h-4 text-neu-accent" />
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-sm font-black text-neu-text outline-none cursor-pointer py-2"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="w-px h-6 bg-neu-dark/20 mx-2" />
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value === "all" ? "all" : Number(e.target.value))}
              className="bg-transparent text-sm font-black text-neu-text outline-none cursor-pointer py-2"
            >
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
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
              subtitle={`${summary?.totalTransaksi || 0} Transaksi`}
            />
            <StatCard 
              title="Total Modal" 
              value={formatRupiah(summary?.totalModal)} 
              icon={Package}
            />
            <StatCard 
              title="Total Biaya" 
              value={formatRupiah(summary?.totalBiaya)} 
              icon={Receipt}
              subtitle="Operasional"
            />
            <StatCard 
              title="Laba Bersih" 
              value={formatRupiah(summary?.laba)} 
              icon={TrendingUp}
            />
            <StatCard 
              title="Laba Shared (10%)" 
              value={formatRupiah(summary?.labaShared)} 
              icon={Wallet}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 nm-flat bg-white border-none">
          <CardHeader className="flex flex-row items-center justify-between border-b border-neu-bg p-8">
            <div>
              <CardTitle className="text-xl font-black text-neu-text tracking-tight">Grafik Penjualan</CardTitle>
              <CardDescription className="text-neu-text text-xs font-black">Statistik transaksi 7 hari terakhir</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-visible">
            {loadingChart ? (
              <div className="flex h-64 items-center justify-center">
                <Activity className="w-8 h-8 text-neu-accent animate-spin" />
              </div>
            ) : isErrorChart ? (
              <div className="p-12 text-center">
                <p className="text-rose-500 font-black text-xs uppercase mb-2">Gagal memuat data</p>
                <p className="text-neu-dark text-xs italic opacity-70">{(chartError as any)?.message}</p>
              </div>
            ) : (
              <div className="px-2">
                <DailySummaryTable data={sortedChartData} />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="nm-flat">
            <CardHeader>
              <CardTitle className="text-lg">Metode Pembayaran</CardTitle>
              <CardDescription>Distribusi nilai transaksi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {isErrorSummary ? (
                <div className="py-10 text-center text-neu-dark italic text-xs">Data tidak tersedia</div>
              ) : (
                <>
                  {[
                    { label: "Cash", value: summary?.cashTotal, icon: DollarSign, color: "bg-emerald-500" },
                    { label: "Bank Transfer", value: summary?.bankTotal, icon: Landmark, color: "bg-blue-500" },
                    { label: "Online Shop", value: summary?.onlineShopTotal, icon: Store, color: "bg-purple-500", extra: summary?.onlineShopBelumCair },
                    { label: "Kredit/Tempo", value: summary?.kreditTotal, icon: CreditCard, color: "bg-orange-500", extra: summary?.kreditBelumCair }
                  ].map((item, i) => (
                    <div key={i} className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="flex items-center gap-3 text-sm font-bold text-neu-text">
                          <div className={cn("p-1.5 rounded-lg nm-inset", item.color.replace('bg-', 'text-'))}>
                            <item.icon className="w-3.5 h-3.5" />
                          </div>
                          {item.label}
                        </span>
                        <span className="text-sm font-black text-neu-text">{formatRupiah(item.value)}</span>
                      </div>
                      <div className="w-full bg-neu-dark/10 rounded-full h-2 nm-inset overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-1000", item.color)} 
                          style={{ width: `${(summary?.totalPenjualan ?? 0) > 0 ? ((item.value ?? 0) / (summary?.totalPenjualan ?? 1)) * 100 : 0}%` }}
                        />
                      </div>
                      {(item.extra ?? 0) > 0 && (
                        <p className="text-[9px] font-black uppercase text-orange-600 text-right tracking-widest">Belum Cair: {formatRupiah(item.extra)}</p>
                      )}
                    </div>
                  ))}

                  <div className="mt-8 p-6 rounded-neu nm-inset bg-neu-accent/5 flex justify-between items-center border border-neu-accent/10">
                    <div>
                      <p className="text-[10px] font-black text-neu-accent uppercase tracking-widest mb-1">Profit Bersih</p>
                      <p className="text-2xl font-display font-black text-neu-accent tracking-tight">{formatRupiah(summary?.laba)}</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-neu-accent opacity-20" />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
