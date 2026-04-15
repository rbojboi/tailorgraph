import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

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
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
