"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { dataCurta, dataLonga } from "@/lib/dados";
import type { PontoComparacao } from "@/lib/mae";

/* Cores do tema escuro — o gráfico não herda as classes do Tailwind. */
const EIXO = "rgba(242,240,234,0.50)";
const GRADE = "rgba(242,240,234,0.08)";
const REAL = "rgba(242,240,234,0.38)";
const PREVISTO = "#FF7A48";

export default function GraficoDesempenho({
  serie,
}: {
  serie: PontoComparacao[];
}) {
  const dados = serie.map((p) => ({ ...p, rotulo: dataCurta(p.data) }));

  // O eixo começa perto do menor valor: com o zero embaixo, a faixa entre
  // zero e o vale das linhas ficava vazia e as curvas se espremiam no topo.
  const valores = serie.flatMap((p) => [p.real, p.previsto]);
  const menor = valores.length ? Math.min(...valores) : 0;
  const maior = valores.length ? Math.max(...valores) : 10;
  const folga = Math.max((maior - menor) * 0.12, 2);
  const piso = Math.max(0, Math.floor((menor - folga) / 10) * 10);
  const teto = Math.ceil((maior + folga) / 10) * 10;

  return (
    <div className="h-80 w-full 2xl:h-[380px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={GRADE} vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fontSize: 11, fill: EIXO }}
            tickLine={false}
            axisLine={{ stroke: GRADE }}
            minTickGap={24}
          />
          <YAxis
            domain={[piso, teto]}
            tick={{ fontSize: 11, fill: EIXO }}
            tickLine={false}
            axisLine={false}
            width={48}
            label={{
              value: "porções",
              angle: -90,
              position: "insideLeft",
              offset: 16,
              style: { fontSize: 11, fill: "rgba(242,240,234,0.40)" },
            }}
          />
          <Tooltip
            cursor={{ stroke: "rgba(242,240,234,0.18)" }}
            formatter={(valor: number, nome: string) => [
              `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} porções`,
              nome === "real" ? "Real" : "Previsto",
            ]}
            labelFormatter={(_rotulo, carga) => {
              const ponto = carga?.[0]?.payload as PontoComparacao | undefined;
              return ponto ? dataLonga(ponto.data) : "";
            }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(17,21,34,0.92)",
              backdropFilter: "blur(16px)",
              color: "#F2F0EA",
              fontSize: 12,
              boxShadow: "0 18px 40px -20px rgba(0,0,0,0.9)",
            }}
            labelStyle={{ color: "rgba(242,240,234,0.62)" }}
            itemStyle={{ color: "#F2F0EA" }}
          />
          <Legend
            formatter={(valor) => (
              <span style={{ color: "rgba(242,240,234,0.72)" }}>
                {valor === "real" ? "Real" : "Previsto (KNN)"}
              </span>
            )}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="real"
            stroke={REAL}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="previsto"
            stroke={PREVISTO}
            strokeWidth={2.4}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
