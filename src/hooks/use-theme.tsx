import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type Ctx = {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  resetTheme: () => void;
  isSystem: boolean;
};

const ThemeContext = createContext<Ctx | undefined>(undefined);

function getSystemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [isSystem, setIsSystem] = useState(false);

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("theme")) as Theme | null;
    const hasStored = typeof window !== "undefined" && localStorage.getItem("theme") !== null;
    const initial: Theme = stored ?? getSystemTheme();
    setThemeState(initial);
    setIsSystem(!hasStored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    try {
      if (isSystem) {
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", theme);
      }
    } catch {}
  }, [theme, isSystem]);

  useEffect(() => {
    if (!isSystem) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setThemeState(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [isSystem]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    setIsSystem(false);
  };

  const toggleTheme = () => {
    setThemeState((t) => (t === "dark" ? "light" : "dark"));
    setIsSystem(false);
  };

  const resetTheme = () => {
    const system = getSystemTheme();
    setThemeState(system);
    setIsSystem(true);
  };

  return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, resetTheme, isSystem }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
