import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Penjualan from "./pages/penjualan";
import Pencairan from "./pages/pencairan";
import Biaya from "./pages/biaya";
import MasterBarang from "./pages/master-barang";
import MasterBank from "./pages/master-bank";
import MasterOnlineShop from "./pages/master-online-shop";
import Customer from "./pages/customer";
import Modal from "./pages/modal";
import Laporan from "./pages/laporan";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
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
    staleTime: 60_000,
  });
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { data: user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

import UserManagement from "./pages/user-management";

function Router() {
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
        </TooltipProvider>
      </MonthYearProvider>
    </QueryClientProvider>
  );
}

export default App;
