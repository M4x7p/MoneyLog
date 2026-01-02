import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/SessionContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MoneyLog - Family Expense Tracker",
  description: "Track and manage your family expenses together. Import bank statements, categorize expenses, and gain insights.",
  keywords: ["expense tracker", "family budget", "KBank", "Thailand", "personal finance"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-slate-950 text-white`}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
