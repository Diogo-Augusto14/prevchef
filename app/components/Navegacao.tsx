"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/", rotulo: "Painel" },
  { href: "/servico", rotulo: "Serviço" },
  { href: "/cozinha", rotulo: "Cozinha" },
  { href: "/estoque", rotulo: "Estoque" },
  { href: "/desempenho", rotulo: "Desempenho" },
];

export default function Navegacao() {
  const caminho = usePathname();

  return (
    <nav className="flex flex-wrap gap-1.5" aria-label="Seções do PrevChef">
      {ABAS.map((aba) => {
        const ativa = caminho === aba.href;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={
              ativa
                ? "rounded-full bg-gradient-to-b from-fogo-400 to-fogo-600 px-4 py-2 text-[13px] font-bold text-tinta shadow-[0_8px_22px_-10px_rgba(255,122,72,0.9)]"
                : "rounded-full border border-white/10 px-4 py-2 text-[13px] font-medium text-marfim/80 transition hover:border-white/20 hover:bg-white/5 hover:text-marfim"
            }
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
