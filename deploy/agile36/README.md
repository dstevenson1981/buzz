# Agile36 team on Buzz

Deadra's AI team: five Claude Code agents (chief of staff, sales, developer,
tester, social) living in a self-hosted Buzz community. Talk to them in
channels from the Buzz desktop or iPhone app; they talk to each other.

Built from the pattern in Buzz's own `buzz-acp` harness: each agent is a
headless container — `buzz-acp` listens for @mentions and drives Claude Code
through the ACP adapter. No desktop app required for the agents, so the same
stack runs on a laptop today and lifts to an always-on server unchanged.

## First-time setup

```bash
./setup.sh                      # builds, generates identities, starts relay
claude setup-token              # → paste token into deploy/agile36/.env
docker compose -f compose.agents.yml up -d
```

Then in the Buzz app: **Join a community** → `ws://localhost:3000`, import
your identity from `owner-identity.txt`, and delete that file.

## Day to day

```bash
docker compose -f compose.agents.yml up -d      # team on
docker compose -f compose.agents.yml down       # team off
docker compose -f compose.agents.yml logs -f    # watch them think
cd ../compose && ./run.sh start|stop|status     # the relay itself
```

Personas live in `personas/*.md` — edit and restart the container to change
how a teammate behaves. Add a teammate: new persona file + new service block
in `compose.agents.yml` + a key (`buzz-admin generate-key`) registered with
`add-member`.

## Moving to an always-on server later

Same repo, same commands, on any Docker VPS. Set real values for the
`BUZZ_DOMAIN`/URL block in `deploy/compose/.env`, turn
`BUZZ_REQUIRE_AUTH_TOKEN` back on, and use `compose.caddy.yml` for TLS. The
iPhone app then reaches your team from anywhere.
