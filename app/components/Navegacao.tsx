"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/", rotulo: "Painel" },
  { href: "/estoque", rotulo: "Estoque" },
  { href: "/desempenho", rotulo: "Desempenho" },
];

export default function Navegacao() {
  const caminho = usePathname();

  return (
    <nav className="flex gap-1" aria-label="Seções do PrevChef">
      {ABAS.map((aba) => {
        const ativa = caminho === aba.href;
        return (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={ativa ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              ativa
                ? "bg-marca-600 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {aba.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
