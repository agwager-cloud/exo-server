#!/usr/bin/env bash
# Copies the game server to the home server and rebuilds it: `bash home-server/deploy.sh` from the repo folder.
# Needs the `pifractal-server` SSH name. Only the files the server needs are sent.
set -euo pipefail
cd "$(dirname "$0")/.."
tar czf - --exclude=node_modules --exclude=dist --exclude=build package.json package-lock.json tsconfig.json tsconfig.build.json src home-server |
  ssh pifractal-server 'set -e; mkdir -p ~/games/exo && cd ~/games/exo && rm -rf server src public client && tar xzf - && cd home-server          && docker compose -p game-exo up -d --build && sleep 3 && docker ps --filter name=game-exo --format "{{.Names}}: {{.Status}}" && curl -s -o /dev/null -w "HTTP %{http_code}\n" localhost:8359/'
