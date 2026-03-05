import { SupportedLocale, supportedLocales } from "@openchip/shared";

export const defaultLocale: SupportedLocale = "en";

export const localeCookieName = "openchip_locale";

export function isSupportedLocale(value: string): value is SupportedLocale {
  return (supportedLocales as readonly string[]).includes(value);
}

export function resolveLocale(candidate: string | null | undefined): SupportedLocale {
  if (candidate === undefined || candidate === null || candidate.length === 0) {
    return defaultLocale;
  }

  return isSupportedLocale(candidate) ? candidate : defaultLocale;
}

const messages = {
  en: {
    appName: "Openchip",
    appSection: "Supplier Onboarding",
    companyTool: "Company Tool",
    navOverview: "Overview",
    navNewCase: "New Case",
    navUsers: "Users",
    navPortalSettings: "Portal Settings",
    createCase: "Create Case",
    loginTitle: "Sign in",
    loginSubtitle: "Use your Openchip account",
    email: "Email",
    language: "Language",
    signIn: "Sign in",
    guest: "Guest",
    logout: "Log out",
    role: "Role",
    workflow: "Workflow",
    magicLinkCopied: "Magic link copied",
    copyMagicLink: "Copy supplier magic link",
    invitationSla: "Invitation start SLA",
    completionSla: "Onboarding completion SLA",
    onTrack: "On track",
    warning: "Warning",
    overdue: "Overdue",
    completed: "Completed"
  },
  es: {
    appName: "Openchip",
    appSection: "Alta de Proveedores",
    companyTool: "Herramienta Corporativa",
    navOverview: "Resumen",
    navNewCase: "Nuevo Caso",
    navUsers: "Usuarios",
    navPortalSettings: "Configuración del Portal",
    createCase: "Crear Caso",
    loginTitle: "Iniciar sesión",
    loginSubtitle: "Usa tu cuenta de Openchip",
    email: "Correo",
    language: "Idioma",
    signIn: "Entrar",
    guest: "Invitado",
    logout: "Cerrar sesión",
    role: "Rol",
    workflow: "Flujo",
    magicLinkCopied: "Enlace copiado",
    copyMagicLink: "Copiar enlace mágico de proveedor",
    invitationSla: "SLA inicio invitación",
    completionSla: "SLA fin onboarding",
    onTrack: "En plazo",
    warning: "Riesgo",
    overdue: "Vencido",
    completed: "Completado"
  }
} as const;

export type I18nKey = keyof (typeof messages)["en"];

export function t(locale: SupportedLocale, key: I18nKey): string {
  return messages[locale][key];
}

export function getMessages(locale: SupportedLocale): Record<I18nKey, string> {
  return messages[locale] as Record<I18nKey, string>;
}
