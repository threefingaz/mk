import type { Metadata } from "next";
import { Bungee, Oswald, VT323, JetBrains_Mono, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

const bungee = Bungee({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--f-disp-old",
});

const oswald = Oswald({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--f-disp-new",
});

const vt323 = VT323({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
  variable: "--f-mono-old",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--f-mono-new",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--f-body-new",
});

export const metadata: Metadata = {
  title: "OLD BLOOD // NEW BLOOD",
  description: "Pick your side. Nine duels between the 1995 and 2026 Mortal Kombat casts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      data-btn-shape="banner"
      data-card-shape="tomb"
      lang="en"
      className={`${bungee.variable} ${oswald.variable} ${vt323.variable} ${jetbrainsMono.variable} ${inter.variable}`}
    >
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
