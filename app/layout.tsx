import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Les RDV IA — Carte membre",
  description: "Carte membre Les RDV IA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Tight:wght@800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
