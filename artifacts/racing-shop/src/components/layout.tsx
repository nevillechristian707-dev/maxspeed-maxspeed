import { ReactNode, useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import {
  LayoutDashboard,
  ShoppingCart,
  Wallet,
  Receipt,
  Package,
  Landmark,
  Store,
  Users,
  Briefcase,
  LineChart,
  LogOut,
  Menu,
  X,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const SIDEBAR_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/penjualan", label: "Penjualan", icon: ShoppingCart },
  { href: "/pencairan", label: "Pencairan", icon: Wallet },
  { href: "/biaya", label: "Biaya", icon: Receipt },
  { href: "/master-barang", label: "Master Barang", icon: Package },
  { href: "/master-bank", label: "Master Bank", icon: Landmark },
  { href: "/master-online-shop", label: "Master Online Shop", icon: Store },
  { href: "/customer", label: "Customer", icon: Users },
  { href: "/modal", label: "Modal", icon: Briefcase },
  { href: "/laporan", label: "Laporan", icon: LineChart },
  { href: "/user-management", label: "Manajemen Pengguna", icon: Users },
];

interface SidebarContentProps {
  user: { name: string; role: string };
  location: string;
  visibleItems: typeof SIDEBAR_ITEMS;
  onLogout: () => void;
  onNavClick: () => void;
}

function SidebarContent({ user, location, visibleItems, onLogout, onNavClick }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-8 mb-4 flex-shrink-0">
        <div className="flex flex-col items-center">
          <div className="w-full h-32 flex items-center justify-center p-4 rounded-neu nm-flat bg-neu-bg/50 group transition-all duration-500">
            <img
              src={`${import.meta.env.BASE_URL}logo-maxspeed.png`}
              alt="Maxspeed Logo"
              className="w-full h-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform duration-500"
            />
          </div>
          <div className="text-center mt-4">
            <h1 className="font-display font-black text-[10px] tracking-[0.4em] text-neu-text uppercase">Aplikasi Max Speed</h1>
          </div>
        </div>
      </div>

      <div className="px-6 py-2 flex-shrink-0">
        <div className="p-4 rounded-2xl nm-inset bg-neu-bg/30 mb-8 border border-white/20">
          <p className="text-[10px] uppercase font-black text-neu-text tracking-widest">Logged in as</p>
          <p className="text-sm font-black text-neu-text truncate mt-0.5">{user.name}</p>
          <p className="text-[9px] uppercase text-neu-text font-black mt-2 bg-neu-bg w-fit px-2 py-0.5 rounded-full shadow-sm border border-neu-accent/20">{user.role}</p>
        </div>
      </div>

      <nav className="flex-1 px-6 space-y-3 overflow-y-auto custom-scrollbar pb-8">
        {visibleItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={onNavClick}>
              <span className={cn(
                "flex items-center gap-3 px-5 py-4 rounded-2xl text-sm font-bold transition-all duration-300 cursor-pointer group will-change-neu mx-4",
                isActive
                  ? "nm-inset text-neu-accent bg-neu-bg/20 scale-[0.98]"
                  : "text-neu-text hover:bg-neu-bg/30"
              )}>
                <item.icon className={cn(
                  "w-5 h-5 flex-shrink-0 transition-colors",
                  isActive ? "text-neu-accent" : "text-neu-text group-hover:text-neu-accent"
                )} />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-6 mt-auto flex-shrink-0 border-t border-neu-bg">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 px-4 py-3 rounded-2xl text-sm font-black text-rose-500 hover:nm-flat transition-all active:scale-95"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: user, isLoading, isError } = useGetMe({
    query: { retry: false } as any
  });
  const logoutMutation = useLogout();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isError) {
      setLocation("/login");
    }
  }, [isError, setLocation]);

  const handleLogout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem("maxspeed_session_id");
      }
      queryClient.clear();
      setLocation("/login");
    }
  }, [logoutMutation, queryClient, setLocation]);

  const handleNavClick = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neu-bg flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="w-20 h-20 rounded-neu nm-flat flex items-center justify-center bg-neu-bg"
        >
          <Zap className="w-10 h-10 text-neu-accent animate-pulse" />
        </motion.div>
      </div>
    );
  }

  if (!user) return null;

  // Filter sidebar items based on permissions
  const visibleSidebarItems = SIDEBAR_ITEMS.filter(item => {
    const role = user.role?.toLowerCase() || '';
    if (role.includes("admin") || role.includes("superadmin")) return true;

    if (item.label === "Manajemen Pengguna") return false;

    const permissions = (user as any).permissions || {};
    const hasPermission = Object.entries(permissions).some(([key, val]) => {
      if (key.toLowerCase() === item.label.toLowerCase()) {
        return Array.isArray(val) && val.some((p: any) => String(p).toLowerCase() === "view");
      }
      return false;
    });

    return hasPermission;
  });

  return (
    <div className="min-h-screen bg-neu-bg text-neu-text selection:bg-neu-accent/30 overflow-x-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-80 min-w-[320px] flex-col h-screen fixed top-0 left-0 z-40 overflow-hidden shadow-[10px_0_30px_rgba(163,177,198,0.2)] bg-white">
        <SidebarContent
          user={user}
          location={location}
          visibleItems={visibleSidebarItems}
          onLogout={handleLogout}
          onNavClick={handleNavClick}
        />
      </aside>

      {/* Mobile Topbar & Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-neu-bg/80 backdrop-blur-2xl border-b border-neu-bg z-50 flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-2">
          <img
            src={`${import.meta.env.BASE_URL}logo-maxspeed.png`}
            alt="Maxspeed"
            className="h-12 w-auto object-contain drop-shadow-sm"
          />
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-neu-text">
          <Menu className="w-6 h-6" />
        </button>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="md:hidden fixed top-0 left-0 bottom-0 w-72 bg-neu-bg z-50 flex flex-col overflow-hidden shadow-2xl shadow-black/10"
            >
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-neu-text hover:text-neu-accent z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent
                user={user}
                location={location}
                visibleItems={visibleSidebarItems}
                onLogout={handleLogout}
                onNavClick={handleNavClick}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="md:pl-80 min-w-0 min-h-screen overflow-y-auto overflow-x-hidden scroll-stable md:pt-0 pt-16 bg-neu-bg">
        <div className="p-6 md:p-12 lg:p-16 max-w-[1600px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
