import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { Notification } from './types';

let permissionChecked = false;
let permissionGranted = false;

/**
 * Ensure the OS notification permission prompt has been shown at least
 * once. Returns true if we can currently send notifications.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;
  try {
    if (await isPermissionGranted()) {
      permissionGranted = true;
    } else {
      const result = await requestPermission();
      permissionGranted = result === 'granted';
    }
  } catch (err) {
    console.warn('Notification permission check failed:', err);
    permissionGranted = false;
  } finally {
    permissionChecked = true;
  }
  return permissionGranted;
}

async function windowIsForeground(): Promise<boolean> {
  try {
    const w = getCurrentWindow();
    const [visible, focused] = await Promise.all([w.isVisible(), w.isFocused()]);
    return visible && focused;
  } catch {
    return false;
  }
}

/**
 * Fire a native macOS notification for a freshly-arrived notification,
 * but only when the app window is not already in the foreground
 * (otherwise the user is already looking at the inbox — a system
 * notification would be noise).
 */
export async function notifyNew(n: Notification): Promise<void> {
  if (!(await ensureNotificationPermission())) return;
  if (await windowIsForeground()) return;

  const source = n.source.charAt(0).toUpperCase() + n.source.slice(1);
  const ref = n.repo ?? n.project ?? '';
  const title = ref ? `${source} · ${ref}` : source;

  try {
    sendNotification({
      title,
      body: n.title,
    });
  } catch (err) {
    console.warn('Failed to send notification:', err);
  }
}
