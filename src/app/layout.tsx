import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import StoreShell from "@/components/StoreShell";

const inter = Inter({ subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "Emirate Co",
  description: "Интернет-магазин Emirate Co",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <StoreShell>{children}</StoreShell>
      </body>
    </html>
  );
}
