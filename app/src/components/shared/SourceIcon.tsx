import type { Provider } from '../../lib/types';
import type { Scope } from '../../lib/view';
import type { ReactElement } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

const PROVIDER_VIEWBOX: Record<Provider, string> = {
  github: '0 0 24 24',
  linear: '0 0 100 100',
  jira: '0 0 24 24',
  bitbucket: '0 0 24 24',
};

const PROVIDER_PATHS: Record<Provider, ReactElement> = {
  github: (
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  ),
  linear: (
    <path d="M1.225 61.523c-.222-.949.908-1.546 1.597-.857l36.512 36.512c.69.69.092 1.82-.857 1.597-18.425-4.323-32.93-18.827-37.252-37.252ZM.002 46.889a.99.99 0 0 0 .29.76L52.35 99.71c.201.2.478.307.76.29 2.37-.149 4.695-.46 6.963-.927.765-.157 1.03-1.096.478-1.648L2.576 39.448c-.552-.551-1.491-.286-1.648.479a50.067 50.067 0 0 0-.926 6.962ZM4.21 29.705a.988.988 0 0 0 .208 1.1l64.776 64.776c.289.29.726.375 1.1.208a49.908 49.908 0 0 0 5.185-2.684.981.981 0 0 0 .183-1.54L8.436 24.336a.981.981 0 0 0-1.541.183 49.896 49.896 0 0 0-2.684 5.185Zm8.448-11.631a.986.986 0 0 1-.045-1.354C21.78 6.46 35.111 0 49.952 0 77.592 0 100 22.407 100 50.048c0 14.84-6.46 28.172-16.72 37.338a.986.986 0 0 1-1.354-.045L12.659 18.074Z" />
  ),
  jira: (
    <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.005-1.005zm5.723-5.756H5.736a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.758a1.001 1.001 0 0 0-1.001-1.001zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24 12.483V1.005A1.005 1.005 0 0 0 23.013 0z" />
  ),
  bitbucket: (
    <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891zM14.52 15.53H9.522L8.17 8.466h7.561z" />
  ),
};

const SCOPE_PATHS: Record<Scope, ReactElement> = {
  inbox: <path d="M3 3h10v6h-3l-1 2H7l-1-2H3V3zm0 8h10v2H3v-2z" fill="currentColor" />,
  mentions: (
    <path
      d="M8 1.5a6.5 6.5 0 1 0 4.4 11.3l-.7-.7A5.5 5.5 0 1 1 13.5 8v.7a1.3 1.3 0 0 1-2.6 0V8a2.9 2.9 0 1 0-1 2.2A2.3 2.3 0 0 0 14.5 8.7V8A6.5 6.5 0 0 0 8 1.5zm0 4.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2z"
      fill="currentColor"
    />
  ),
  bookmarks: (
    <path
      d="M4 1.5h8a.5.5 0 0 1 .5.5v12.2a.3.3 0 0 1-.5.2L8 11.5l-4 2.9a.3.3 0 0 1-.5-.2V2a.5.5 0 0 1 .5-.5z"
      fill="currentColor"
    />
  ),
  links: (
    <path
      d="M6.5 9.5l3-3M5 11l-1.5 1.5a2.1 2.1 0 1 1-3-3L2 8m9-3l1.5-1.5a2.1 2.1 0 1 1 3 3L14 8"
      stroke="currentColor"
      strokeWidth="1.4"
      fill="none"
      strokeLinecap="round"
    />
  ),
  archive: <path d="M2 4h12v2H2V4zm1 3h10v6H3V7zm3 2v1h4V9H6z" fill="currentColor" />,
};

export function SourceIcon({
  provider,
  size = 14,
  className,
}: IconProps & { provider: Provider }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={PROVIDER_VIEWBOX[provider]}
      fill="currentColor"
      aria-label={provider}
      role="img"
      className={className}
    >
      {PROVIDER_PATHS[provider]}
    </svg>
  );
}

export function ScopeIcon({ scope, size = 14, className }: IconProps & { scope: Scope }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-label={scope}
      role="img"
      className={className}
    >
      {SCOPE_PATHS[scope]}
    </svg>
  );
}
