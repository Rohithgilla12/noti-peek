/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_ENABLE_EXPERIMENTAL_PROVIDERS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
