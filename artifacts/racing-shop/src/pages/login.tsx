import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLogin } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Zap, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useLogin();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await loginMutation.mutateAsync({ data: { username, password } });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/");
      toast({ title: "Login berhasil", description: "Selamat datang di Max Speed Dashboard." });
    } catch (error: any) {
      toast({
        title: "Login gagal",
        description: "Username atau password salah.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background image from requirements.yaml */}
      <div className="absolute inset-0 z-0">
        <img 
          src={`${import.meta.env.BASE_URL}images/login-bg.png`} 
          alt="Racing Background" 
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10 p-4"
      >
        <div className="bg-card/80 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl shadow-primary/10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-primary to-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-display font-bold tracking-wider text-foreground">MAX SPEED</h1>
            <p className="text-primary font-bold text-sm tracking-widest uppercase mt-1">Dashboard</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground ml-1">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                placeholder="Enter your username"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-background/50 border border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-muted-foreground/50"
                placeholder="••••••••"
              />
            </div>
            
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-3.5 mt-4 bg-gradient-to-r from-primary to-orange-500 hover:from-primary/90 hover:to-orange-500/90 text-white font-bold rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "SIGN IN TO PITLANE"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
