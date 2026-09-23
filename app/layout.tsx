import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import Navegacao from "./components/Navegacao";
import BarraDeOperacao from "./components/BarraDeOperacao";
import { ProvedorDeOperacao } from "@/lib/operacao";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--fonte-display",
  display: "swap",
});

const corpo = Manrope({
  subsets: ["latin"],
  variable: "--fonte-corpo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PrevChef — previsão de vendas e compras",
  description:
    "Painel de gestão de restaurante: previsão de vendas por prato, salão, cozinha, estoque e compras.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${corpo.variable}`}>
      <body className="min-h-screen antialiased">
        <ProvedorDeOperacao>
        <header className="sticky top-0 z-20 px-4 pt-4">
          <div className="vidro mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 rounded-[22px] px-5 py-3.5">
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden
                className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-jade-400/35 bg-gradient-to-br from-jade-400/30 to-jade-400/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-jade-300"
                >
                  <path d="M3 11h18a9 9 0 0 1-9 9 9 9 0 0 1-9-9Z" />
                  <path d="M9 7c0-1.2-1.2-1.6-1.2-2.8" />
                  <path d="M13 6.4c0-1.4-1.4-1.9-1.4-3.2" />
                </svg>
              </span>
              <div>
                <p className="font-display text-xl font-semibold tracking-tight text-marfim">
                  PrevChef
                </p>
                <p className="text-xs text-marfim/58">
                  Previsão de vendas e compras
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Navegacao />
              <BarraDeOperacao />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-7">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-12 pt-4 text-xs leading-relaxed text-marfim/40">
          PrevChef · previsão de vendas, gestão de salão e cozinha. Previsão do
          tempo por Open-Meteo; leitura do dia por modelo de linguagem.
        </footer>
        </ProvedorDeOperacao>
      </body>
    </html>
  );
}
