import { ReactNode, useState, useEffect } from "react";
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

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
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

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setLocation("/login");
  };

  // Filter sidebar items based on permissions
  const visibleSidebarItems = SIDEBAR_ITEMS.filter(item => {
    if (user.role === "Admin" || user.role === "admin" || user.role === "superadmin") return true; // Admin sees all

    if (item.label === "Manajemen Pengguna") return false; // Only Admin can manage users
    
    // Check if the user has "view" permission for this menu
    const permissions = (user as any).permissions || {};
    const menuPerms = permissions[item.label] || [];
    return menuPerms.includes("view");
  });

  const SidebarContent = () => (
    <>
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-orange-600 flex items-center justify-center shadow-lg shadow-primary/20">
          <Zap className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl tracking-wide text-foreground">MAX SPEED</h1>
          <p className="text-[10px] uppercase tracking-widest text-primary font-bold">Racing Shop</p>
        </div>
      </div>
      
      <div className="px-4 py-2">
        <div className="p-3 rounded-xl bg-card border border-border/50 mb-6">
          <p className="text-xs text-muted-foreground">Logged in as</p>
          <p className="text-sm font-bold truncate">{user.name}</p>
          <p className="text-[10px] uppercase text-primary font-black mt-1 bg-primary/10 w-fit px-2 py-0.5 rounded">{user.role}</p>
        </div>
      </div>

      <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {visibleSidebarItems.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
              <span className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer group",
                isActive 
                  ? "bg-primary/10 text-primary border border-primary/20" 
                  : "text-muted-foreground hover:bg-card hover:text-foreground border border-transparent"
              )}>
                <item.icon className={cn(
                  "w-5 h-5 transition-colors", 
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background flex text-foreground selection:bg-primary/30">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-72 flex-col bg-sidebar border-r border-sidebar-border h-screen sticky top-0 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile Topbar & Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-lg">MAX SPEED</span>
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
              className="md:hidden fixed top-0 left-0 bottom-0 w-72 bg-sidebar border-r border-sidebar-border z-50 flex flex-col"
            >
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto md:pt-0 pt-16">
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
