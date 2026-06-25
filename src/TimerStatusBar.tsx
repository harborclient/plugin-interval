import { useSyncExternalStore } from "@harborclient/sdk/react";
import type {
  PluginContext,
  RequestTabContext,
} from "@harborclient/sdk";
import {
  getActiveTimerCount,
  isTimerActive,
  stopTimer,
  subscribeTimerRuntime,
} from "./timerRuntime";

interface Props {
  /**
   * Read-only request tab context from HarborClient.
   */
  context: RequestTabContext;

  /**
   * Renderer plugin context for status bar subscription.
   */
  hc: PluginContext;
}

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
