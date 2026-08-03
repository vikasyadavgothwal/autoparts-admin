#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-auto_parts_admin}"
CONTAINER_NAME="${CONTAINER_NAME:-autoparts-admin}"
IMAGE_NAME="${IMAGE_NAME:-autoparts-admin}"
BRANCH="${BRANCH:-main}"
HOST_PORT="${HOST_PORT:-3000}"
CONTAINER_PORT="${CONTAINER_PORT:-3000}"
APP_DIR="${APP_DIR:-$(pwd)}"
DOCKER_NETWORK="${DOCKER_NETWORK:-autoparts}"
PM2_APP_NAME="${PM2_APP_NAME:-}"
REDIS_CONTAINER_NAME="${REDIS_CONTAINER_NAME:-autoparts-redis}"
HEALTH_PATH="${HEALTH_PATH:-/login}"

cd "$APP_DIR"

git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

docker network inspect "$DOCKER_NETWORK" >/dev/null 2>&1 || docker network create "$DOCKER_NETWORK"

if ! docker ps --format '{{.Names}}' | grep -qx "$REDIS_CONTAINER_NAME"; then
  docker rm -f "$REDIS_CONTAINER_NAME" >/dev/null 2>&1 || true
  docker run -d \
    --name "$REDIS_CONTAINER_NAME" \
    --restart unless-stopped \
    --network "$DOCKER_NETWORK" \
    redis:7-alpine
fi

GIT_SHA="$(git rev-parse --short HEAD)"
docker build --pull -t "$IMAGE_NAME:$GIT_SHA" -t "$IMAGE_NAME:latest" .

ENV_ARGS=()
for env_file in .env .env.local; do
  if [[ -f "$env_file" ]]; then
    ENV_ARGS+=(--env-file "$env_file")
  fi
done

docker run --rm \
  --network "$DOCKER_NETWORK" \
  "${ENV_ARGS[@]}" \
  "$IMAGE_NAME:$GIT_SHA" \
  npx prisma migrate deploy

if [[ -n "$PM2_APP_NAME" ]] && command -v pm2 >/dev/null 2>&1; then
  pm2 stop "$PM2_APP_NAME" || true
  pm2 save || true
fi

docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$DOCKER_NETWORK" \
  -p "127.0.0.1:${HOST_PORT}:${CONTAINER_PORT}" \
  "${ENV_ARGS[@]}" \
  -e "NOTIFICATION_REDIS_URL=${NOTIFICATION_REDIS_URL:-redis://${REDIS_CONTAINER_NAME}:6379}" \
  "$IMAGE_NAME:$GIT_SHA"

sleep 5
curl -fsS "http://127.0.0.1:${HOST_PORT}${HEALTH_PATH}" >/dev/null

docker image prune -f >/dev/null
echo "Deployed ${APP_NAME} (${GIT_SHA}) on port ${HOST_PORT}"
