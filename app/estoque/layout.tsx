import type { Metadata } from "next";

export const metadata: Metadata = { title: "Estoque — PrevChef" };

export default function EstoqueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
