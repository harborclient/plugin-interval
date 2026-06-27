import { useCallback, useEffect, useMemo, useRef, useState } from '@harborclient/sdk/react';
import type { PluginContext, RequestTabContext, Variable } from '@harborclient/sdk';
import {
  Button,
  FieldError,
  FormGroup,
  Input,
  StatusMessage,
  VariableInput,
  fieldFrame
} from '@harborclient/sdk/components';
import { resolveOptionalPositiveInt, resolvePositiveInt } from './timerFields';
import { isTimerActive, startTimer, stopTimer } from './timerRuntime';
import {
  defaultTimerSettings,
  parseStoredTimerSettings,
  requestSettingsKey,
  type TimerSettings
} from './timerSettings';

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
    return 'now';
  }
  if (deltaMs < 1000) {
    return 'in less than 1s';
  }
  const seconds = Math.round(deltaMs / 1000);
  return `in ${seconds}s`;
}

/**
 * Timer request tab with interval and delay send modes.
 */
export function TimerTab({ context, hc }: Props) {
  const timerIdRef = useRef<string | undefined>(undefined);
  if (!timerIdRef.current) {
    timerIdRef.current = `timer-${Math.random().toString(36).slice(2, 11)}`;
  }
  const timerId = timerIdRef.current;
  const settingsKey = useMemo(
    () => requestSettingsKey(context.draft),
    [context.draft.method, context.draft.url]
  );

  const variableList = useMemo(
    (): Variable[] =>
      Object.entries(context.variables).map(([key, value]) => ({
        key,
        value,
        defaultValue: '',
        share: false
      })),
    [context.variables]
  );

  const [settings, setSettings] = useState<TimerSettings>(defaultTimerSettings());
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

    const delayRaw = settings.mode === 'interval' ? settings.intervalMs : settings.delayMs;
    const resolvedDelay = resolvePositiveInt(delayRaw, context.variables);
    const resolvedMax = resolveOptionalPositiveInt(settings.maxSends, context.variables);

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
        if (settings.mode === 'interval') {
          setNextSendAt(Date.now() + delayMs);
        }
      },
      onComplete: () => {
        setNextSendAt(null);
      }
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
    settings.mode === 'interval'
      ? resolvePositiveInt(settings.intervalMs, context.variables).error
      : undefined;
  const delayFieldError =
    settings.mode === 'delay'
      ? resolvePositiveInt(settings.delayMs, context.variables).error
      : undefined;
  const maxSendsFieldError = resolveOptionalPositiveInt(settings.maxSends, context.variables).error;

  const canStart = !running && !intervalFieldError && !delayFieldError && !maxSendsFieldError;

  return (
    <div className="flex flex-col gap-4 text-[14px] text-text" style={{ minHeight: '320px' }}>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-[14px] font-medium text-text">Mode</legend>
        <div className="flex flex-wrap gap-4" role="radiogroup" aria-label="Timer mode">
          <FormGroup layout="radio" label="Interval" htmlFor={`${timerId}-mode-interval`}>
            <Input
              type="radio"
              id={`${timerId}-mode-interval`}
              name={`${timerId}-mode`}
              value="interval"
              checked={settings.mode === 'interval'}
              disabled={running}
              onChange={() => updateSetting('mode', 'interval')}
            />
          </FormGroup>
          <FormGroup layout="radio" label="Delay" htmlFor={`${timerId}-mode-delay`}>
            <Input
              type="radio"
              id={`${timerId}-mode-delay`}
              name={`${timerId}-mode`}
              value="delay"
              checked={settings.mode === 'delay'}
              disabled={running}
              onChange={() => updateSetting('mode', 'delay')}
            />
          </FormGroup>
        </div>
      </fieldset>

      {settings.mode === 'interval' ? (
        <FormGroup label="Interval (ms)" htmlFor={`${timerId}-interval`} error={intervalFieldError}>
          <VariableInput
            id={`${timerId}-interval`}
            value={settings.intervalMs}
            variables={variableList}
            wrapperClassName={`${fieldFrame}${running ? ' pointer-events-none opacity-50' : ''}`}
            onChange={(value) => {
              if (!running) {
                updateSetting('intervalMs', value);
              }
            }}
          />
        </FormGroup>
      ) : (
        <FormGroup label="Delay (ms)" htmlFor={`${timerId}-delay`} error={delayFieldError}>
          <VariableInput
            id={`${timerId}-delay`}
            value={settings.delayMs}
            variables={variableList}
            wrapperClassName={`${fieldFrame}${running ? ' pointer-events-none opacity-50' : ''}`}
            onChange={(value) => {
              if (!running) {
                updateSetting('delayMs', value);
              }
            }}
          />
        </FormGroup>
      )}

      <FormGroup
        label="Max sends (optional)"
        htmlFor={`${timerId}-max-sends`}
        error={maxSendsFieldError}
      >
        <VariableInput
          id={`${timerId}-max-sends`}
          value={settings.maxSends}
          variables={variableList}
          wrapperClassName={`${fieldFrame}${running ? ' pointer-events-none opacity-50' : ''}`}
          onChange={(value) => {
            if (!running) {
              updateSetting('maxSends', value);
            }
          }}
        />
      </FormGroup>

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!canStart} onClick={handleStart}>
          Start
        </Button>
        <Button variant="secondary" disabled={!running} onClick={handleStop}>
          Stop
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        <StatusMessage className="text-text">
          Status: {running ? 'Running' : 'Stopped'}
        </StatusMessage>
        <StatusMessage className="text-text">Send count: {sendCount}</StatusMessage>
        {running && nextSendAt !== null ? (
          <StatusMessage className="text-text">
            Next send: {formatNextSend(nextSendAt)}
          </StatusMessage>
        ) : null}
        {lastError != null ? (
          <FieldError roleAlert spacing="field">
            {lastError}
          </FieldError>
        ) : null}
      </div>
    </div>
  );
}
