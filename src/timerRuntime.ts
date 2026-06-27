/**
 * Active timer handle stored in the module registry.
 */
interface TimerHandle {
  /**
   * Unique timer id (per Timer tab instance).
   */
  id: string;

  /**
   * Clears the underlying timeout or interval.
   */
  stop: () => void;
}

const timers = new Map<string, TimerHandle>();
const listeners = new Set<() => void>();

/**
 * Notifies subscribers that the active timer count changed.
 */
function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

/**
 * Returns the number of active timers for status bar display.
 */
export function getActiveTimerCount(): number {
  return timers.size;
}

/**
 * Subscribes to active timer count changes for {@link useSyncExternalStore}.
 *
 * @param listener - Called when a timer starts or stops.
 * @returns Unsubscribe function.
 */
export function subscribeTimerRuntime(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Stops and removes a timer by id.
 *
 * @param id - Timer id from {@link startTimer}.
 */
export function stopTimer(id: string): void {
  const handle = timers.get(id);
  if (!handle) {
    return;
  }

  handle.stop();
  timers.delete(id);
  emitChange();
}

/**
 * Stops every active timer and clears the registry.
 */
export function clearAllTimers(): void {
  for (const handle of timers.values()) {
    handle.stop();
  }
  timers.clear();
  emitChange();
}

/**
 * Options for {@link startTimer}.
 */
export interface StartTimerOptions {
  /**
   * Unique timer id (per Timer tab instance).
   */
  id: string;

  /**
   * Scheduling mode.
   */
  mode: 'interval' | 'delay';

  /**
   * Delay or interval duration in milliseconds.
   */
  delayMs: number;

  /**
   * Called on each scheduled tick.
   */
  onTick: () => void;

  /**
   * Called after a delay-mode timer fires and stops.
   */
  onComplete?: () => void;
}

/**
 * Starts an interval or one-shot delay timer.
 *
 * Replaces any existing timer registered with the same id.
 *
 * @param options - Timer configuration and tick handler.
 */
export function startTimer(options: StartTimerOptions): void {
  stopTimer(options.id);

  let intervalId: ReturnType<typeof setInterval> | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const stop = (): void => {
    if (intervalId !== undefined) {
      clearInterval(intervalId);
      intervalId = undefined;
    }
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  };

  const handle: TimerHandle = {
    id: options.id,
    stop: () => {
      stop();
      if (timers.get(options.id) === handle) {
        timers.delete(options.id);
        emitChange();
      }
    }
  };

  if (options.mode === 'interval') {
    intervalId = setInterval(options.onTick, options.delayMs);
  } else {
    timeoutId = setTimeout(() => {
      options.onTick();
      options.onComplete?.();
      handle.stop();
    }, options.delayMs);
  }

  timers.set(options.id, handle);
  emitChange();
}

/**
 * Returns whether a timer id is currently active.
 *
 * @param id - Timer id to check.
 */
export function isTimerActive(id: string): boolean {
  return timers.has(id);
}
