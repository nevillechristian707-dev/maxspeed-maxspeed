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
    <div className="flex flex-col h-full">
      <div className="p-4 mb-2 flex-shrink-0">
        <div className="flex flex-col items-center">
          <div className="w-full h-32 flex items-center justify-center p-0 overflow-visible group">
            <img
              src={`${import.meta.env.BASE_URL}logo-maxspeed.png`}
              alt="Maxspeed Logo"
              className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(234,88,12,0.45)] group-hover:scale-105 transition-transform duration-500 will-change-transform"
              style={{ imageRendering: 'auto' }}
            />
          </div>
          <div className="text-center -mt-2">
            <h1 className="font-display font-black text-[10px] tracking-[0.4em] text-primary uppercase opacity-80">Aplikasi Max Speed</h1>
          </div>
        </div>
      </div>

      <div className="px-4 py-2 flex-shrink-0">
        <div className="p-3 rounded-xl bg-card border border-border/50 mb-6">
          <p className="text-xs text-muted-foreground">Logged in as</p>
          <p className="text-sm font-bold truncate">{user.name}</p>
          <p className="text-[10px] uppercase text-primary font-black mt-1 bg-primary/10 w-fit px-2 py-0.5 rounded">{user.role}</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {visibleItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={onNavClick}>
              <span className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/20"
                  : "text-muted-foreground hover:bg-card hover:text-foreground border border-transparent"
              )}>
                <item.icon className={cn(
                  "w-5 h-5 flex-shrink-0 transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 flex-shrink-0">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        >
          <Zap className="w-12 h-12 text-primary" />
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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 overflow-x-hidden">
      {/* Desktop Sidebar — fixed so horizontal overflow on any page can never push it sideways */}
      <aside className="hidden md:flex w-72 min-w-[288px] flex-col bg-sidebar border-r border-sidebar-border h-screen fixed top-0 left-0 z-40 overflow-hidden">
        <SidebarContent
          user={user}
          location={location}
          visibleItems={visibleSidebarItems}
          onLogout={handleLogout}
          onNavClick={handleNavClick}
        />
      </aside>

      {/* Mobile Topbar & Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar/80 backdrop-blur-xl border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <img
            src={`${import.meta.env.BASE_URL}logo-maxspeed.png`}
            alt="Maxspeed"
            className="h-12 w-auto object-contain drop-shadow-[0_0_10px_rgba(234,88,12,0.4)]"
          />
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-muted-foreground">
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
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="md:hidden fixed top-0 left-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border z-50 flex flex-col overflow-hidden"
            >
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground z-10"
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

      {/* Main Content — left padding reserves the space taken by the fixed sidebar (md:pl-72 = 288px) */}
      <main className="md:pl-72 min-w-0 h-screen overflow-y-auto overflow-x-hidden scroll-stable md:pt-0 pt-16">
        <div className="p-4 md:p-8 max-w-[1440px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
