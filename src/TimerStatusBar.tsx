import { useSyncExternalStore } from '@harborclient/sdk/react';
import { getActiveTimerCount, subscribeTimerRuntime } from './timerRuntime';

/**
 * Footer status indicator shown while at least one request timer is active.
 */
export function TimerStatusBar() {
  /**
   * Re-renders when any timer starts or stops in this plugin.
   */
  const activeCount = useSyncExternalStore(
    subscribeTimerRuntime,
    getActiveTimerCount,
    getActiveTimerCount
  );

  if (activeCount === 0) {
    return null;
  }

  return (
    <span className="text-[14px] text-text" role="status">
      Timer running
    </span>
  );
}
