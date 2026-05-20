/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Ambient declaration for `uuid` (no bundled .d.ts; @types/uuid not installed)
declare module 'uuid' {
  export function v4(): string;
  export function v1(): string;
  export function v3(name: string, namespace: string): string;
  export function v5(name: string, namespace: string): string;
  export function validate(uuid: string): boolean;
  export function version(uuid: string): number;
}

// Ambient declaration for the `chrome` extension namespace.
// Used by src/extensions/clipper/** service workers.
// Replace with @types/chrome if finer-grained typing is needed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: any;
// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace chrome {
  // All type-position references (e.g. `chrome.runtime.MessageSender`) resolve to any.
  // This is a coarse shim; install @types/chrome for proper typing.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace runtime {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type MessageSender = any;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace storage {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type StorageChange = any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type AreaName = any;
  }
}
