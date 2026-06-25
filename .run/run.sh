#!/usr/bin/env bash
#
# .run/run.sh — Fast local run (macOS/Linux)
#
# Starts ONLY Postgres + Redis as Docker containers, then runs the Spring Boot
# backend and the Vite frontend NATIVELY in real time. This avoids the heavy
# `docker compose up --build` image rebuild, giving a fast dev inner loop while
# still satisfying the backend's hard requirement for a reachable Postgres + Redis.
#
# Containers are LEFT RUNNING on exit (faster next boot). Stop them with the
# `docker compose ... down` command printed at shutdown.
#
set -euo pipefail
# Monitor mode: each background job is placed in its own process group, so a
# single negated-PID kill signals the whole tree. mvnw forks a separate Spring
# Boot app JVM and npm forks the Vite/node process — process-group kill reaches
# those forked children too, guaranteeing nothing is left on :8080 / :3001.
set -m

# --- Resolve repo root (one level above this script's .run/ directory) ------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE="apps/backend/.env"
COMPOSE_DOWN_CMD="docker compose --env-file ${ENV_FILE} down"

# --- Demo defaults (overridden by apps/backend/.env when present) ----------
POSTGRES_DB="battleship"
POSTGRES_USER="battleship"
POSTGRES_PASSWORD="battleship_dev"

# Load DB creds from apps/backend/.env if it exists (demo creds already in repo)
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  POSTGRES_DB="$(grep -E '^POSTGRES_DB=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  POSTGRES_USER="$(grep -E '^POSTGRES_USER=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  POSTGRES_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' "$ENV_FILE" | tail -n1 | cut -d= -f2- || true)"
  : "${POSTGRES_DB:=battleship}"
  : "${POSTGRES_USER:=battleship}"
  : "${POSTGRES_PASSWORD:=battleship_dev}"
else
  echo "WARN: $ENV_FILE not found — using demo defaults (battleship/battleship/battleship_dev)."
  echo "      Create it with: cp apps/backend/.env.example apps/backend/.env"
fi

# --- Helpers ---------------------------------------------------------------
fail() { echo "ERROR: $*" >&2; exit 1; }

ver_ge() {
  # ver_ge <have> <min>  -> true if have >= min (integer major compare)
  [ "$1" -ge "$2" ] 2>/dev/null
}

# --- 1. Preflight checks ---------------------------------------------------
echo "==> Preflight checks"

command -v docker >/dev/null 2>&1 || fail "Docker is not installed. Install Docker Desktop: https://docker.com"
docker --version >/dev/null 2>&1 || fail "Docker is installed but 'docker --version' failed."
if ! docker info >/dev/null 2>&1; then
  fail "Docker daemon is not reachable. Start Docker Desktop (or the docker service) and retry."
fi

command -v java >/dev/null 2>&1 || fail "Java is not installed. Java 17+ required: https://adoptium.net"
JAVA_VER="$(java -version 2>&1 | head -n1 | sed -E 's/.*version "([0-9]+).*/\1/')"
ver_ge "${JAVA_VER:-0}" 17 || fail "Java 17+ required, found '${JAVA_VER:-unknown}'. Install from https://adoptium.net"

command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Node 18+ required: https://nodejs.org"
NODE_VER="$(node -v | sed -E 's/v([0-9]+).*/\1/')"
ver_ge "${NODE_VER:-0}" 18 || fail "Node 18+ required, found 'v${NODE_VER:-unknown}'. Install from https://nodejs.org"

command -v npm >/dev/null 2>&1 || fail "npm is not installed (bundled with Node.js): https://nodejs.org"

echo "    docker: ok | java: ${JAVA_VER} | node: v${NODE_VER} | npm: $(npm -v)"

# --- 2. Start ONLY Postgres + Redis containers -----------------------------
echo "==> Starting Postgres + Redis containers (backend/frontend images are NOT built)"
docker compose --env-file "$ENV_FILE" up -d postgres redis \
  || fail "Failed to start postgres/redis containers. See Docker output above."

# --- 2b. Wait for both to be healthy ---------------------------------------
wait_healthy() {
  local svc="$1" timeout="${2:-60}" elapsed=0 cid status
  echo "    waiting for '$svc' to become healthy (timeout ${timeout}s)..."
  while [ "$elapsed" -lt "$timeout" ]; do
    cid="$(docker compose --env-file "$ENV_FILE" ps -q "$svc" 2>/dev/null || true)"
    if [ -n "$cid" ]; then
      status="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo "starting")"
      if [ "$status" = "healthy" ]; then
        echo "    '$svc' is healthy."
        return 0
      fi
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  fail "'$svc' did not become healthy within ${timeout}s. Check: docker compose --env-file ${ENV_FILE} logs ${svc}"
}

wait_healthy postgres 60
wait_healthy redis 60

# --- 3 & 4. Launch native backend + frontend -------------------------------
BACKEND_PID=""
FRONTEND_PID=""

_ran_cleanup=""
cleanup() {
  # Guard against re-entry (trap fires on both signal and EXIT).
  [ -n "$_ran_cleanup" ] && return
  _ran_cleanup=1
  echo ""
  echo "==> Shutting down native processes..."
  # Signal the whole process GROUP of each job (negated PID). Under `set -m`
  # the job's PID equals its process-group ID, so this reaches mvnw's forked
  # Spring Boot JVM (:8080) and npm's forked Vite/node process (:3001).
  [ -n "$FRONTEND_PID" ] && kill -TERM -- -"$FRONTEND_PID" 2>/dev/null || true
  [ -n "$BACKEND_PID" ]  && kill -TERM -- -"$BACKEND_PID"  2>/dev/null || true
  # Give children a moment to exit gracefully, then force-kill any survivors.
  sleep 2
  [ -n "$FRONTEND_PID" ] && kill -KILL -- -"$FRONTEND_PID" 2>/dev/null || true
  [ -n "$BACKEND_PID" ]  && kill -KILL -- -"$BACKEND_PID"  2>/dev/null || true
  echo ""
  echo "Native backend + frontend stopped."

  # Offer to also tear down the Postgres + Redis containers. The trap's stdin is
  # the log pipe, not the terminal, so read from the controlling TTY. If there is
  # no interactive TTY (CI, piped run), skip the prompt and leave containers up so
  # the script can never hang. `read` is guarded so a timeout/EOF can't abort the
  # trap mid-way under `set -euo pipefail`.
  local ans=""
  if [ -t 0 ] || [ -e /dev/tty ]; then
    printf "Also stop the Postgres + Redis containers? [y/N] "
    read -r -t 30 ans < /dev/tty || ans=""
  fi
  case "$ans" in
    y|Y)
      echo "==> Stopping Postgres + Redis containers..."
      ${COMPOSE_DOWN_CMD} || true
      echo "Postgres + Redis containers stopped."
      ;;
    *)
      echo "Postgres + Redis containers are STILL RUNNING (left up for a faster next boot)."
      echo "To stop them:  ${COMPOSE_DOWN_CMD}"
      ;;
  esac
}
trap cleanup INT TERM EXIT

# 3. Backend — native, postgres profile, pointing at local containers
echo "==> Starting backend natively (Spring Boot, postgres profile) on :8080/api/v1"
# `exec` makes the subshell's PID the real mvnw process (= job pgid). The label
# filter runs via process substitution, so `sed` stays OUT of this job's group
# and is not what $! captures — BACKEND_PID is the actual mvnw/forked-JVM tree.
(
  cd apps/backend
  exec env \
    SPRING_PROFILES_ACTIVE=postgres \
    SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/${POSTGRES_DB}" \
    SPRING_DATASOURCE_USERNAME="${POSTGRES_USER}" \
    SPRING_DATASOURCE_PASSWORD="${POSTGRES_PASSWORD}" \
    SPRING_REDIS_HOST="localhost" \
    SPRING_REDIS_PORT="6379" \
    CORS_ALLOWED_ORIGIN="http://localhost:3001" \
    ./mvnw spring-boot:run
) > >(sed -u 's/^/[backend]  /') 2>&1 &
BACKEND_PID=$!

# Wait until backend is accepting connections before starting the frontend.
# Spring Boot takes ~30s; polling port 8080 is more reliable than a fixed sleep.
wait_for_backend() {
  local timeout=120 elapsed=0
  echo "==> Waiting for backend on :8080 (Spring Boot typically takes ~30s)..."
  while [ "$elapsed" -lt "$timeout" ]; do
    if curl -s --connect-timeout 1 -o /dev/null http://localhost:8080 2>/dev/null; then
      echo "    backend is ready."
      return 0
    fi
    sleep 3
    elapsed=$((elapsed + 3))
  done
  echo "    WARN: backend did not respond within ${timeout}s — starting frontend anyway."
}
wait_for_backend

# 4. Frontend — native Vite dev server, pointing at native backend
echo "==> Starting frontend natively (Vite dev) on :3001"
# Same pattern: process substitution keeps `sed` out of the job's group, and
# `exec` on the final command makes FRONTEND_PID the real npm/Vite/node tree.
(
  cd apps/frontend
  if [ ! -d node_modules ]; then
    echo "node_modules missing — running npm install..."
    npm install
  fi
  exec env VITE_API_BASE_URL="http://localhost:8080" npm run dev
) > >(sed -u 's/^/[frontend] /') 2>&1 &
FRONTEND_PID=$!

# --- 5. Stream logs (both above pipe to terminal) --------------------------
echo ""
echo "============================================================"
echo " Fast local run is up:"
echo "   Frontend (Vite dev) : http://localhost:3001"
echo "   Backend API         : http://localhost:8080/api/v1"
echo "   Postgres            : localhost:5432"
echo "   Redis               : localhost:6379"
echo ""
echo " Press Ctrl+C to stop the native backend + frontend."
echo " Containers stay up; stop them with: ${COMPOSE_DOWN_CMD}"
echo "============================================================"
echo ""

# --- 6. Wait — Ctrl+C triggers the cleanup trap ----------------------------
# Wait on either child; when one exits, cleanup() tears down the rest.
wait -n "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
wait
