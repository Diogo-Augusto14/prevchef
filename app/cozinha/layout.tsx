import type { Metadata } from "next";

export const metadata: Metadata = { title: "Cozinha — PrevChef" };

export default function CozinhaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
