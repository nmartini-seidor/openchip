"use client";

import clsx from "clsx";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { FilePlus2, LayoutDashboard, Settings, Users } from "lucide-react";
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
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);
  const showInternalNavigation = hasInternalNavigation(pathname, sessionUser);
  const showCreateCaseNav = canCreateCase(sessionUser) && !pathname.startsWith("/supplier/") && pathname !== "/login";
  const showAdministrationNav = canAccessAdministration(sessionUser);
  const showHeader = pathname !== "/login";

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      if (userMenuRef.current !== null && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isUserMenuOpen]);

  const navItems: NavItem[] = [
    {
      href: "/",
      label: t("nav.overview"),
      isActive: (value) => value === "/",
      icon: <LayoutDashboard aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
    }
  ];

  if (showCreateCaseNav) {
    navItems.push({
      href: "/cases/new",
      label: t("nav.newCase"),
      isActive: (value) => value === "/cases/new",
      icon: <FilePlus2 aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
    });
  }

  if (showAdministrationNav) {
    navItems.push(
      {
        href: "/users",
        label: t("nav.users"),
        isActive: (value) => value === "/users",
        icon: <Users aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
      },
      {
        href: "/portal-settings",
        label: t("nav.portalSettings"),
        isActive: (value) => value === "/portal-settings",
        icon: <Settings aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
      }
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="grid min-h-screen grid-cols-1">
        <div className="min-w-0">
          {showHeader ? (
            <header className="sticky top-0 z-20 min-w-0 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur lg:px-8">
              <div className="grid min-w-0 items-center gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                <div className="flex min-w-0 items-center gap-3">
                  <Link href="/" className="cursor-pointer" aria-label={t("appName")}>
                    <Image src="/logo-openchip.svg" alt={t("appName")} width={140} height={44} className="h-8 w-auto" priority />
                  </Link>
                </div>

                {showInternalNavigation ? (
                  <nav className="hidden min-w-0 max-w-full items-center justify-center gap-2 overflow-x-auto pb-1 lg:flex" aria-label="Primary navigation">
                    {navItems.map((item) => {
                      const active = item.isActive(pathname);
                      return (
                        <Link
                          key={`header-${item.label}`}
                          href={item.href}
                          className={clsx(
                            "inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-base font-semibold",
                            active
                              ? "border-b-[var(--border-strong)] text-slate-900"
                              : "border-b-transparent text-slate-600 hover:border-b-slate-300 hover:text-slate-900"
                          )}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                ) : (
                  <div className="hidden lg:block" aria-hidden="true" />
                )}

                {sessionUser !== null ? (
                  <div className="flex items-center justify-start gap-2 lg:justify-end">
                    <div ref={userMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setIsUserMenuOpen((current) => !current)}
                        className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-slate-700 hover:bg-[var(--surface-muted)]"
                        aria-haspopup="menu"
                        aria-expanded={isUserMenuOpen}
                      >
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-xs font-semibold text-slate-800">
                          {getInitials(sessionUser, t("guestInitials"))}
                        </span>
                        <span className="hidden sm:inline">{sessionUser.displayName}</span>
                      </button>
                      {isUserMenuOpen ? (
                        <div className="absolute right-0 z-10 mt-2 w-64 rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
                          <p className="text-sm font-semibold text-slate-900">{sessionUser.displayName}</p>
                          <p className="text-xs text-slate-600">{sessionUser.email}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">{sessionUser.role}</p>

                          <form method="post" action="/api/preferences/locale" className="mt-3">
                            <label htmlFor="shell-locale" className="mb-1 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                              {t("language.label")}
                            </label>
                            <select
                              id="shell-locale"
                              name="locale"
                              defaultValue={locale}
                              aria-label={t("language.label")}
                              onChange={(event) => {
                                setIsUserMenuOpen(false);
                                event.currentTarget.form?.requestSubmit();
                              }}
                              className="oc-input oc-select min-h-8 py-1 text-xs font-semibold text-slate-700"
                            >
                              <option value="en">{`🇬🇧 ${t("language.english")}`}</option>
                              <option value="es">{`🇪🇸 ${t("language.spanish")}`}</option>
                            </select>
                            <input type="hidden" name="returnTo" value={pathname} />
                          </form>

                          <form method="post" action="/api/auth/logout" className="mt-3">
                            <button type="submit" className="oc-btn oc-btn-secondary w-full text-xs">
                              {t("logout")}
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="hidden lg:block" aria-hidden="true" />
                )}
              </div>
              {!showInternalNavigation ? null : (
                <div className="mt-3 block lg:hidden">
                  <nav className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto pb-1" aria-label="Primary navigation">
                    {navItems.map((item) => {
                      const active = item.isActive(pathname);
                      return (
                        <Link
                          key={`mobile-header-${item.label}`}
                          href={item.href}
                          className={clsx(
                            "inline-flex shrink-0 cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-base font-semibold",
                            active
                              ? "border-b-[var(--border-strong)] text-slate-900"
                              : "border-b-transparent text-slate-600 hover:border-b-slate-300 hover:text-slate-900"
                          )}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                </div>
              )}
            </header>
          ) : null}
          <div className="w-full px-4 py-6 lg:px-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
