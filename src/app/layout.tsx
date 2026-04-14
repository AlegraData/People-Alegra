import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "People Alegra - Dashboard",
  description: "Portal de crecimiento de Alegra",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${jakarta.className} min-h-screen flex flex-col bg-[#f1f5f9] text-[#1e293b]`}>
        <Header />
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 md:px-8 py-12">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
