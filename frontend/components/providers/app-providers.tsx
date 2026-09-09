"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Lang, Theme, translate } from "@/lib/i18n";

const THEME_KEY = "oqzaro:theme";
const LANG_KEY = "oqzaro:lang";

interface AppSettings {
  theme: Theme;
  lang: Lang;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  toggleTheme: () => void;
  toggleLang: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const AppSettingsContext = createContext<AppSettings | null>(null);

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(LANG_KEY);
    return stored === "ar" || stored === "fr" ? stored : "en";
  } catch {
    return "en";
  }
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    setThemeState(readStoredTheme());
    setLangState(readStoredLang());
  }, []);

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute("data-theme", theme);
    el.classList.toggle("dark", theme === "dark");
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage errors (private mode)
    }
  }, [theme]);

  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === "ar" ? "rtl" : "ltr";
    try {
      window.localStorage.setItem(LANG_KEY, lang);
    } catch {
      // ignore storage errors (private mode)
    }
  }, [lang]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === "dark" ? "light" : "dark")),
    [],
  );
  const toggleLang = useCallback(() => {
    setLangState((prev) => {
      const order: Lang[] = ["ar", "en", "fr"];
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  }, []);
  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(lang, key, vars),
    [lang],
  );

  const value = useMemo(
    () => ({ theme, lang, setTheme, setLang, toggleTheme, toggleLang, t }),
    [theme, lang, setTheme, setLang, toggleTheme, toggleLang, t],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettings {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) {
    throw new Error("useAppSettings must be used within <AppProviders>");
  }
  return ctx;
}
