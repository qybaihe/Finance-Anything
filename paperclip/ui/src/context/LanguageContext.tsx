import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import zhCN from "@/i18n/zh-CN";

export type AppLocale = "en" | "zh-CN";

type TranslateParams = Record<string, string | number | boolean | null | undefined>;

interface LanguageContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: string, params?: TranslateParams) => string;
  locales: Array<{ value: AppLocale; label: string }>;
}

const STORAGE_KEY = "paperclip.locale";
const DEFAULT_LOCALES: Array<{ value: AppLocale; label: string }> = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
];

function interpolate(template: string, params?: TranslateParams) {
  if (!params) return template;
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
    const value = params[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

function normalizeLocale(value: string | null | undefined): AppLocale {
  return value === "en" ? "en" : "zh-CN";
}

function detectLocale(): AppLocale {
  return "zh-CN";
}

function readStoredLocale(): AppLocale | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeLocale(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

const dictionaries: Record<AppLocale, Record<string, string>> = {
  en: {},
  "zh-CN": zhCN,
};

const defaultValue: LanguageContextValue = {
  locale: "zh-CN",
  setLocale: () => undefined,
  t: (key, params) => interpolate(key, params),
  locales: DEFAULT_LOCALES,
};

const LanguageContext = createContext<LanguageContextValue>(defaultValue);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => readStoredLocale() ?? detectLocale());

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(normalizeLocale(nextLocale));
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, locale);
      } catch {
        // Ignore storage failures in restricted environments.
      }
    }
  }, [locale]);

  const t = useCallback((key: string, params?: TranslateParams) => {
    const template = dictionaries[locale][key] ?? key;
    return interpolate(template, params);
  }, [locale]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      locale,
      setLocale,
      t,
      locales: DEFAULT_LOCALES,
    }),
    [locale, setLocale, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
