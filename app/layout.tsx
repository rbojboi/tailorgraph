import type { Metadata } from "next";
import { Suspense } from "react";
import { NavigationFeedback } from "@/components/navigation-feedback";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "TailorGraph",
  description: "Fit-first menswear marketplace MVP",
  icons: {
    icon: "/brand/tailorgraph-icon.png",
    apple: "/brand/tailorgraph-icon.png"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <Suspense fallback={null}>
          <NavigationFeedback />
        </Suspense>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
