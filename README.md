# HarborClient Request Timer Plugin

Adds a **Timer** tab to the request editor for interval polling and one-shot delayed sends. Form fields support `{{variables}}` resolved from collection and environment variables.

Use the timer plugin to re-send requests at regular intervals or after a delay. For instance, to refresh authentication tokens or check for new data.

## Install

```bash
pnpm install
pnpm build
```

In HarborClient: **Settings → Plugins → Load unpacked…** and select this directory.

Requires HarborClient **>=1.8.0** with `hc.host.sendRequest` (`@harborclient/plugin-api` **>=0.3.3**).

## Development

```bash
pnpm dev
```

## Modes

| Mode     | Behavior                                    |
| -------- | ------------------------------------------- |
| Interval | Resend every _N_ milliseconds until stopped |
| Delay    | Send once after _N_ milliseconds (one-shot) |

Optional **max sends** caps interval runs. Settings are persisted per request URL/method fingerprint.

## License

MIT
