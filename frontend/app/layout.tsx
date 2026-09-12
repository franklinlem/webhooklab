import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebhookLab — Inspecione webhooks em tempo real",
  description: "Crie um endpoint temporário e veja requisições HTTP em tempo real.",
  robots: { index: false, follow: false },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

