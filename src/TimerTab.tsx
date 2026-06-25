import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "@harborclient/plugin-api/react";
import type {
  PluginContext,
  RequestTabContext,
} from "@harborclient/plugin-api";
import { resolveOptionalPositiveInt, resolvePositiveInt } from "./timerFields";
import { isTimerActive, startTimer, stopTimer } from "./timerRuntime";
import {
  defaultTimerSettings,
  parseStoredTimerSettings,
  requestSettingsKey,
  type TimerSettings,
} from "./timerSettings";

interface Props {
  /**
   * Read-only request tab context from HarborClient.
   */
  context: RequestTabContext;

  /**
   * Renderer plugin context for send and storage APIs.
   */
  hc: PluginContext;
}

/**
 * Formats a future timestamp for the run status display.
 *
 * @param timestampMs - Target time in milliseconds.
 */
function formatNextSend(timestampMs: number): string {
  const deltaMs = timestampMs - Date.now();
  if (deltaMs <= 0) {
    return "now";
  }
  if (deltaMs < 1000) {
    return "in less than 1s";
  }
  const seconds = Math.round(deltaMs / 1000);
  return `in ${seconds}s`;
}

/**
 * Timer request tab with interval and delay send modes.
 */
export function TimerTab({ context, hc }: Props) {
  const timerIdRef = useRef<string>();
  if (!timerIdRef.current) {
    timerIdRef.current = `timer-${Math.random().toString(36).slice(2, 11)}`;
  }
  const timerId = timerIdRef.current;
  const settingsKey = useMemo(
    () => requestSettingsKey(context.draft),
    [context.draft.method, context.draft.url]
  );

  const [settings, setSettings] = useState<TimerSettings>(
    defaultTimerSettings()
  );
  const [sendCount, setSendCount] = useState(0);
  const [nextSendAt, setNextSendAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const maxSendsRef = useRef<number | undefined>(undefined);
  const lastResponseKeyRef = useRef<string | null>(null);

  const running = isTimerActive(timerId);

  /**
   * Stable key for detecting response changes after sends complete.
   */
  const responseKey = useMemo(() => {
    if (!context.response) {
      return null;
    }
    return `${context.response.status}:${context.response.durationMs}:${context.response.sizeBytes}`;
  }, [context.response]);

  /**
   * Loads persisted timer field values when the request fingerprint changes.
   */
  useEffect(() => {
    let cancelled = false;

    void hc.storage.get<TimerSettings>(settingsKey).then((stored) => {
      if (cancelled) {
        return;
      }
      setSettings(parseStoredTimerSettings(stored));
      setSettingsLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [hc.storage, settingsKey]);

  /**
   * Persists timer field values when the user edits them.
   */
  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    void hc.storage.set(settingsKey, settings);
  }, [hc.storage, settingsKey, settings, settingsLoaded]);

  /**
   * Stops the timer when the request fingerprint changes (for example after a URL edit).
   */
  useEffect(() => {
    stopTimer(timerId);
    setNextSendAt(null);
    maxSendsRef.current = undefined;
    lastResponseKeyRef.current = null;
  }, [settingsKey, timerId]);

  /**
   * Stops the timer when this tab unmounts or the request tab closes.
   */
  useEffect(() => {
    return () => {
      stopTimer(timerId);
    };
  }, [timerId]);

  /**
   * Counts completed sends and stops when the max-send cap is reached.
   */
  useEffect(() => {
    if (!running || responseKey === null) {
      return;
    }

    if (lastResponseKeyRef.current === null) {
      lastResponseKeyRef.current = responseKey;
      return;
    }

    if (lastResponseKeyRef.current === responseKey) {
      return;
    }

    lastResponseKeyRef.current = responseKey;
    setSendCount((count) => {
      const next = count + 1;
      const max = maxSendsRef.current;
      if (max !== undefined && next >= max) {
        stopTimer(timerId);
        setNextSendAt(null);
      }
      return next;
    });
  }, [running, responseKey, timerId]);

  /**
   * Updates a single persisted settings field.
   */
  const updateSetting = useCallback(
    <K extends keyof TimerSettings>(key: K, value: TimerSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  /**
   * Validates fields, starts the timer, and triggers scheduled sends.
   */
  const handleStart = (): void => {
    setLastError(null);

    const delayRaw =
      settings.mode === "interval" ? settings.intervalMs : settings.delayMs;
    const resolvedDelay = resolvePositiveInt(delayRaw, context.variables);
    const resolvedMax = resolveOptionalPositiveInt(
      settings.maxSends,
      context.variables
    );

    if (resolvedDelay.error) {
      setLastError(resolvedDelay.error);
      return;
    }
    if (resolvedMax.error) {
      setLastError(resolvedMax.error);
      return;
    }

    const delayMs = resolvedDelay.value!;
    maxSendsRef.current = resolvedMax.value;
    lastResponseKeyRef.current = null;
    setSendCount(0);
    setNextSendAt(Date.now() + delayMs);

    startTimer({
      id: timerId,
      mode: settings.mode,
      delayMs,
      onTick: () => {
        void hc.host.sendRequest();
        if (settings.mode === "interval") {
          setNextSendAt(Date.now() + delayMs);
        }
      },
      onComplete: () => {
        setNextSendAt(null);
      },
    });
  };

  /**
   * Stops the active timer and clears scheduled send state.
   */
  const handleStop = (): void => {
    stopTimer(timerId);
    setNextSendAt(null);
    maxSendsRef.current = undefined;
    lastResponseKeyRef.current = null;
  };

  const intervalFieldError =
    settings.mode === "interval"
      ? resolvePositiveInt(settings.intervalMs, context.variables).error
      : undefined;
  const delayFieldError =
    settings.mode === "delay"
      ? resolvePositiveInt(settings.delayMs, context.variables).error
      : undefined;
  const maxSendsFieldError = resolveOptionalPositiveInt(
    settings.maxSends,
    context.variables
  ).error;

  const canStart =
    !running && !intervalFieldError && !delayFieldError && !maxSendsFieldError;

  return (
    <div
      className="flex flex-col gap-4 text-[14px] text-text"
      style={{ minHeight: "320px" }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[14px] font-medium text-text">Mode</legend>
        <div
          className="flex flex-wrap gap-4"
          role="radiogroup"
          aria-label="Timer mode"
        >
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`${timerId}-mode`}
              value="interval"
              checked={settings.mode === "interval"}
              disabled={running}
              onChange={() => updateSetting("mode", "interval")}
            />
            Interval
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name={`${timerId}-mode`}
              value="delay"
              checked={settings.mode === "delay"}
              disabled={running}
              onChange={() => updateSetting("mode", "delay")}
            />
            Delay
          </label>
        </div>
      </fieldset>

      {settings.mode === "interval" ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${timerId}-interval`}>Interval (ms)</label>
          <input
            id={`${timerId}-interval`}
            type="text"
            className="rounded-md border border-separator bg-control px-3 py-1.5 text-[14px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            value={settings.intervalMs}
            disabled={running}
            aria-invalid={intervalFieldError != null}
            aria-describedby={
              intervalFieldError != null
                ? `${timerId}-interval-error`
                : undefined
            }
            onChange={(event) =>
              updateSetting("intervalMs", event.target.value)
            }
          />
          {intervalFieldError != null ? (
            <p
              id={`${timerId}-interval-error`}
              className="text-[14px] text-danger"
              role="status"
            >
              {intervalFieldError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${timerId}-delay`}>Delay (ms)</label>
          <input
            id={`${timerId}-delay`}
            type="text"
            className="rounded-md border border-separator bg-control px-3 py-1.5 text-[14px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            value={settings.delayMs}
            disabled={running}
            aria-invalid={delayFieldError != null}
            aria-describedby={
              delayFieldError != null ? `${timerId}-delay-error` : undefined
            }
            onChange={(event) => updateSetting("delayMs", event.target.value)}
          />
          {delayFieldError != null ? (
            <p
              id={`${timerId}-delay-error`}
              className="text-[14px] text-danger"
              role="status"
            >
              {delayFieldError}
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`${timerId}-max-sends`}>Max sends (optional)</label>
        <input
          id={`${timerId}-max-sends`}
          type="text"
          className="rounded-md border border-separator bg-control px-3 py-1.5 text-[14px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          value={settings.maxSends}
          disabled={running}
          aria-invalid={maxSendsFieldError != null}
          aria-describedby={
            maxSendsFieldError != null
              ? `${timerId}-max-sends-error`
              : undefined
          }
          onChange={(event) => updateSetting("maxSends", event.target.value)}
        />
        {maxSendsFieldError != null ? (
          <p
            id={`${timerId}-max-sends-error`}
            className="text-[14px] text-danger"
            role="status"
          >
            {maxSendsFieldError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1.5 text-[14px] text-on-accent hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          disabled={!canStart}
          onClick={handleStart}
        >
          Start
        </button>
        <button
          type="button"
          className="rounded-md bg-control px-3 py-1.5 text-[14px] text-text hover:bg-control-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
          disabled={!running}
          onClick={handleStop}
        >
          Stop
        </button>
      </div>

      <div className="flex flex-col gap-1" role="status" aria-live="polite">
        <p className="text-[14px] text-text">
          Status: {running ? "Running" : "Stopped"}
        </p>
        <p className="text-[14px] text-text">Send count: {sendCount}</p>
        {running && nextSendAt !== null ? (
          <p className="text-[14px] text-text">
            Next send: {formatNextSend(nextSendAt)}
          </p>
        ) : null}
        {lastError != null ? (
          <p className="text-[14px] text-danger">{lastError}</p>
        ) : null}
      </div>
    </div>
  );
}
