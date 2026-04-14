"use client";
import { createClient } from "@/utils/supabase/client";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 text-center max-w-md w-full">
        <img src="https://www.alegra.com/favicon.ico" alt="Alegra" className="w-16 h-16 mx-auto mb-8" />
        <h2 className="text-3xl font-black text-[#1e293b] mb-4">People <span className="text-primary">Alegra</span></h2>
        <p className="text-[#64748b] mb-12 font-medium">Inicia sesión para acceder a tu portal de crecimiento y bienestar.</p>
        
        <button 
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-4 bg-[#1e293b] text-white py-4 rounded-2xl font-bold hover:bg-primary hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 bg-white rounded-full p-0.5" />
          Ingresar con Google
        </button>
      </div>
    </div>
  );
}
