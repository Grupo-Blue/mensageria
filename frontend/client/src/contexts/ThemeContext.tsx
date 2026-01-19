import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme?: () => void;
  setTheme?: (theme: Theme) => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  switchable?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  switchable = false,
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (switchable) {
      // Primeiro tenta pegar do localStorage
      const stored = localStorage.getItem("theme");
      if (stored === "dark" || stored === "light") {
        return stored as Theme;
      }
      
      // Se não tiver no localStorage, detecta preferência do sistema
      if (typeof window !== "undefined") {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        return prefersDark ? "dark" : "light";
      }
      
      return defaultTheme;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    
    // Tailwind usa apenas a classe "dark" - adiciona se dark, remove se light
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Salva no localStorage se switchable
    if (switchable) {
      localStorage.setItem("theme", theme);
    }
    
    console.log("[Theme] Tema aplicado:", theme, "Classe dark:", root.classList.contains("dark"));
  }, [theme, switchable]);

  // Listener para mudanças na preferência do sistema (apenas se não tiver tema salvo)
  useEffect(() => {
    if (!switchable) return;
    
    const stored = localStorage.getItem("theme");
    if (stored) return; // Se já tem tema salvo, ignora preferência do sistema
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? "dark" : "light");
    };
    
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [switchable]);

  const toggleTheme = switchable
    ? () => {
        setTheme(prev => (prev === "light" ? "dark" : "light"));
      }
    : undefined;

  const setThemeDirect = switchable
    ? (newTheme: Theme) => {
        setTheme(newTheme);
      }
    : undefined;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: setThemeDirect, switchable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
