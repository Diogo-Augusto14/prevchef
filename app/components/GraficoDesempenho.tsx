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
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="rotulo"
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={{ stroke: "#cbd5e1" }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#64748b" }}
            tickLine={false}
            axisLine={false}
            width={48}
            label={{
              value: "porções",
              angle: -90,
              position: "insideLeft",
              offset: 16,
              style: { fontSize: 11, fill: "#94a3b8" },
            }}
          />
          <Tooltip
            formatter={(valor: number, nome: string) => [
              `${valor} porções`,
              nome === "real" ? "Real" : "Previsto",
            ]}
            labelFormatter={(_rotulo, carga) => {
              const ponto = carga?.[0]?.payload as PontoComparacao | undefined;
              return ponto ? dataLonga(ponto.data) : "";
            }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(valor) => (valor === "real" ? "Real" : "Previsto (KNN)")}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Line
            type="monotone"
            dataKey="real"
            stroke="#94a3b8"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="previsto"
            stroke="#059669"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
