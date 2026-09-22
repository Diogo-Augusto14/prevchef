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
const EIXO = "rgba(244,247,245,0.50)";
const GRADE = "rgba(255,255,255,0.08)";
const REAL = "rgba(244,247,245,0.38)";
const PREVISTO = "#6FDCB0";

export default function GraficoDesempenho({
  serie,
}: {
  serie: PontoComparacao[];
}) {
  const dados = serie.map((p) => ({ ...p, rotulo: dataCurta(p.data) }));

  return (
    <div className="h-80 w-full">
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
            tick={{ fontSize: 11, fill: EIXO }}
            tickLine={false}
            axisLine={false}
            width={48}
            label={{
              value: "porções",
              angle: -90,
              position: "insideLeft",
              offset: 16,
              style: { fontSize: 11, fill: "rgba(244,247,245,0.40)" },
            }}
          />
          <Tooltip
            cursor={{ stroke: "rgba(255,255,255,0.18)" }}
            formatter={(valor: number, nome: string) => [
              `${valor} porções`,
              nome === "real" ? "Real" : "Previsto",
            ]}
            labelFormatter={(_rotulo, carga) => {
              const ponto = carga?.[0]?.payload as PontoComparacao | undefined;
              return ponto ? dataLonga(ponto.data) : "";
            }}
            contentStyle={{
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(15,23,20,0.92)",
              backdropFilter: "blur(16px)",
              color: "#F4F7F5",
              fontSize: 12,
              boxShadow: "0 18px 40px -20px rgba(0,0,0,0.9)",
            }}
            labelStyle={{ color: "rgba(244,247,245,0.62)" }}
            itemStyle={{ color: "#F4F7F5" }}
          />
          <Legend
            formatter={(valor) => (
              <span style={{ color: "rgba(244,247,245,0.72)" }}>
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
