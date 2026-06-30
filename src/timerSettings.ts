import type { RequestDraft } from '@harborclient/sdk';
import { asRecord, oneOf, str } from '@harborclient/sdk/storage';

/**
 * Timer mode for scheduled sends.
 */
export type TimerMode = 'interval' | 'delay';

/**
 * Persisted timer field values for a request fingerprint.
 */
export interface TimerSettings {
  /**
   * Active scheduling mode.
   */
  mode: TimerMode;

  /**
   * Raw interval field value in milliseconds.
   */
  intervalMs: string;

  /**
   * Raw delay field value in milliseconds.
   */
  delayMs: string;

  /**
   * Raw max sends cap; empty means unlimited.
   */
  maxSends: string;
}

/**
 * Default timer settings shown for new requests.
 */
export const defaultTimerSettings = (): TimerSettings => ({
  mode: 'interval',
  intervalMs: '1000',
  delayMs: '1000',
  maxSends: ''
});

const STORAGE_PREFIX = 'timer-settings:';

/**
 * Builds a stable storage key from the request method and URL.
 *
 * @param draft - Active request draft from the editor tab.
 */
export function requestSettingsKey(draft: RequestDraft): string {
  return `${STORAGE_PREFIX}${draft.method}:${draft.url}`;
}

/**
 * Loads persisted timer settings for a request fingerprint.
 *
 * @param key - Storage key from {@link requestSettingsKey}.
 * @param stored - Value returned from plugin storage, if any.
 */
export function parseStoredTimerSettings(stored: unknown): TimerSettings {
  const record = asRecord(stored);
  if (!record) {
    return defaultTimerSettings();
  }

  return {
    mode: oneOf(record.mode, ['interval', 'delay'] as const, 'interval'),
    intervalMs: str(record.intervalMs, '1000'),
    delayMs: str(record.delayMs, '1000'),
    maxSends: str(record.maxSends, '')
  };
}
