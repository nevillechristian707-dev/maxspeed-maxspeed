import { Suspense, lazy, useEffect, useCallback, memo } from "react";
import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NightlyReportPopup } from "@/components/nightly-report-popup";

// Lazy load semua halaman - split bundle per halaman
const Login = lazy(() => import("./pages/login"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const Penjualan = lazy(() => import("./pages/penjualan"));
const Pencairan = lazy(() => import("./pages/pencairan"));
const Biaya = lazy(() => import("./pages/biaya"));
const MasterBarang = lazy(() => import("./pages/master-barang"));
const MasterBank = lazy(() => import("./pages/master-bank"));
const MasterOnlineShop = lazy(() => import("./pages/master-online-shop"));
const Customer = lazy(() => import("./pages/customer"));
const Modal = lazy(() => import("./pages/modal"));
const Laporan = lazy(() => import("./pages/laporan"));
const UserManagement = lazy(() => import("./pages/user-management"));
const NotFound = lazy(() => import("./pages/not-found"));

// QueryClient yang dioptimasi untuk kecepatan di HP & PC
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // Kurangi retry dari 2 ke 1 untuk respon lebih cepat saat error
      staleTime: 2 * 60_000, // Data dianggap fresh 2 menit (kurangi refetch)
      gcTime: 5 * 60_000, // Garbage collect setelah 5 menit (hemat memori HP)
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      networkMode: 'offlineFirst', // Tampilkan cache dulu, update background
    },
  },
});

function useAuth() {
  return useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60_000, // Session jarang berubah, cache 5 menit
    gcTime: 10 * 60_000,
  });
}

// Loading state yang ringan (tanpa animasi berat)
const FullPageLoader = memo(() => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
    <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-primary/10 animate-pulse" />
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
    <div className="text-primary font-display font-black tracking-widest text-[10px] uppercase opacity-50">
      Memuat...
    </div>
  </div>
));
FullPageLoader.displayName = 'FullPageLoader';

// Skeleton loader ringan untuk Suspense fallback. Mirror struktur Layout
// (sidebar fixed 288px + main pl-72 + container max-w-[1600px] mx-auto) sehingga
// saat halaman lazy-loaded sedang dimuat, tidak terjadi pergeseran posisi sidebar.
const PageSkeleton = memo(() => (
  <div className="min-h-screen bg-background overflow-x-hidden">
    {/* Sidebar placeholder — fixed, samakan dengan Layout */}
    <aside className="hidden md:flex w-72 min-w-[288px] bg-sidebar border-r border-sidebar-border h-screen fixed top-0 left-0 z-40" />
    {/* Mobile topbar placeholder */}
    <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar/80 backdrop-blur-xl border-b border-sidebar-border z-50" />
    {/* Main content placeholder */}
    <main className="md:pl-72 min-w-0 h-screen overflow-y-auto overflow-x-hidden scroll-stable md:pt-0 pt-16">
      <div className="p-4 md:p-8 max-w-[1600px] mx-auto w-full">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted/30 rounded-lg w-48" />
          <div className="h-4 bg-muted/20 rounded w-64" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 bg-muted/20 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-muted/20 rounded-xl mt-4" />
        </div>
      </div>
    </main>
  </div>
));
PageSkeleton.displayName = 'PageSkeleton';

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (!user) return <Redirect to="/login" />;

  return (
    <Suspense fallback={<PageSkeleton />}>
      <Component />
    </Suspense>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useAuth();

  if (isLoading) return <FullPageLoader />;
  if (user) return <Redirect to="/" />;

  return (
    <Suspense fallback={<FullPageLoader />}>
      <Component />
    </Suspense>
  );
}

// Prefetch halaman-halaman penting saat browser idle
function usePrefetchRoutes() {
  useEffect(() => {
    const prefetch = () => {
      // Prefetch halaman yang sering diakses saat browser idle
      import("./pages/dashboard");
      import("./pages/penjualan");
    };
    
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(prefetch, { timeout: 3000 });
    } else {
      setTimeout(prefetch, 2000);
    }
  }, []);
}

function Router() {
  usePrefetchRoutes();
  
  return (
    <Switch>
      <Route path="/login">
        <PublicRoute component={Login} />
      </Route>
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/penjualan">
        <ProtectedRoute component={Penjualan} />
      </Route>
      <Route path="/pencairan">
        <ProtectedRoute component={Pencairan} />
      </Route>
      <Route path="/biaya">
        <ProtectedRoute component={Biaya} />
      </Route>
      <Route path="/master-barang">
        <ProtectedRoute component={MasterBarang} />
      </Route>
      <Route path="/master-bank">
        <ProtectedRoute component={MasterBank} />
      </Route>
      <Route path="/master-online-shop">
        <ProtectedRoute component={MasterOnlineShop} />
      </Route>
      <Route path="/customer">
        <ProtectedRoute component={Customer} />
      </Route>
      <Route path="/modal">
        <ProtectedRoute component={Modal} />
      </Route>
      <Route path="/laporan">
        <ProtectedRoute component={Laporan} />
      </Route>
      <Route path="/user-management">
        <ProtectedRoute component={UserManagement} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

import { MonthYearProvider } from "./context/month-year-context";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MonthYearProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <NightlyReportPopup />
        </TooltipProvider>
      </MonthYearProvider>
    </QueryClientProvider>
  );
}

export default App;

