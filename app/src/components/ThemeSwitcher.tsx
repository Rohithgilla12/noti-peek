import { useTheme, themes } from '../context/theme';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="relative">
      <select
        value={theme}
        onChange={(e) => setTheme(e.target.value as typeof theme)}
        className="w-full p-2 text-[length:var(--text-sm)] rounded-[var(--radius-md)] appearance-none cursor-pointer pr-8
          bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)]
          hover:border-[var(--accent)] focus:outline-none focus:border-[var(--accent)]
          transition-colors duration-150"
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full border border-[var(--border-default)]"
          style={{ background: themes.find((t) => t.id === theme)?.preview }}
        />
        <span className="text-[var(--text-tertiary)]">▼</span>
      </div>
    </div>
  );
}
