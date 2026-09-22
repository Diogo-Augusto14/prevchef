import type { Metadata } from "next";

export const metadata: Metadata = { title: "Desempenho — PrevChef" };

export default function DesempenhoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
