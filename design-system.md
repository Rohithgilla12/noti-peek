# noti-peek Design System

> A themeable, developer-focused design system that feels like home.

---

## Design Philosophy

1. **Match the IDE** — Developers spend hours in their editor. noti-peek should feel native to that environment.
2. **Dense but readable** — Information-rich without feeling cramped.
3. **Themeable first** — Every color is a variable. No hardcoded colors.
4. **Subtle motion** — Animations should feel snappy, not sluggish.
5. **Desktop-native** — Tighter spacing, smaller radii than typical web apps.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Theme Provider                    │
│  ┌─────────────────────────────────────────────────┐│
│  │              CSS Variables Layer                ││
│  │  --bg-base, --bg-surface, --text-primary, etc.  ││
│  └─────────────────────────────────────────────────┘│
│                         │                            │
│  ┌──────────┬──────────┬──────────┬──────────┐     │
│  │ Catppuccin│ Tokyo    │ Dracula  │ Nord     │ ... │
│  │ Mocha     │ Night    │          │          │     │
│  └──────────┴──────────┴──────────┴──────────┘     │
└─────────────────────────────────────────────────────┘
```

---

## CSS Variables

### Core Variables

```css
:root {
  /* Backgrounds */
  --bg-base: ; /* Main app background */
  --bg-surface: ; /* Cards, list items, panels */
  --bg-overlay: ; /* Modals, dropdowns */
  --bg-highlight: ; /* Hover states */

  /* Text */
  --text-primary: ; /* Main text */
  --text-secondary: ; /* Muted text, timestamps */
  --text-tertiary: ; /* Disabled, placeholders */

  /* Borders */
  --border-default: ; /* Default borders */
  --border-muted: ; /* Subtle dividers */

  /* Accent */
  --accent: ; /* Primary accent (buttons, links) */
  --accent-hover: ; /* Accent hover state */
  --accent-muted: ; /* Accent at lower opacity */

  /* Semantic */
  --success: ; /* Success states */
  --warning: ; /* Warning states */
  --error: ; /* Error states */
  --info: ; /* Info states */

  /* Source-specific (integration branding) */
  --github: ;
  --linear: ;
  --jira: ;
  --bitbucket: ;

  /* Unread indicator */
  --unread: ; /* Unread dot/badge */

  /* Spacing (consistent across themes) */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 0.75rem;
  --spacing-lg: 1rem;
  --spacing-xl: 1.5rem;

  /* Radius (tight for desktop feel) */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;

  /* Typography */
  --font-sans: "Inter", -apple-system, BlinkMacSystemFont, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", monospace;

  --text-xs: 0.75rem;
  --text-sm: 0.8125rem;
  --text-base: 0.875rem;
  --text-lg: 1rem;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
}
```

---

## Theme Definitions

### Catppuccin Mocha (Default Dark)

```css
[data-theme="catppuccin-mocha"] {
  --bg-base: #1e1e2e;
  --bg-surface: #313244;
  --bg-overlay: #45475a;
  --bg-highlight: #585b70;

  --text-primary: #cdd6f4;
  --text-secondary: #a6adc8;
  --text-tertiary: #6c7086;

  --border-default: #45475a;
  --border-muted: #313244;

  --accent: #89b4fa;
  --accent-hover: #b4befe;
  --accent-muted: rgba(137, 180, 250, 0.2);

  --success: #a6e3a1;
  --warning: #f9e2af;
  --error: #f38ba8;
  --info: #89dceb;

  --github: #a6e3a1;
  --linear: #cba6f7;
  --jira: #89b4fa;
  --bitbucket: #89b4fa;

  --unread: #89b4fa;
}
```

### Catppuccin Latte (Light)

```css
[data-theme="catppuccin-latte"] {
  --bg-base: #eff1f5;
  --bg-surface: #e6e9ef;
  --bg-overlay: #dce0e8;
  --bg-highlight: #ccd0da;

  --text-primary: #4c4f69;
  --text-secondary: #6c6f85;
  --text-tertiary: #9ca0b0;

  --border-default: #ccd0da;
  --border-muted: #dce0e8;

  --accent: #1e66f5;
  --accent-hover: #7287fd;
  --accent-muted: rgba(30, 102, 245, 0.15);

  --success: #40a02b;
  --warning: #df8e1d;
  --error: #d20f39;
  --info: #04a5e5;

  --github: #40a02b;
  --linear: #8839ef;
  --jira: #1e66f5;
  --bitbucket: #1e66f5;

  --unread: #1e66f5;
}
```

### Tokyo Night

```css
[data-theme="tokyo-night"] {
  --bg-base: #1a1b26;
  --bg-surface: #24283b;
  --bg-overlay: #414868;
  --bg-highlight: #565f89;

  --text-primary: #c0caf5;
  --text-secondary: #9aa5ce;
  --text-tertiary: #565f89;

  --border-default: #3b4261;
  --border-muted: #292e42;

  --accent: #7aa2f7;
  --accent-hover: #89ddff;
  --accent-muted: rgba(122, 162, 247, 0.2);

  --success: #9ece6a;
  --warning: #e0af68;
  --error: #f7768e;
  --info: #7dcfff;

  --github: #9ece6a;
  --linear: #bb9af7;
  --jira: #7aa2f7;
  --bitbucket: #7aa2f7;

  --unread: #7aa2f7;
}
```

### Tokyo Night Storm

```css
[data-theme="tokyo-night-storm"] {
  --bg-base: #24283b;
  --bg-surface: #1f2335;
  --bg-overlay: #414868;
  --bg-highlight: #565f89;

  --text-primary: #c0caf5;
  --text-secondary: #9aa5ce;
  --text-tertiary: #565f89;

  --border-default: #3b4261;
  --border-muted: #292e42;

  --accent: #7aa2f7;
  --accent-hover: #89ddff;
  --accent-muted: rgba(122, 162, 247, 0.2);

  --success: #9ece6a;
  --warning: #e0af68;
  --error: #f7768e;
  --info: #7dcfff;

  --github: #9ece6a;
  --linear: #bb9af7;
  --jira: #7aa2f7;
  --bitbucket: #7aa2f7;

  --unread: #7aa2f7;
}
```

### Dracula

```css
[data-theme="dracula"] {
  --bg-base: #282a36;
  --bg-surface: #44475a;
  --bg-overlay: #6272a4;
  --bg-highlight: #44475a;

  --text-primary: #f8f8f2;
  --text-secondary: #bfbfbf;
  --text-tertiary: #6272a4;

  --border-default: #44475a;
  --border-muted: #383a46;

  --accent: #bd93f9;
  --accent-hover: #ff79c6;
  --accent-muted: rgba(189, 147, 249, 0.2);

  --success: #50fa7b;
  --warning: #f1fa8c;
  --error: #ff5555;
  --info: #8be9fd;

  --github: #50fa7b;
  --linear: #bd93f9;
  --jira: #8be9fd;
  --bitbucket: #8be9fd;

  --unread: #ff79c6;
}
```

### Nord

```css
[data-theme="nord"] {
  --bg-base: #2e3440;
  --bg-surface: #3b4252;
  --bg-overlay: #434c5e;
  --bg-highlight: #4c566a;

  --text-primary: #eceff4;
  --text-secondary: #d8dee9;
  --text-tertiary: #4c566a;

  --border-default: #4c566a;
  --border-muted: #3b4252;

  --accent: #88c0d0;
  --accent-hover: #8fbcbb;
  --accent-muted: rgba(136, 192, 208, 0.2);

  --success: #a3be8c;
  --warning: #ebcb8b;
  --error: #bf616a;
  --info: #81a1c1;

  --github: #a3be8c;
  --linear: #b48ead;
  --jira: #81a1c1;
  --bitbucket: #81a1c1;

  --unread: #88c0d0;
}
```

### Gruvbox Dark

```css
[data-theme="gruvbox-dark"] {
  --bg-base: #282828;
  --bg-surface: #3c3836;
  --bg-overlay: #504945;
  --bg-highlight: #665c54;

  --text-primary: #ebdbb2;
  --text-secondary: #d5c4a1;
  --text-tertiary: #928374;

  --border-default: #504945;
  --border-muted: #3c3836;

  --accent: #83a598;
  --accent-hover: #8ec07c;
  --accent-muted: rgba(131, 165, 152, 0.2);

  --success: #b8bb26;
  --warning: #fabd2f;
  --error: #fb4934;
  --info: #83a598;

  --github: #b8bb26;
  --linear: #d3869b;
  --jira: #83a598;
  --bitbucket: #83a598;

  --unread: #fe8019;
}
```

### One Dark Pro

```css
[data-theme="one-dark"] {
  --bg-base: #282c34;
  --bg-surface: #21252b;
  --bg-overlay: #3e4451;
  --bg-highlight: #3e4451;

  --text-primary: #abb2bf;
  --text-secondary: #828997;
  --text-tertiary: #5c6370;

  --border-default: #3e4451;
  --border-muted: #2c323c;

  --accent: #61afef;
  --accent-hover: #56b6c2;
  --accent-muted: rgba(97, 175, 239, 0.2);

  --success: #98c379;
  --warning: #e5c07b;
  --error: #e06c75;
  --info: #56b6c2;

  --github: #98c379;
  --linear: #c678dd;
  --jira: #61afef;
  --bitbucket: #61afef;

  --unread: #61afef;
}
```

### GitHub Dark

```css
[data-theme="github-dark"] {
  --bg-base: #0d1117;
  --bg-surface: #161b22;
  --bg-overlay: #21262d;
  --bg-highlight: #30363d;

  --text-primary: #e6edf3;
  --text-secondary: #8b949e;
  --text-tertiary: #484f58;

  --border-default: #30363d;
  --border-muted: #21262d;

  --accent: #58a6ff;
  --accent-hover: #79c0ff;
  --accent-muted: rgba(88, 166, 255, 0.15);

  --success: #3fb950;
  --warning: #d29922;
  --error: #f85149;
  --info: #58a6ff;

  --github: #3fb950;
  --linear: #a371f7;
  --jira: #58a6ff;
  --bitbucket: #58a6ff;

  --unread: #58a6ff;
}
```

### Rosé Pine

```css
[data-theme="rose-pine"] {
  --bg-base: #191724;
  --bg-surface: #1f1d2e;
  --bg-overlay: #26233a;
  --bg-highlight: #403d52;

  --text-primary: #e0def4;
  --text-secondary: #908caa;
  --text-tertiary: #6e6a86;

  --border-default: #26233a;
  --border-muted: #1f1d2e;

  --accent: #c4a7e7;
  --accent-hover: #ebbcba;
  --accent-muted: rgba(196, 167, 231, 0.2);

  --success: #31748f;
  --warning: #f6c177;
  --error: #eb6f92;
  --info: #9ccfd8;

  --github: #31748f;
  --linear: #c4a7e7;
  --jira: #9ccfd8;
  --bitbucket: #9ccfd8;

  --unread: #ebbcba;
}
```

### Rosé Pine Moon

```css
[data-theme="rose-pine-moon"] {
  --bg-base: #232136;
  --bg-surface: #2a273f;
  --bg-overlay: #393552;
  --bg-highlight: #44415a;

  --text-primary: #e0def4;
  --text-secondary: #908caa;
  --text-tertiary: #6e6a86;

  --border-default: #393552;
  --border-muted: #2a273f;

  --accent: #c4a7e7;
  --accent-hover: #ea9a97;
  --accent-muted: rgba(196, 167, 231, 0.2);

  --success: #3e8fb0;
  --warning: #f6c177;
  --error: #eb6f92;
  --info: #9ccfd8;

  --github: #3e8fb0;
  --linear: #c4a7e7;
  --jira: #9ccfd8;
  --bitbucket: #9ccfd8;

  --unread: #ea9a97;
}
```

### Ayu Dark

```css
[data-theme="ayu-dark"] {
  --bg-base: #0b0e14;
  --bg-surface: #0d1017;
  --bg-overlay: #131721;
  --bg-highlight: #1c212b;

  --text-primary: #bfbdb6;
  --text-secondary: #6c7380;
  --text-tertiary: #464b5d;

  --border-default: #1c212b;
  --border-muted: #131721;

  --accent: #e6b450;
  --accent-hover: #ffb454;
  --accent-muted: rgba(230, 180, 80, 0.2);

  --success: #7fd962;
  --warning: #ffb454;
  --error: #d95757;
  --info: #59c2ff;

  --github: #7fd962;
  --linear: #d2a6ff;
  --jira: #59c2ff;
  --bitbucket: #59c2ff;

  --unread: #e6b450;
}
```

### Synthwave '84

```css
[data-theme="synthwave"] {
  --bg-base: #262335;
  --bg-surface: #2a2139;
  --bg-overlay: #34294f;
  --bg-highlight: #463465;

  --text-primary: #ffffff;
  --text-secondary: #bbbbbb;
  --text-tertiary: #6f6f6f;

  --border-default: #463465;
  --border-muted: #34294f;

  --accent: #f97e72;
  --accent-hover: #ff7edb;
  --accent-muted: rgba(249, 126, 114, 0.2);

  --success: #72f1b8;
  --warning: #fede5d;
  --error: #fe4450;
  --info: #36f9f6;

  --github: #72f1b8;
  --linear: #ff7edb;
  --jira: #36f9f6;
  --bitbucket: #36f9f6;

  --unread: #ff7edb;
}
```

---

## Component Styles

### Notification Item

```tsx
// NotificationItem.tsx
<div
  className="
  group
  flex items-start gap-3
  px-3 py-2.5
  bg-[var(--bg-surface)]
  hover:bg-[var(--bg-highlight)]
  border-b border-[var(--border-muted)]
  cursor-pointer
  transition-colors duration-150
"
>
  {/* Unread indicator */}
  {unread && (
    <div
      className="
      w-2 h-2 mt-2
      rounded-full
      bg-[var(--unread)]
    "
    />
  )}

  {/* Source icon */}
  <div
    className="
    w-8 h-8
    flex items-center justify-center
    rounded-[var(--radius-md)]
    bg-[var(--bg-overlay)]
  "
  >
    <SourceIcon source={source} className="w-4 h-4" />
  </div>

  {/* Content */}
  <div className="flex-1 min-w-0">
    <p
      className="
      text-[var(--text-sm)]
      text-[var(--text-primary)]
      font-medium
      truncate
    "
    >
      {title}
    </p>
    <p
      className="
      text-[var(--text-xs)]
      text-[var(--text-secondary)]
      truncate
      mt-0.5
    "
    >
      {repo || project} · {relativeTime}
    </p>
  </div>

  {/* Type badge */}
  <span
    className="
    px-1.5 py-0.5
    text-[var(--text-xs)]
    text-[var(--text-secondary)]
    bg-[var(--bg-overlay)]
    rounded-[var(--radius-sm)]
  "
  >
    {type}
  </span>
</div>
```

### Source Filter Tabs

```tsx
// SourceTabs.tsx
<div
  className="
  flex gap-1
  p-1
  bg-[var(--bg-surface)]
  rounded-[var(--radius-md)]
"
>
  {sources.map((source) => (
    <button
      key={source.id}
      className={cn(
        "px-3 py-1.5",
        "text-[var(--text-sm)]",
        "rounded-[var(--radius-sm)]",
        "transition-colors duration-150",
        active === source.id
          ? "bg-[var(--bg-overlay)] text-[var(--text-primary)]"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]",
      )}
    >
      {source.label}
      {source.count > 0 && (
        <span
          className="
          ml-1.5 px-1.5
          text-[var(--text-xs)]
          bg-[var(--accent-muted)]
          text-[var(--accent)]
          rounded-full
        "
        >
          {source.count}
        </span>
      )}
    </button>
  ))}
</div>
```

### System Tray Badge

```tsx
// Badge colors per theme
const badgeColors = {
  "catppuccin-mocha": "#89b4fa",
  "tokyo-night": "#7aa2f7",
  dracula: "#ff79c6",
  // ... etc
};
```

---

## Typography Scale

| Name        | Size             | Line Height | Use                            |
| ----------- | ---------------- | ----------- | ------------------------------ |
| `text-xs`   | 0.75rem (12px)   | 1rem        | Timestamps, badges             |
| `text-sm`   | 0.8125rem (13px) | 1.25rem     | Secondary text, metadata       |
| `text-base` | 0.875rem (14px)  | 1.5rem      | Body text, notification titles |
| `text-lg`   | 1rem (16px)      | 1.5rem      | Section headers                |

---

## Spacing System

Dense spacing for desktop-native feel:

| Token | Value | Use                          |
| ----- | ----- | ---------------------------- |
| `xs`  | 4px   | Inline spacing, icon margins |
| `sm`  | 8px   | Tight padding, small gaps    |
| `md`  | 12px  | Default padding              |
| `lg`  | 16px  | Section spacing              |
| `xl`  | 24px  | Large gaps, modal padding    |

---

## Icons

### Source Icons

Use brand-accurate SVGs:

```tsx
// icons/sources.tsx
export const GitHubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    {/* GitHub Octocat path */}
  </svg>
)

export const LinearIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    {/* Linear logo path */}
  </svg>
)

// Apply source-specific colors
<GitHubIcon className="text-[var(--github)]" />
<LinearIcon className="text-[var(--linear)]" />
```

### Type Icons

Use Lucide icons with semantic meaning:

| Type         | Icon             |
| ------------ | ---------------- |
| Pull Request | `GitPullRequest` |
| Issue        | `CircleDot`      |
| Comment      | `MessageSquare`  |
| Review       | `Eye`            |
| Merge        | `GitMerge`       |
| Release      | `Tag`            |
| Mention      | `AtSign`         |
| Assigned     | `UserPlus`       |

---

## Motion

Subtle, snappy animations:

```css
/* Default transition */
.transition-default {
  transition: all 150ms ease-out;
}

/* List item enter */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.notification-enter {
  animation: slideIn 150ms ease-out;
}

/* Unread dot pulse (subtle) */
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

.unread-dot {
  animation: pulse 2s ease-in-out infinite;
}
```

---

## Theme Switcher Component

```tsx
// ThemeSwitcher.tsx
const themes = [
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", preview: "#1e1e2e" },
  { id: "catppuccin-latte", name: "Catppuccin Latte", preview: "#eff1f5" },
  { id: "tokyo-night", name: "Tokyo Night", preview: "#1a1b26" },
  { id: "tokyo-night-storm", name: "Tokyo Night Storm", preview: "#24283b" },
  { id: "dracula", name: "Dracula", preview: "#282a36" },
  { id: "nord", name: "Nord", preview: "#2e3440" },
  { id: "gruvbox-dark", name: "Gruvbox Dark", preview: "#282828" },
  { id: "one-dark", name: "One Dark Pro", preview: "#282c34" },
  { id: "github-dark", name: "GitHub Dark", preview: "#0d1117" },
  { id: "rose-pine", name: "Rosé Pine", preview: "#191724" },
  { id: "rose-pine-moon", name: "Rosé Pine Moon", preview: "#232136" },
  { id: "ayu-dark", name: "Ayu Dark", preview: "#0b0e14" },
  { id: "synthwave", name: "Synthwave '84", preview: "#262335" },
];

export function ThemeSwitcher() {
  const [theme, setTheme] = useTheme();

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full border border-[var(--border-default)]"
            style={{ background: themes.find((t) => t.id === theme)?.preview }}
          />
          {themes.find((t) => t.id === theme)?.name}
        </div>
      </SelectTrigger>
      <SelectContent>
        {themes.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full border border-[var(--border-default)]"
                style={{ background: t.preview }}
              />
              {t.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

---

## Theme Context

```tsx
// context/theme.tsx
import { createContext, useContext, useEffect, useState } from "react";

type Theme =
  | "catppuccin-mocha"
  | "catppuccin-latte"
  | "tokyo-night"
  | "tokyo-night-storm"
  | "dracula"
  | "nord"
  | "gruvbox-dark"
  | "one-dark"
  | "github-dark"
  | "rose-pine"
  | "rose-pine-moon"
  | "ayu-dark"
  | "synthwave";

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: "catppuccin-mocha",
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("catppuccin-mocha");

  useEffect(() => {
    // Load from storage
    const stored = localStorage.getItem("noti-peek-theme") as Theme;
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    // Apply to document
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("noti-peek-theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

---

## Future: Custom Theme Import

Allow users to import their VS Code theme:

```tsx
// utils/importVSCodeTheme.ts
interface VSCodeTheme {
  colors: {
    "editor.background": string;
    "editor.foreground": string;
    "sideBar.background": string;
    "list.hoverBackground": string;
    focusBorder: string;
    // ... etc
  };
}

function convertVSCodeTheme(vscodeTheme: VSCodeTheme): CSSVariables {
  return {
    "--bg-base": vscodeTheme.colors["editor.background"],
    "--bg-surface": vscodeTheme.colors["sideBar.background"],
    "--text-primary": vscodeTheme.colors["editor.foreground"],
    "--accent": vscodeTheme.colors["focusBorder"],
    // ... mapping logic
  };
}
```

---

## File Structure

```
src/
├── styles/
│   ├── themes/
│   │   ├── catppuccin-mocha.css
│   │   ├── catppuccin-latte.css
│   │   ├── tokyo-night.css
│   │   ├── tokyo-night-storm.css
│   │   ├── dracula.css
│   │   ├── nord.css
│   │   ├── gruvbox-dark.css
│   │   ├── one-dark.css
│   │   ├── github-dark.css
│   │   ├── rose-pine.css
│   │   ├── rose-pine-moon.css
│   │   ├── ayu-dark.css
│   │   └── synthwave.css
│   ├── variables.css       # Core CSS variables
│   └── globals.css         # Global styles
├── context/
│   └── theme.tsx           # Theme context
├── components/
│   └── ThemeSwitcher.tsx   # Theme dropdown
└── hooks/
    └── useTheme.ts         # Theme hook
```

---

## Checklist

- [ ] Set up CSS variables structure
- [ ] Implement all 13 themes
- [ ] Create ThemeProvider context
- [ ] Build ThemeSwitcher component
- [ ] Persist theme choice in storage
- [ ] Apply source-specific colors
- [ ] Test all themes for contrast/readability
- [ ] Add theme preview in settings
- [ ] (Future) VS Code theme import

---

_Last updated: January 2025_
