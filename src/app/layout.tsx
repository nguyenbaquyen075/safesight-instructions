// SPDX-License-Identifier: MIT

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SafeSight AI — Construction Safety Monitoring",
    template: "%s | SafeSight AI",
  },
  description:
    "AI-powered construction site safety monitoring & alert system. Real-time PPE detection, zone violation alerts, and compliance analytics.",
  keywords: [
    "construction safety",
    "PPE detection",
    "AI monitoring",
    "safety compliance",
    "SafeSight",
  ],
};

import Providers from "@/components/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
