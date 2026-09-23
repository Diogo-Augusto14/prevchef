import type { Metadata } from "next";

export const metadata: Metadata = { title: "Serviço — PrevChef" };

export default function ServicoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
