import type { Metadata } from "next";
import Navegacao from "./components/Navegacao";
import "./globals.css";

export const metadata: Metadata = {
  title: "PrevChef — previsão de vendas e compras",
  description:
    "Protótipo de painel para gerente de restaurante: prevê a venda de cada prato e sugere a lista de compras. Dados simulados.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-marca-600 text-lg text-white"
              >
                🍲
              </span>
              <div>
                <p className="text-base font-semibold tracking-tight text-slate-900">
                  PrevChef
                </p>
                <p className="text-xs text-slate-500">
                  Previsão de vendas e compras · protótipo com dados simulados
                </p>
              </div>
            </div>
            <Navegacao />
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>

        <footer className="mx-auto max-w-6xl px-4 pb-10 pt-4 text-xs text-slate-400">
          PrevChef · protótipo acadêmico. Histórico, estoque e fichas técnicas são
          dados simulados por script; o KNN roda no navegador; a previsão do tempo
          vem da Open-Meteo e a análise automática de um modelo de linguagem.
        </footer>
      </body>
    </html>
  );
}
