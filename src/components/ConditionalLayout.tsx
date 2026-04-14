"use client";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Footer from "./Footer";

// Rutas que no muestran el layout principal (sin Header ni Footer)
const AUTH_ROUTES = ["/login"];

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (AUTH_ROUTES.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-12">
        {children}
      </main>
      <Footer />
    </>
  );
}
