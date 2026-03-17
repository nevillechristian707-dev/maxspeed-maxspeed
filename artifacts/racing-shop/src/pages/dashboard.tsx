import { useGetDashboardSummary, useGetDashboardChart } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { formatRupiah, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, TrendingUp, TrendingDown, DollarSign, Wallet, Package, Store, CreditCard, Activity, Landmark, Calendar, Printer, Receipt } from "lucide-react";
import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';
import { useState } from "react";
import { motion } from "framer-motion";
import { useMonthYear } from "@/context/month-year-context";

export default function Dashboard() {
  const { selectedYear, selectedMonth, setSelectedYear, setSelectedMonth, dateParams } = useMonthYear();
  const [period, setPeriod] = useState<"daily" | "monthly">("monthly");
  
  const currentYear = new Date().getFullYear();

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary(dateParams);
  const { data: chartData, isLoading: loadingChart } = useGetDashboardChart({ period });

  if (loadingSummary || loadingChart) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  if (!summary || !chartData) return <Layout><div>Error loading data</div></Layout>;

  // Format chart data
  const formattedChartData = chartData.labels.map((label, i) => ({
    name: label,
    Penjualan: chartData.penjualan[i],
    Laba: chartData.laba[i]
  }));

  const StatCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden relative group border-border/40 hover:border-primary/50 transition-colors h-full">
        <div className={`absolute right-0 top-0 w-24 h-24 bg-gradient-to-br ${colorClass} opacity-10 rounded-bl-full group-hover:scale-110 transition-transform`} />
        <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
          <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClass} bg-opacity-20`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg sm:text-xl lg:text-2xl font-display font-black tracking-tight">{value}</div>
          {subtitle && <p className="text-xs text-muted-foreground mt-1 font-medium">{subtitle}</p>}
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
        
        <div className="flex flex-wrap items-center gap-3 bg-secondary/30 p-2 rounded-2xl border border-border/50">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard 
          title="Total Penjualan" 
          value={formatRupiah(summary.totalPenjualan)} 
          icon={Activity}
          colorClass="from-blue-500 to-cyan-500"
          subtitle={`${summary.totalTransaksi} Transaksi`}
        />
        <StatCard 
          title="Total Modal" 
          value={formatRupiah(summary.totalModal)} 
          icon={Package}
          colorClass="from-orange-500 to-yellow-500"
        />
        <StatCard 
          title="Total Biaya" 
          value={formatRupiah(summary.totalBiaya)} 
          icon={Receipt}
          colorClass="from-red-500 to-pink-500"
          subtitle="Biaya Operasional"
        />
        <StatCard 
          title="Laba Bersih" 
          value={formatRupiah(summary.laba)} 
          icon={TrendingUp}
          colorClass="from-primary to-orange-600"
        />
        <StatCard 
          title="Laba Shared (10%)" 
          value={formatRupiah(summary.labaShared)} 
          icon={Wallet}
          colorClass="from-emerald-500 to-teal-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 pb-4">
            <div>
              <CardTitle className="text-lg">Grafik Penjualan & Laba</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Tren performa toko</p>
            </div>
            <select 
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="bg-secondary border border-border text-xs font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="daily">Harian</option>
              <option value="monthly">Bulanan</option>
            </select>
          </CardHeader>
          <CardContent className="flex-1 pt-6 min-h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={formattedChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis 
                  stroke="rgba(255,255,255,0.5)" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(val) => `Rp ${val / 1000000}M`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(10,10,10,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                  formatter={(value: number) => [formatRupiah(value), ""]}
                />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="Penjualan" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Laba" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-lg">Metode Pembayaran</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Distribusi nilai transaksi</p>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 font-medium"><DollarSign className="w-4 h-4 text-emerald-500"/> Cash</span>
                <span className="font-bold whitespace-nowrap">{formatRupiah(summary.cashTotal)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${summary.totalPenjualan > 0 ? (summary.cashTotal / summary.totalPenjualan) * 100 : 0}%` }}></div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 font-medium"><Landmark className="w-4 h-4 text-blue-500"/> Bank Transfer</span>
                <span className="font-bold whitespace-nowrap">{formatRupiah(summary.bankTotal)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${summary.totalPenjualan > 0 ? (summary.bankTotal / summary.totalPenjualan) * 100 : 0}%` }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 font-medium"><Store className="w-4 h-4 text-purple-500"/> Online Shop</span>
                <span className="font-bold whitespace-nowrap">{formatRupiah(summary.onlineShopTotal)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${summary.totalPenjualan > 0 ? (summary.onlineShopTotal / summary.totalPenjualan) * 100 : 0}%` }}></div>
              </div>
              {summary.onlineShopBelumCair > 0 && (
                <p className="text-[10px] text-orange-400 text-right font-bold uppercase tracking-wider">Belum Cair: {formatRupiah(summary.onlineShopBelumCair)}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2 font-medium"><CreditCard className="w-4 h-4 text-orange-500"/> Kredit/Tempo</span>
                <span className="font-bold whitespace-nowrap">{formatRupiah(summary.kreditTotal)}</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${summary.totalPenjualan > 0 ? (summary.kreditTotal / summary.totalPenjualan) * 100 : 0}%` }}></div>
              </div>
              {summary.kreditBelumCair > 0 && (
                <p className="text-[10px] text-orange-400 text-right font-bold uppercase tracking-wider">Belum Cair: {formatRupiah(summary.kreditBelumCair)}</p>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-border/50">
               <div className="flex justify-between items-center bg-primary/5 p-4 rounded-xl border border-primary/10">
                  <div className="text-xs font-bold text-muted-foreground uppercase">Profit Bersih</div>
                  <div className="text-lg lg:text-xl font-black text-primary whitespace-nowrap">{formatRupiah(summary.laba)}</div>
               </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
