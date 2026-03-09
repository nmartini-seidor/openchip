"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { InternalRole, SupportedLocale } from "@openchip/shared";

interface ShellUser {
  id: string;
  email: string;
  displayName: string;
  role: InternalRole;
  locale: SupportedLocale;
}

interface DashboardShellProps {
  children: React.ReactNode;
  locale: SupportedLocale;
  sessionUser: ShellUser | null;
}

interface NavItem {
  href: string;
  label: string;
  isActive: (pathname: string) => boolean;
  icon: React.ReactNode;
}

function OverviewIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 10.2 10 4l7 6.2v6.3a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5z" />
      <path d="M8 17v-4h4v4" />
    </svg>
  );
}

function CaseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M6 7h8M6 10h8M6 13h5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M6.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M13.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
      <path d="M2.5 16a4.5 4.5 0 0 1 8 0" />
      <path d="M10.5 16a3.7 3.7 0 0 1 6 0" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M10 3.2 11.2 5l2-.2.8 1.4-1.3 1.4.4 1.8 1.8.8v1.6l-1.8.8-.4 1.8 1.3 1.4-.8 1.4-2-.2L10 16.8l-1.2-1.8-2 .2-.8-1.4 1.3-1.4-.4-1.8-1.8-.8V9.2l1.8-.8.4-1.8L6 5.2l.8-1.4 2 .2z" />
      <circle cx="10" cy="10" r="2.2" />
    </svg>
  );
}

function getInitials(user: ShellUser | null, guestInitials: string): string {
  if (user === null) {
    return guestInitials;
  }

  const names = user.displayName.trim().split(/\s+/);
  if (names.length === 1) {
    return names[0]?.slice(0, 2).toUpperCase() ?? "US";
  }

  return `${names[0]?.[0] ?? "U"}${names[1]?.[0] ?? "S"}`.toUpperCase();
}

function hasInternalNavigation(pathname: string, sessionUser: ShellUser | null): boolean {
  if (sessionUser === null) {
    return false;
  }

  return pathname !== "/login" && !pathname.startsWith("/supplier/");
}

function canCreateCase(sessionUser: ShellUser | null): boolean {
  if (sessionUser === null) {
    return false;
  }

  return ["finance", "purchasing", "requester", "admin"].includes(sessionUser.role);
}

function canAccessAdministration(sessionUser: ShellUser | null): boolean {
  return sessionUser?.role === "admin";
}

export function DashboardShell({ children, locale, sessionUser }: DashboardShellProps) {
  const pathname = usePathname();
  const t = useTranslations("Shell");
  const showInternalNavigation = hasInternalNavigation(pathname, sessionUser);
  const showCreateCaseButton = canCreateCase(sessionUser) && !pathname.startsWith("/supplier/") && pathname !== "/login";
  const showAdministrationNav = canAccessAdministration(sessionUser);
  const showHeaderActions = showCreateCaseButton || sessionUser !== null;
  const showHeader = pathname !== "/login";

  let pageTitle = t("appSection");
  if (pathname === "/") {
    pageTitle = t("nav.overview");
  } else if (pathname === "/cases/new") {
    pageTitle = t("nav.newCase");
  } else if (pathname === "/users") {
    pageTitle = t("nav.users");
  } else if (pathname === "/portal-settings") {
    pageTitle = t("nav.portalSettings");
  } else if (pathname.startsWith("/cases/")) {
    pageTitle = t("page.case");
  } else if (pathname.startsWith("/supplier/")) {
    pageTitle = t("page.supplierPortal");
  } else if (pathname === "/login") {
    pageTitle = t("loginTitle");
  }

  const navItems: NavItem[] = [
    {
      href: "/",
      label: t("nav.overview"),
      isActive: (value) => value === "/",
      icon: <OverviewIcon />
    }
  ];

  if (showCreateCaseButton) {
    navItems.push({
      href: "/cases/new",
      label: t("nav.newCase"),
      isActive: (value) => value === "/cases/new",
      icon: <CaseIcon />
    });
  }

  if (showAdministrationNav) {
    navItems.push(
      {
        href: "/users",
        label: t("nav.users"),
        isActive: (value) => value === "/users",
        icon: <UsersIcon />
      },
      {
        href: "/portal-settings",
        label: t("nav.portalSettings"),
        isActive: (value) => value === "/portal-settings",
        icon: <SettingsIcon />
      }
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className={clsx("grid min-h-screen", showInternalNavigation ? "grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)]" : "grid-cols-1")}>
        {showInternalNavigation ? (
          <aside className="hidden border-r border-[var(--border)] bg-[var(--surface)] px-5 py-6 lg:block">
            <Link href="/" className="block rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-3 hover:bg-[var(--surface-subtle)]">
              <Image src="/logo-openchip.svg" alt={t("appName")} width={168} height={52} className="h-9 w-auto" priority />
              <p className="mt-2 text-sm font-semibold text-slate-900">{t("appSection")}</p>
            </Link>

            <nav className="mt-6 space-y-1" aria-label="Primary navigation">
              {navItems.map((item) => {
                const active = item.isActive(pathname);
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={clsx(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium",
                      active
                        ? "border-[var(--border-strong)] bg-[var(--surface-subtle)] text-slate-900"
                        : "border-transparent text-slate-600 hover:border-[var(--border)] hover:bg-[var(--surface-muted)] hover:text-slate-900"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        ) : null}

        <div className="min-w-0">
          {showHeader ? (
            <header className="sticky top-0 z-20 min-w-0 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:px-8">
              <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Link href="/" className="cursor-pointer" aria-label={t("appName")}>
                    <Image src="/logo-openchip.svg" alt={t("appName")} width={140} height={44} className="h-8 w-auto" priority />
                  </Link>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t("companyTool")}</p>
                    <Link href="/" className="block truncate cursor-pointer text-lg font-semibold text-slate-900 hover:text-[var(--primary)]">
                      {pageTitle}
                    </Link>
                  </div>
                </div>

                {showHeaderActions ? (
                  <div className="flex items-center gap-2">
                    {showCreateCaseButton ? (
                      <Link
                        href="/cases/new"
                        className="oc-btn oc-btn-primary"
                      >
                        {t("createCase")}
                      </Link>
                    ) : null}

                    {sessionUser !== null ? (
                      <>
                        <div className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-1">
                          <form method="post" action="/api/preferences/locale">
                            <input type="hidden" name="locale" value="en" />
                            <input type="hidden" name="returnTo" value={pathname} />
                            <button
                              type="submit"
                              className={clsx(
                                "rounded px-2 py-1 text-xs font-semibold",
                                locale === "en" ? "bg-[var(--surface)] text-slate-900" : "text-slate-600 hover:bg-[var(--surface)]"
                              )}
                              aria-label={t("language.switchToEnglish")}
                            >
                              EN
                            </button>
                          </form>
                          <form method="post" action="/api/preferences/locale">
                            <input type="hidden" name="locale" value="es" />
                            <input type="hidden" name="returnTo" value={pathname} />
                            <button
                              type="submit"
                              className={clsx(
                                "rounded px-2 py-1 text-xs font-semibold",
                                locale === "es" ? "bg-[var(--surface)] text-slate-900" : "text-slate-600 hover:bg-[var(--surface)]"
                              )}
                              aria-label={t("language.switchToSpanish")}
                            >
                              ES
                            </button>
                          </form>
                        </div>

                        <details className="relative">
                          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-slate-700 hover:bg-[var(--surface-muted)]">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-xs font-semibold text-slate-800">
                              {getInitials(sessionUser, t("guestInitials"))}
                            </span>
                            <span className="hidden sm:inline">{sessionUser.displayName}</span>
                          </summary>
                          <div className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
                            <p className="text-sm font-semibold text-slate-900">{sessionUser.displayName}</p>
                            <p className="text-xs text-slate-600">{sessionUser.email}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">{sessionUser.role}</p>

                            <form method="post" action="/api/auth/logout" className="mt-3">
                              <button
                                type="submit"
                                className="oc-btn oc-btn-secondary w-full text-xs"
                              >
                                {t("logout")}
                              </button>
                            </form>
                          </div>
                        </details>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {showInternalNavigation ? (
                <nav className="mt-3 flex w-full min-w-0 max-w-full gap-2 overflow-x-auto pb-1 lg:hidden" aria-label="Mobile navigation">
                  {navItems.map((item) => {
                    const active = item.isActive(pathname);
                    return (
                      <Link
                        key={`mobile-${item.label}`}
                        href={item.href}
                        className={clsx(
                          "inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold",
                          active
                            ? "border-[var(--border-strong)] bg-[var(--surface-subtle)] text-slate-900"
                            : "border-[var(--border)] bg-[var(--surface)] text-slate-600"
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              ) : null}
            </header>
          ) : null}
          <div className="w-full px-4 py-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
