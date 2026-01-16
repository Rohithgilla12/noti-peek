import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Theme =
  | 'catppuccin-mocha'
  | 'catppuccin-latte'
  | 'tokyo-night'
  | 'tokyo-night-storm'
  | 'dracula'
  | 'nord'
  | 'gruvbox-dark'
  | 'one-dark'
  | 'github-dark'
  | 'rose-pine'
  | 'rose-pine-moon'
  | 'ayu-dark'
  | 'synthwave';

export interface ThemeInfo {
  id: Theme;
  name: string;
  preview: string;
}

export const themes: ThemeInfo[] = [
  { id: 'catppuccin-mocha', name: 'Catppuccin Mocha', preview: '#1e1e2e' },
  { id: 'catppuccin-latte', name: 'Catppuccin Latte', preview: '#eff1f5' },
  { id: 'tokyo-night', name: 'Tokyo Night', preview: '#1a1b26' },
  { id: 'tokyo-night-storm', name: 'Tokyo Night Storm', preview: '#24283b' },
  { id: 'dracula', name: 'Dracula', preview: '#282a36' },
  { id: 'nord', name: 'Nord', preview: '#2e3440' },
  { id: 'gruvbox-dark', name: 'Gruvbox Dark', preview: '#282828' },
  { id: 'one-dark', name: 'One Dark Pro', preview: '#282c34' },
  { id: 'github-dark', name: 'GitHub Dark', preview: '#0d1117' },
  { id: 'rose-pine', name: 'Rose Pine', preview: '#191724' },
  { id: 'rose-pine-moon', name: 'Rose Pine Moon', preview: '#232136' },
  { id: 'ayu-dark', name: 'Ayu Dark', preview: '#0b0e14' },
  { id: 'synthwave', name: "Synthwave '84", preview: '#262335' },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'catppuccin-mocha',
  setTheme: () => {},
});

const STORAGE_KEY = 'noti-peek-theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('catppuccin-mocha');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && themes.some((t) => t.id === stored)) {
      setThemeState(stored);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
