import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import Navegacao from "./components/Navegacao";
import BarraDeOperacao from "./components/BarraDeOperacao";
import AvisoDeOutraTela from "./components/AvisoDeOutraTela";
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
  title: "PrevChef — previsão e gestão do restaurante",
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
        {/* Só gruda onde cabe numa faixa: no celular ele quebra em várias
            linhas e, fixo, comeria um terço da tela. */}
        <header className="relative z-20 px-4 pt-4 lg:sticky lg:top-0 lg:px-6 2xl:px-8">
          <div className="vidro vidro-flutuante mx-auto flex max-w-[2560px] flex-wrap items-center justify-between gap-4 rounded-[22px] px-5 py-3">
            <div className="flex items-center gap-3.5">
              <span
                aria-hidden
                className="flex h-[42px] w-[42px] items-center justify-center rounded-[14px] border border-fogo-500/40 bg-gradient-to-br from-fogo-500/28 to-fogo-500/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]"
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
                  className="text-fogo-300"
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
                  Previsão e gestão do restaurante
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Navegacao />
              <BarraDeOperacao />
            </div>
          </div>
        </header>

        {/* A tela ocupa a largura toda; o teto só segura monitor ultrawide. */}
        <main className="mx-auto max-w-[2560px] px-4 py-6 lg:px-6 2xl:px-8">{children}</main>

        <footer className="mx-auto max-w-[2560px] px-4 pb-12 pt-4 text-xs leading-relaxed text-marfim/55 lg:px-6 2xl:px-8">
          PrevChef · previsão de vendas, gestão de salão e cozinha. Previsão do
          tempo por Open-Meteo; leitura do dia por modelo de linguagem.
        </footer>

        <AvisoDeOutraTela />
        </ProvedorDeOperacao>
      </body>
    </html>
  );
}
