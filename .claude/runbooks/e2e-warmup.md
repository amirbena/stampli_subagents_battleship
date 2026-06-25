# E2E Backend Warmup Runbook

Used by Team Lead after unit/build gates pass, when E2E mode is Full.
`playwright.config.ts` sets `reuseExistingServer: true` — a pre-warmed backend eliminates the
cold-start wait from the critical path.

**Background-safe:** this script is designed to run non-blocking. Team Lead starts it in the
background immediately after unit/build gates pass, then continues to integration tests while
the backend warms up. The warmup result is collected before spawning `playwright-e2e-agent`
(not before integration tests).

## When to Run

Run only when E2E mode is **Full**. Skip entirely for Smoke and None.

## Bash Sequence

Run from `apps/backend/`:

```bash
cd apps/backend

./mvnw spring-boot:run -Pe2e -Dspring-boot.run.profiles=e2e > /tmp/e2e-backend.log 2>&1 &
echo $! > /tmp/e2e-backend.pid
echo "E2E backend starting (PID: $(cat /tmp/e2e-backend.pid))"

for i in $(seq 1 40); do
  if curl -s --connect-timeout 2 http://localhost:8081/api/v1/ > /dev/null 2>&1; then
    echo "E2E backend ready on port 8081 ($((i * 3))s elapsed)"
    break
  fi
  [ $i -eq 40 ] && echo "ERROR: E2E backend did not start within 120s" && cat /tmp/e2e-backend.log && exit 1
  echo "Waiting for backend... $((i * 3))s elapsed"
  sleep 3
done
```

## After Warmup Completes Successfully

Once the poll loop exits with "ready", the backend is available on port 8081. Team Lead
records this result and spawns `playwright-e2e-agent`. Playwright will find the backend
already responding and skip its own `webServer` startup.

## If the Backend Fails to Start

If `exit 1` fires (120s elapsed with no response):
1. Read `/tmp/e2e-backend.log` for the Spring Boot error.
2. Add a finding to the finding registry: Type `java-backend-runtime`, Severity `High`, Owner `java-backend-agent`.
3. Route to `java-backend-agent` with the full log output.
4. Do not spawn `playwright-e2e-agent` until the backend starts cleanly.
5. After the fix, re-run this warmup sequence from scratch before spawning the agent.

## Cleanup — Mandatory

Run on success, failure, or early stop — whenever the warmup was started:

```bash
kill $(cat /tmp/e2e-backend.pid) 2>/dev/null || true
rm -f /tmp/e2e-backend.pid /tmp/e2e-backend.log
```

Team Lead runs this after `playwright-e2e-agent` finishes (pass or fail), and also on any
early stop (pre-gate failure, warmup failure, integration test failure that prevents E2E).
