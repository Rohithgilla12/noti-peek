import { useCallback, useEffect, useState } from 'react';
// @ts-expect-error — install via: bun add @tauri-apps/plugin-updater
import { check, type Update } from '@tauri-apps/plugin-updater';
// @ts-expect-error — install via: bun add @tauri-apps/plugin-process
import { relaunch } from '@tauri-apps/plugin-process';

/** Subset of the updater progress event shape — narrow to what we consume. */
type UpdateProgressEvent =
  | { event: 'Started'; data: { contentLength?: number } }
  | { event: 'Progress'; data: { chunkLength: number } }
  | { event: 'Finished'; data?: unknown };

export type UpdaterStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'no-update' }
  | { kind: 'available'; update: Update }
  | { kind: 'downloading'; percent: number | null }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

/**
 * Hook for Tauri auto-updates.
 *
 * Prereq (one-time):
 *   cd app && bun add @tauri-apps/plugin-updater @tauri-apps/plugin-process
 *
 * Usage in Settings.tsx:
 *
 *   const { status, checkNow, installNow } = useUpdater({ checkOnMount: true });
 *
 *   // Render a "Check for updates" button that calls checkNow(),
 *   // and an "Install & Relaunch" button when status.kind === 'available' or 'ready'.
 *
 * Behavior:
 *   - `checkOnMount` fires a silent check once on startup. Safe to enable in prod.
 *   - On 'available' the update is NOT auto-downloaded — the user clicks installNow().
 *   - After a successful install the app relaunches via @tauri-apps/plugin-process.
 */
export function useUpdater(opts: { checkOnMount?: boolean } = {}) {
  const [status, setStatus] = useState<UpdaterStatus>({ kind: 'idle' });

  const checkNow = useCallback(async () => {
    setStatus({ kind: 'checking' });
    try {
      const update = await check();
      if (update) {
        setStatus({ kind: 'available', update });
      } else {
        setStatus({ kind: 'no-update' });
      }
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const installNow = useCallback(async () => {
    if (status.kind !== 'available') return;
    const { update } = status;

    try {
      let downloaded = 0;
      let total = 0;

      await update.downloadAndInstall((event: UpdateProgressEvent) => {
        switch (event.event) {
          case 'Started':
            total = event.data.contentLength ?? 0;
            setStatus({ kind: 'downloading', percent: total ? 0 : null });
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            setStatus({
              kind: 'downloading',
              percent: total ? Math.min(100, Math.round((downloaded / total) * 100)) : null,
            });
            break;
          case 'Finished':
            setStatus({ kind: 'ready' });
            break;
        }
      });

      await relaunch();
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [status]);

  useEffect(() => {
    if (opts.checkOnMount) {
      void checkNow();
    }
  }, [opts.checkOnMount, checkNow]);

  return { status, checkNow, installNow };
}
