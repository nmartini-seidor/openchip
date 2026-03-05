import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Public_Sans } from "next/font/google";
import { DashboardShell } from "@/components/dashboard-shell";
import { getCurrentLocale, getSessionUser } from "@/lib/auth";
import "./globals.css";

const headingFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-heading"
});

const bodyFont = Public_Sans({
  subsets: ["latin"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Openchip Supplier Onboarding",
  description: "Supplier onboarding portal with validation, compliance tracking, and SAP handoff"
};

export const viewport: Viewport = {
  themeColor: "#f4f6f8"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [sessionUser, locale] = await Promise.all([getSessionUser(), getCurrentLocale()]);

  return (
    <html lang={locale}>
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900"
        >
          Skip to Main Content
        </a>
        <DashboardShell locale={locale} sessionUser={sessionUser}>
          {children}
        </DashboardShell>
      </body>
    </html>
  );
}
