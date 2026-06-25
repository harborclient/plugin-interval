// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/reactHost.js
var hostReact = null;
function setHostReact(react) {
  hostReact = react;
}
function requireHostReact() {
  if (hostReact == null) {
    throw new Error(
      "Plugin React host is not installed. Call installReact(hc.react) at the start of activate()."
    );
  }
  return hostReact;
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/index.js
function installReact(react) {
  setHostReact(react);
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/react.js
function hook(name) {
  const react = requireHostReact();
  const fn = react[name];
  if (typeof fn !== "function") {
    throw new Error(`React hook "${String(name)}" is not available on hc.react.`);
  }
  return fn;
}
function useState(initialState) {
  return hook("useState")(initialState);
}
function useEffect(effect, deps) {
  return hook("useEffect")(effect, deps);
}
function useCallback(callback, deps) {
  return hook("useCallback")(callback, deps);
}
function useMemo(factory, deps) {
  return hook("useMemo")(factory, deps);
}
function useRef(initialValue) {
  return hook("useRef")(initialValue);
}
function useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
  return hook("useSyncExternalStore")(subscribe, getSnapshot, getServerSnapshot);
}

// src/timerRuntime.ts
var timers = /* @__PURE__ */ new Map();
var listeners = /* @__PURE__ */ new Set();
function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}
function getActiveTimerCount() {
  return timers.size;
}
function subscribeTimerRuntime(listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function stopTimer(id) {
  const handle = timers.get(id);
  if (!handle) {
    return;
  }
  handle.stop();
  timers.delete(id);
  emitChange();
}
function clearAllTimers() {
  for (const handle of timers.values()) {
    handle.stop();
  }
  timers.clear();
  emitChange();
}
function startTimer(options) {
  stopTimer(options.id);
  let intervalId;
  let timeoutId;
  const stop = () => {
    if (intervalId !== void 0) {
      clearInterval(intervalId);
      intervalId = void 0;
    }
    if (timeoutId !== void 0) {
      clearTimeout(timeoutId);
      timeoutId = void 0;
    }
  };
  const handle = {
    id: options.id,
    stop: () => {
      stop();
      if (timers.get(options.id) === handle) {
        timers.delete(options.id);
        emitChange();
      }
    }
  };
  if (options.mode === "interval") {
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
function isTimerActive(id) {
  return timers.has(id);
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/jsx-runtime.js
var Fragment = Symbol.for("@harborclient/sdk.Fragment");
function build(type, props, key) {
  const react = requireHostReact();
  const elementType = type === Fragment ? react.Fragment : type;
  const { children, ...rest } = props ?? {};
  if (key !== void 0) {
    rest.key = key;
  }
  return react.createElement(elementType, rest, children);
}
var jsx = build;
var jsxs = build;

// src/TimerStatusBar.tsx
function TimerStatusBar() {
  const activeCount = useSyncExternalStore(
    subscribeTimerRuntime,
    getActiveTimerCount,
    getActiveTimerCount
  );
  if (activeCount === 0) {
    return null;
  }
  return /* @__PURE__ */ jsx("span", { className: "text-[14px] text-text", role: "status", children: "Timer running" });
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/http/substitute.js
var VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;
function substituteVariables(text, runtimeVars) {
  return text.replace(VARIABLE_PATTERN, (match, key) => {
    const value = runtimeVars[key];
    return value !== void 0 ? value : match;
  });
}

// src/timerFields.ts
var VARIABLE_PATTERN2 = /\{\{\s*[\w.-]+\s*\}\}/;
function hasUnresolvedVariables(text) {
  return VARIABLE_PATTERN2.test(text);
}
function resolvePositiveInt(raw, variables) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { error: "Value is required" };
  }
  const resolved = substituteVariables(trimmed, variables);
  if (hasUnresolvedVariables(resolved)) {
    return { error: "Unresolved variable placeholder" };
  }
  const parsed = Number(resolved);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: "Must be a positive integer" };
  }
  return { value: parsed };
}
function resolveOptionalPositiveInt(raw, variables) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: void 0 };
  }
  return resolvePositiveInt(trimmed, variables);
}

// src/timerSettings.ts
var defaultTimerSettings = () => ({
  mode: "interval",
  intervalMs: "1000",
  delayMs: "1000",
  maxSends: ""
});
var STORAGE_PREFIX = "timer-settings:";
function requestSettingsKey(draft) {
  return `${STORAGE_PREFIX}${draft.method}:${draft.url}`;
}
function parseStoredTimerSettings(stored) {
  if (!stored || typeof stored !== "object") {
    return defaultTimerSettings();
  }
  const record = stored;
  const mode = record.mode === "delay" ? "delay" : "interval";
  return {
    mode,
    intervalMs: typeof record.intervalMs === "string" ? record.intervalMs : "1000",
    delayMs: typeof record.delayMs === "string" ? record.delayMs : "1000",
    maxSends: typeof record.maxSends === "string" ? record.maxSends : ""
  };
}

// src/TimerTab.tsx
function formatNextSend(timestampMs) {
  const deltaMs = timestampMs - Date.now();
  if (deltaMs <= 0) {
    return "now";
  }
  if (deltaMs < 1e3) {
    return "in less than 1s";
  }
  const seconds = Math.round(deltaMs / 1e3);
  return `in ${seconds}s`;
}
function TimerTab({ context, hc }) {
  const timerIdRef = useRef();
  if (!timerIdRef.current) {
    timerIdRef.current = `timer-${Math.random().toString(36).slice(2, 11)}`;
  }
  const timerId = timerIdRef.current;
  const settingsKey = useMemo(
    () => requestSettingsKey(context.draft),
    [context.draft.method, context.draft.url]
  );
  const [settings, setSettings] = useState(
    defaultTimerSettings()
  );
  const [sendCount, setSendCount] = useState(0);
  const [nextSendAt, setNextSendAt] = useState(null);
  const [lastError, setLastError] = useState(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const maxSendsRef = useRef(void 0);
  const lastResponseKeyRef = useRef(null);
  const running = isTimerActive(timerId);
  const responseKey = useMemo(() => {
    if (!context.response) {
      return null;
    }
    return `${context.response.status}:${context.response.durationMs}:${context.response.sizeBytes}`;
  }, [context.response]);
  useEffect(() => {
    let cancelled = false;
    void hc.storage.get(settingsKey).then((stored) => {
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
  useEffect(() => {
    if (!settingsLoaded) {
      return;
    }
    void hc.storage.set(settingsKey, settings);
  }, [hc.storage, settingsKey, settings, settingsLoaded]);
  useEffect(() => {
    stopTimer(timerId);
    setNextSendAt(null);
    maxSendsRef.current = void 0;
    lastResponseKeyRef.current = null;
  }, [settingsKey, timerId]);
  useEffect(() => {
    return () => {
      stopTimer(timerId);
    };
  }, [timerId]);
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
      if (max !== void 0 && next >= max) {
        stopTimer(timerId);
        setNextSendAt(null);
      }
      return next;
    });
  }, [running, responseKey, timerId]);
  const updateSetting = useCallback(
    (key, value) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
    },
    []
  );
  const handleStart = () => {
    setLastError(null);
    const delayRaw = settings.mode === "interval" ? settings.intervalMs : settings.delayMs;
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
    const delayMs = resolvedDelay.value;
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
      }
    });
  };
  const handleStop = () => {
    stopTimer(timerId);
    setNextSendAt(null);
    maxSendsRef.current = void 0;
    lastResponseKeyRef.current = null;
  };
  const intervalFieldError = settings.mode === "interval" ? resolvePositiveInt(settings.intervalMs, context.variables).error : void 0;
  const delayFieldError = settings.mode === "delay" ? resolvePositiveInt(settings.delayMs, context.variables).error : void 0;
  const maxSendsFieldError = resolveOptionalPositiveInt(
    settings.maxSends,
    context.variables
  ).error;
  const canStart = !running && !intervalFieldError && !delayFieldError && !maxSendsFieldError;
  return /* @__PURE__ */ jsxs(
    "div",
    {
      className: "flex flex-col gap-4 text-[14px] text-text",
      style: { minHeight: "320px" },
      children: [
        /* @__PURE__ */ jsxs("fieldset", { className: "flex flex-col gap-2", children: [
          /* @__PURE__ */ jsx("legend", { className: "text-[14px] font-medium text-text", children: "Mode" }),
          /* @__PURE__ */ jsxs(
            "div",
            {
              className: "flex flex-wrap gap-4",
              role: "radiogroup",
              "aria-label": "Timer mode",
              children: [
                /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "radio",
                      name: `${timerId}-mode`,
                      value: "interval",
                      checked: settings.mode === "interval",
                      disabled: running,
                      onChange: () => updateSetting("mode", "interval")
                    }
                  ),
                  "Interval"
                ] }),
                /* @__PURE__ */ jsxs("label", { className: "flex items-center gap-2", children: [
                  /* @__PURE__ */ jsx(
                    "input",
                    {
                      type: "radio",
                      name: `${timerId}-mode`,
                      value: "delay",
                      checked: settings.mode === "delay",
                      disabled: running,
                      onChange: () => updateSetting("mode", "delay")
                    }
                  ),
                  "Delay"
                ] })
              ]
            }
          )
        ] }),
        settings.mode === "interval" ? /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx("label", { htmlFor: `${timerId}-interval`, children: "Interval (ms)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              id: `${timerId}-interval`,
              type: "text",
              className: "rounded-md border border-separator bg-control px-3 py-1.5 text-[14px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              value: settings.intervalMs,
              disabled: running,
              "aria-invalid": intervalFieldError != null,
              "aria-describedby": intervalFieldError != null ? `${timerId}-interval-error` : void 0,
              onChange: (event) => updateSetting("intervalMs", event.target.value)
            }
          ),
          intervalFieldError != null ? /* @__PURE__ */ jsx(
            "p",
            {
              id: `${timerId}-interval-error`,
              className: "text-[14px] text-danger",
              role: "status",
              children: intervalFieldError
            }
          ) : null
        ] }) : /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx("label", { htmlFor: `${timerId}-delay`, children: "Delay (ms)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              id: `${timerId}-delay`,
              type: "text",
              className: "rounded-md border border-separator bg-control px-3 py-1.5 text-[14px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              value: settings.delayMs,
              disabled: running,
              "aria-invalid": delayFieldError != null,
              "aria-describedby": delayFieldError != null ? `${timerId}-delay-error` : void 0,
              onChange: (event) => updateSetting("delayMs", event.target.value)
            }
          ),
          delayFieldError != null ? /* @__PURE__ */ jsx(
            "p",
            {
              id: `${timerId}-delay-error`,
              className: "text-[14px] text-danger",
              role: "status",
              children: delayFieldError
            }
          ) : null
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", children: [
          /* @__PURE__ */ jsx("label", { htmlFor: `${timerId}-max-sends`, children: "Max sends (optional)" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              id: `${timerId}-max-sends`,
              type: "text",
              className: "rounded-md border border-separator bg-control px-3 py-1.5 text-[14px] text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
              value: settings.maxSends,
              disabled: running,
              "aria-invalid": maxSendsFieldError != null,
              "aria-describedby": maxSendsFieldError != null ? `${timerId}-max-sends-error` : void 0,
              onChange: (event) => updateSetting("maxSends", event.target.value)
            }
          ),
          maxSendsFieldError != null ? /* @__PURE__ */ jsx(
            "p",
            {
              id: `${timerId}-max-sends-error`,
              className: "text-[14px] text-danger",
              role: "status",
              children: maxSendsFieldError
            }
          ) : null
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-2", children: [
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "rounded-md bg-accent px-3 py-1.5 text-[14px] text-on-accent hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
              disabled: !canStart,
              onClick: handleStart,
              children: "Start"
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "rounded-md bg-control px-3 py-1.5 text-[14px] text-text hover:bg-control-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50",
              disabled: !running,
              onClick: handleStop,
              children: "Stop"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-1", role: "status", "aria-live": "polite", children: [
          /* @__PURE__ */ jsxs("p", { className: "text-[14px] text-text", children: [
            "Status: ",
            running ? "Running" : "Stopped"
          ] }),
          /* @__PURE__ */ jsxs("p", { className: "text-[14px] text-text", children: [
            "Send count: ",
            sendCount
          ] }),
          running && nextSendAt !== null ? /* @__PURE__ */ jsxs("p", { className: "text-[14px] text-text", children: [
            "Next send: ",
            formatNextSend(nextSendAt)
          ] }) : null,
          lastError != null ? /* @__PURE__ */ jsx("p", { className: "text-[14px] text-danger", children: lastError }) : null
        ] })
      ]
    }
  );
}

// src/renderer.tsx
function activate(hc) {
  installReact(hc.react);
  hc.subscriptions.push(
    hc.ui.registerRequestTab({
      id: "timer",
      title: "Timer",
      order: 50,
      Component: ({ context }) => /* @__PURE__ */ jsx(TimerTab, { context, hc })
    })
  );
  hc.subscriptions.push(
    hc.ui.registerStatusBarItem({
      id: "timer-active",
      alignment: "right",
      order: 50,
      Component: TimerStatusBar
    })
  );
}
function deactivate() {
  clearAllTimers();
}
export {
  activate,
  deactivate
};
