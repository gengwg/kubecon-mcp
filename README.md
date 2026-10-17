# kubecon-mcp

Unofficial, read-only MCP server for the KubeCon + CloudNativeCon North America 2026 schedule (Salt Lake City, Nov 9-12). Search talks by topic, speaker, time and room.

Endpoint: `https://kubecon.getmuyu.com/mcp` (no auth)

Data comes from the public schedule feed behind the [official schedule](https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/program/schedule/). Not affiliated with CNCF or the Linux Foundation.

## Use

Claude Code:

```sh
claude mcp add --transport http kubecon https://kubecon.getmuyu.com/mcp
```

claude.ai: Settings > Connectors > Add custom connector, URL `https://kubecon.getmuyu.com/mcp`.

## Tools

- `search_sessions`: filter by `query`, `speaker`, `day`, `after`/`before` (HH:MM local), `room`, `track`
- `get_session`: full abstract and speakers for one session
- `list_filters`: valid days, rooms and tracks

## Develop

```sh
pnpm install
pnpm test
pnpm dev      # http://localhost:8787/mcp
pnpm deploy
```
