import type { Metadata } from "next";
import { Libre_Baskerville } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  variable: "--font-editorial",
  weight: ["400", "700"],
  display: "swap"
});

export const metadata: Metadata = {
  title: "TailorGraph",
  description: "Fit-first menswear marketplace MVP"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={libreBaskerville.variable}>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
