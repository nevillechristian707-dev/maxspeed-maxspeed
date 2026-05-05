import { useState, useEffect, useMemo, useRef } from "react";
import { useGetDashboardSummary, useGetMe, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  ShoppingCart, 
  Wallet, 
  Package, 
  Zap,
  ChevronRight
} from "lucide-react";
import { formatRupiah } from "@/lib/utils";

export function NightlyReportPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const { data: user } = useGetMe();
  const hasShownRef = useRef(false);

  // Tanggal Hari Ini (YYYY-MM-DD)
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  
  // Ambil summary hari ini
  const { data: summary, isLoading } = useGetDashboardSummary(
    { startDate: today, endDate: today },
    { 
      query: { 
        enabled: isOpen,
        queryKey: getGetDashboardSummaryQueryKey({ startDate: today, endDate: today }) 
      } 
    }
  );

  // Cek Permission saja — popup tampil sekali setiap aplikasi dibuka.
  // Refresh halaman dianggap sebagai "buka aplikasi baru" → popup muncul lagi.
  // Role/permission tetap diberlakukan (tidak berubah dari versi sebelumnya).
  useEffect(() => {
    if (!user || hasShownRef.current) return;

    const role = String(user.role || '').toLowerCase();
    const isAdmin = role.includes('admin') || role.includes('superadmin');
    const permissions = (user as any).permissions || {};
    const perms = permissions['Laporan Malam'] || permissions['laporan malam'] || [];
    const hasPermission = isAdmin || perms.some((p: string) => p.toLowerCase() === 'view');

    if (hasPermission) {
      setIsOpen(true);
      hasShownRef.current = true;
    }
  }, [user]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[9998]"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[9999] pointer-events-none">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-[400px] bg-[#1a1a1a] rounded-[2.5rem] overflow-hidden shadow-2xl pointer-events-auto border border-white/5"
            >
              {/* Header Orange */}
              <div className="bg-[#f06128] p-8 text-center relative overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-[-20%] left-[-20%] w-64 h-64 bg-white rounded-full blur-3xl" />
                </div>

                <div className="relative z-10 flex flex-col items-center gap-3">
                  <div className="p-2.5 bg-white/20 backdrop-blur-md rounded-2xl shadow-inner border border-white/10">
                    <Zap className="w-8 h-8 text-white fill-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-display font-black text-white leading-tight">
                      Laporan Malam — {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </h2>
                    <p className="text-white/80 text-xs font-bold uppercase tracking-widest mt-1">Max Speed Racing Shop</p>
                  </div>
                </div>

                <button 
                  onClick={() => setIsOpen(false)}
                  className="absolute top-6 right-6 p-2 rounded-full bg-black/10 hover:bg-black/20 text-white/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content Panel */}
              <div className="p-8 space-y-6">
                <div className="space-y-4">
                  {/* Row 1: Total Penjualan */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[#222] border border-white/5 group-hover:border-primary/30 transition-colors">
                        <ShoppingCart className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-bold text-muted-foreground uppercase tracking-tight italic">Total penjualan</span>
                    </div>
                    <span className="text-lg font-black text-emerald-500 font-display italic">
                      {isLoading ? "..." : `${summary?.totalTransaksi || 0} order`}
                    </span>
                  </div>

                  {/* Row 2: Pencairan */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[#222] border border-white/5 group-hover:border-primary/30 transition-colors">
                        <Wallet className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-bold text-muted-foreground uppercase tracking-tight italic">Pencairan masuk</span>
                    </div>
                    <span className="text-lg font-black text-emerald-500 font-display">
                      {isLoading ? "..." : formatRupiah(summary?.totalPenjualan)}
                    </span>
                  </div>

                  {/* Row 3: Omset */}
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-[#222] border border-white/5 group-hover:border-primary/30 transition-colors">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-bold text-muted-foreground uppercase tracking-tight italic">Omset hari ini</span>
                    </div>
                    <span className="text-lg font-black text-[#f0a528] font-display">
                      {isLoading ? "..." : formatRupiah(summary?.totalPenjualan)}
                    </span>
                  </div>
                </div>

                {/* Profit Section Card */}
                <div className="bg-[#2a1c13] border border-[#f06128]/20 rounded-3xl p-6 text-center shadow-inner">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#f06128]/80 mb-1">Estimasi Profit</p>
                  <h3 className="text-3xl font-display font-black text-[#f0a528] tracking-tight">
                    {isLoading ? "..." : formatRupiah(summary?.laba)}
                  </h3>
                </div>

                {/* Actions */}
                <div className="space-y-3 pt-2">
                  <button 
                    onClick={() => {
                        window.location.href = '/';
                        setIsOpen(false);
                    }}
                    className="w-full py-4 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm tracking-tight transition-all active:scale-[0.98] flex items-center justify-center gap-2 group"
                  >
                    Lihat Laporan Detail
                    <ChevronRight className="w-4 h-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="w-full py-2 text-muted-foreground/60 hover:text-muted-foreground text-xs font-bold uppercase tracking-widest transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
