"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

interface ShootingStar {
  id: number;
  x: number;
  y: number;
  width: number;
  delay: number;
  duration: number;
}

export default function LoginPage() {
  const supabase = createClient();
  const [stars, setStars]               = useState<Star[]>([]);
  const [shootingStars, setShootingStars] = useState<ShootingStar[]>([]);

  useEffect(() => {
    // Estrellas estáticas titilantes
    setStars(
      Array.from({ length: 120 }, (_, i) => ({
        id: i,
        x:        Math.random() * 100,
        y:        Math.random() * 100,
        size:     Math.random() * 3 + 0.8,
        delay:    Math.random() * 6,
        duration: Math.random() * 3 + 2,
        opacity:  Math.random() * 0.5 + 0.2,
      }))
    );

    // Estrellas fugaces
    setShootingStars(
      Array.from({ length: 7 }, (_, i) => ({
        id: i,
        x:        Math.random() * 85,
        y:        Math.random() * 55,
        width:    Math.random() * 80 + 80,   // 80–160 px
        delay:    i * 1.8 + Math.random() * 2,
        duration: Math.random() * 0.6 + 0.7, // 0.7–1.3 s de vuelo, pausa incluida en keyframe
      }))
    );
  }, []);

  const handleGoogleLogin = async () => {
    const origin = window.location.origin;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { 
        redirectTo: `${origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        }
      },
    });
  };

  return (
    <div
      className="min-h-screen w-full relative overflow-hidden flex items-center justify-center"
      style={{
        background:
          "linear-gradient(160deg, #f0fffb 0%, #ffffff 50%, #ecfdf9 100%)",
      }}
    >
      {/* Glow suave de fondo */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 65% 45% at 20% 70%, rgba(0,214,188,0.08) 0%, transparent 70%), " +
            "radial-gradient(ellipse 55% 55% at 80% 25%, rgba(0,214,188,0.06) 0%, transparent 70%)",
        }}
      />

      {/* Estrellas titilantes verdes */}
      {stars.map((s) => (
        <span
          key={s.id}
          className="absolute rounded-full"
          style={{
            left:             `${s.x}%`,
            top:              `${s.y}%`,
            width:            `${s.size}px`,
            height:           `${s.size}px`,
            backgroundColor:  `rgba(0, 214, 188, ${s.opacity})`,
            animation:        `starTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Estrellas fugaces */}
      {shootingStars.map((s) => (
        <span
          key={`sh-${s.id}`}
          className="absolute"
          style={{
            left:       `${s.x}%`,
            top:        `${s.y}%`,
            width:      `${s.width}px`,
            height:     "2px",
            borderRadius: "2px",
            background:
              "linear-gradient(to right, transparent 0%, rgba(0,214,188,0.15) 30%, rgba(0,214,188,0.9) 100%)",
            animation:  `shootingStar ${s.duration * 6}s ease-out ${s.delay}s infinite`,
          }}
        />
      ))}

      {/* Card de login */}
      <div className="relative z-10 bg-white/90 backdrop-blur-sm p-12 rounded-[3rem] text-center max-w-md w-full mx-4"
        style={{ boxShadow: "0 20px 60px -10px rgba(0,214,188,0.15), 0 4px 20px rgba(0,0,0,0.06)" }}>
        <div className="w-20 h-20 rounded-[1.5rem] bg-primary/10 flex items-center justify-center mx-auto mb-8">
          <img
            src="https://www.alegra.com/favicon.ico"
            alt="Alegra"
            className="w-12 h-12 object-contain"
          />
        </div>
        <h2 className="text-3xl font-black text-[#1e293b] mb-3">
          People <span className="text-primary">Alegra</span>
        </h2>
        <p className="text-[#64748b] mb-10 font-medium leading-relaxed">
          Inicia sesión para acceder a tu portal de crecimiento y bienestar.
        </p>
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-4 bg-[#1e293b] text-white py-4 rounded-2xl font-bold hover:bg-primary hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
        >
          <img
            src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
            alt="Google"
            className="w-6 h-6 bg-white rounded-full p-0.5"
          />
          Ingresar con Google
        </button>
      </div>
    </div>
  );
}
