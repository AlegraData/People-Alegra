"use client";
import { useEffect, useState } from "react";
import { Bell, LogOut } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<string>("Cargando...");
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser(user);
        // Obtener rol de la tabla user_roles
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();
        
        setRole(roleData?.role || "viewer");
      }
    };
    getUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) return null;

  return (
    <header className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-1 rounded-lg">
          <img src="https://www.alegra.com/favicon.ico" alt="Alegra" className="w-8 h-8 object-contain" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-black tracking-tight text-[#1e293b] leading-none">
            People <span className="text-primary">Alegra</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 md:gap-6">
        <button className="relative p-2 text-[#64748b] hover:text-primary transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-[#EF4444] rounded-full border-2 border-white"></span>
        </button>
        
        <div className="flex items-center gap-3 pl-4 md:pl-6 border-l border-slate-200 group">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-bold text-[#1e293b] group-hover:text-primary transition-colors">
              {user.user_metadata?.full_name || user.email}
            </p>
            <p className="text-[10px] font-black uppercase tracking-tighter text-primary">{role}</p>
          </div>
          <div className="relative group/profile cursor-pointer">
            <img 
              src={user.user_metadata?.avatar_url || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150&h=150"} 
              alt="Perfil" 
              className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-50 transition-all group-hover:ring-[#00D6BC]/20"
            />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#10B981] rounded-full border-2 border-white"></div>
            
            {/* Menu Desplegable */}
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 opacity-0 invisible group-hover/profile:opacity-100 group-hover/profile:visible transition-all duration-300 z-50 p-2">
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-bold text-error hover:bg-error/5 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
