import type { PluginContext } from '@harborclient/sdk';
import { TimerStatusBar } from './TimerStatusBar';
import { TimerTab } from './TimerTab';
import { clearAllTimers } from './timerRuntime';

/**
 * Registers the Timer request tab and status bar indicator when the plugin activates.
 *
 * @param hc - Plugin API surface from HarborClient.
 */
export function activate(hc: PluginContext): void {
  hc.ui.registerRequestTab({
    id: 'timer',
    title: 'Timer',
    order: 50,
    Component: ({ context }) => <TimerTab context={context} hc={hc} />
  });

  hc.ui.registerStatusBarItem({
    id: 'timer-active',
    alignment: 'right',
    order: 50,
    Component: TimerStatusBar
  });
}

/**
 * Stops all active timers when the plugin deactivates.
 */
export function deactivate(): void {
  clearAllTimers();
}
