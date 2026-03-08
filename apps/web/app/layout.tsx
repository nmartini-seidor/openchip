import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Public_Sans } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { Toaster } from "sonner";
import { DashboardShell } from "@/components/dashboard-shell";
import { getSessionUser } from "@/lib/auth";
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
  const [sessionUser, locale, messages, t] = await Promise.all([
    getSessionUser(),
    getLocale(),
    getMessages(),
    getTranslations("Layout")
  ]);

  return (
    <html lang={locale}>
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-slate-900"
          >
            {t("skipToMainContent")}
          </a>
          <DashboardShell locale={locale} sessionUser={sessionUser}>
            {children}
          </DashboardShell>
          <Toaster richColors position="top-center" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
