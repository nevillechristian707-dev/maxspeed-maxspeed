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
    <div className="min-h-screen bg-neu-bg flex flex-col items-center justify-center relative p-6">
      <div className="absolute inset-0 z-0 bg-neu-bg">
        <div className="absolute inset-0 bg-gradient-to-br from-neu-accent/5 via-transparent to-transparent opacity-50" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md z-10"
      >
        <div className="bg-neu-bg nm-flat p-10 rounded-neu">
          <div className="flex flex-col items-center mb-8">
            <div className="w-full h-32 flex items-center justify-center mb-6">
              <img 
                src={`${import.meta.env.BASE_URL}logo-maxspeed.png`} 
                alt="Maxspeed" 
                className="w-full h-full object-contain filter drop-shadow-sm"
              />
            </div>
            <h1 className="text-neu-accent font-black text-[10px] tracking-[0.4em] uppercase">Aplikasi Max Speed</h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neu-text uppercase tracking-widest ml-2">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl nm-inset bg-white text-neu-text outline-none focus:ring-2 focus:ring-neu-accent/20 transition-all placeholder:text-neu-text font-black text-sm"
                placeholder="Username Anda"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-neu-text uppercase tracking-widest ml-2">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-5 py-4 rounded-2xl nm-inset bg-white text-neu-text outline-none focus:ring-2 focus:ring-neu-accent/20 transition-all placeholder:text-neu-text font-black text-sm"
                placeholder="••••••••"
              />
            </div>
            
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full py-4 mt-6 bg-neu-accent hover:opacity-90 text-white font-black rounded-2xl nm-flat active:nm-inset transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed text-xs tracking-[0.2em]"
            >
              {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "SIGN IN TO PITLANE"}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
