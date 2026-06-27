# E2E Backend Warmup Runbook

Used by Team Lead after unit/build gates pass, when E2E mode is Full.
`playwright.config.ts` sets `reuseExistingServer: true` — a pre-warmed backend eliminates the
cold-start wait from the critical path.

**Background-safe:** this runbook is designed to run non-blocking. Team Lead starts it in the
background immediately after unit/build gates pass, then continues to integration tests while
the backend warms up. The warmup result is collected before spawning `playwright-e2e-agent`
(not before integration tests).

## When to Run

Run only when E2E mode is **Full**. Skip entirely for Smoke and None.

## OS Selection

Read the `OS` field from `## Runtime Environment` in
`reports/runs/<workflow-run-id>/team-lead-classification.md`.

| OS value | Sequence to use |
|----------|----------------|
| `Darwin` | Bash sequence (macOS) |
| `Linux` | Bash sequence (Linux) |
| `Windows_NT` / `CYGWIN*` / `MINGW*` | PowerShell sequence (Windows) |

---

## Bash Sequence (macOS / Linux)

Run from `apps/backend/`.

### Step 0 — Stale-process detection

Detect whether port 8081 is already occupied before launching a new process.
This avoids wasting the entire readiness timeout on a port conflict.

```bash
E2E_PORT=8081
E2E_HEALTH_URL="http://localhost:${E2E_PORT}/api/v1/"

echo "==> Checking port :${E2E_PORT} for stale or existing process"
if (exec 3<>"/dev/tcp/localhost/${E2E_PORT}") 2>/dev/null; then
  exec 3>&- 3<&-
  echo "    port ${E2E_PORT} is occupied — verifying occupant..."
  HTTP_CODE="$(curl -s --connect-timeout 3 --max-time 5 \
      -o /dev/null -w '%{http_code}' "$E2E_HEALTH_URL" 2>/dev/null || echo 000)"
  if echo "$HTTP_CODE" | grep -qE '^[23]'; then
    echo "    E2E backend already responding on :${E2E_PORT} — reusing existing process"
    echo "E2E backend ready (reused existing on port ${E2E_PORT})"
    exit 0
  else
    echo "ERROR: port ${E2E_PORT} is occupied but not serving the E2E backend (HTTP $HTTP_CODE)."
    echo "       A stale process is blocking the port. Free it and retry."
    echo "         macOS:  lsof -i :${E2E_PORT}"
    echo "         Linux:  ss -tlnp | grep :${E2E_PORT}"
    exit 1
  fi
fi
echo "    port ${E2E_PORT} is free"
```

### Step 1 — Pre-fetch Maven dependencies (outside readiness timer)

Download Maven artifacts before the readiness countdown begins. On the first run this
resolves remote dependencies; on subsequent runs it is near-instant from the local cache.
Failure here is non-fatal — proceed regardless so the startup attempt is still visible.

```bash
echo "==> Pre-fetching Maven dependencies (not counted in readiness timer)"
./mvnw -Pe2e dependency:go-offline -q 2>&1 | tail -5 || true
echo "    dependency pre-fetch complete"
```

### Step 2 — Start backend

```bash
./mvnw spring-boot:run -Pe2e -Dspring-boot.run.profiles=e2e > /tmp/e2e-backend.log 2>&1 &
echo $! > /tmp/e2e-backend.pid
echo "E2E backend starting (PID: $(cat /tmp/e2e-backend.pid))"
```

### Step 3 — Poll for readiness with log visibility

The readiness timer covers only JVM startup + Spring Boot startup + application readiness.
Maven dependency resolution completed in Step 1 and does not consume this budget.

```bash
for i in $(seq 1 40); do
  if curl -s --connect-timeout 2 --max-time 3 "$E2E_HEALTH_URL" > /dev/null 2>&1; then
    echo "E2E backend ready on port ${E2E_PORT} ($((i * 3))s elapsed)"
    break
  fi
  # Show latest log line so startup progress is visible while waiting
  LAST_LOG="$(tail -1 /tmp/e2e-backend.log 2>/dev/null || true)"
  [ -n "$LAST_LOG" ] && echo "  [log] ${LAST_LOG}"
  echo "  [warmup] waiting... $((i * 3))s elapsed"
  [ $i -eq 40 ] && {
    echo "ERROR: E2E backend did not start within 120s"
    echo "==> Last 50 lines of startup log:"
    tail -50 /tmp/e2e-backend.log
    exit 1
  }
  sleep 3
done
```

---

## PowerShell Sequence (Windows)

Run from `apps\backend\`. Uses `$env:TEMP` for log/pid files (cross-user safe on Windows).

### Step 0 — Stale-process detection

```powershell
$E2EPort      = 8081
$E2EHealthUrl = "http://localhost:$E2EPort/api/v1/"
$LogFile      = "$env:TEMP\e2e-backend.log"
$PidFile      = "$env:TEMP\e2e-backend.pid"

Write-Host "==> Checking port :$E2EPort for stale or existing process"
$portInUse = $false
try {
    $sock = New-Object Net.Sockets.TcpClient
    $sock.Connect('localhost', $E2EPort)
    $sock.Close()
    $portInUse = $true
} catch { }

if ($portInUse) {
    Write-Host "    port $E2EPort is occupied -- verifying occupant..."
    $responding = $false
    try {
        $r = Invoke-WebRequest -Uri $E2EHealthUrl -TimeoutSec 5 -UseBasicParsing
        if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { $responding = $true }
    } catch { }
    if ($responding) {
        Write-Host "    E2E backend already responding on :$E2EPort -- reusing existing process"
        Write-Host "E2E backend ready (reused existing on port $E2EPort)"
        exit 0
    } else {
        Write-Host "ERROR: port $E2EPort is occupied but not serving the E2E backend."
        Write-Host "       A stale process is blocking the port. Find and stop it:"
        Write-Host "         netstat -ano | findstr :$E2EPort"
        Write-Host "       then:  taskkill /PID <pid> /F"
        exit 1
    }
}
Write-Host "    port $E2EPort is free"
```

### Step 1 — Pre-fetch Maven dependencies (outside readiness timer)

```powershell
Write-Host "==> Pre-fetching Maven dependencies (not counted in readiness timer)"
& .\mvnw.cmd -Pe2e dependency:go-offline -q 2>&1 | Select-Object -Last 5
Write-Host "    dependency pre-fetch complete"
```

### Step 2 — Start backend

```powershell
$proc = Start-Process -FilePath 'cmd.exe' `
    -ArgumentList '/c', "mvnw.cmd spring-boot:run -Pe2e -Dspring-boot.run.profiles=e2e > `"$LogFile`" 2>&1" `
    -PassThru -NoNewWindow
$proc.Id | Set-Content -Path $PidFile
Write-Host "E2E backend starting (PID: $($proc.Id))"
```

### Step 3 — Poll for readiness with log visibility

```powershell
$ready = $false
for ($i = 1; $i -le 40; $i++) {
    try {
        $r = Invoke-WebRequest -Uri $E2EHealthUrl -TimeoutSec 2 -UseBasicParsing
        if ($r.StatusCode -ge 200) {
            Write-Host "E2E backend ready on port $E2EPort ($($i * 3)s elapsed)"
            $ready = $true
            break
        }
    } catch { }
    # Show latest log line so startup progress is visible while waiting
    if (Test-Path $LogFile) {
        $lastLine = Get-Content $LogFile -Tail 1 -ErrorAction SilentlyContinue
        if ($lastLine) { Write-Host "  [log] $lastLine" }
    }
    Write-Host "  [warmup] waiting... $($i * 3)s elapsed"
    Start-Sleep -Seconds 3
}
if (-not $ready) {
    Write-Host "ERROR: E2E backend did not start within 120s"
    Write-Host "==> Last 50 lines of startup log:"
    if (Test-Path $LogFile) { Get-Content $LogFile -Tail 50 }
    exit 1
}
```

---

## After Warmup Completes Successfully

Once the poll loop exits with "ready", the backend is available on port 8081. Team Lead
records this result and spawns `playwright-e2e-agent`. Playwright will find the backend
already responding and skip its own `webServer` startup.

## If the Backend Fails to Start

If `exit 1` fires (port conflict detected or 120s elapsed with no response):

1. The last 50 lines of the startup log are printed automatically by Step 3.
2. Read the Spring Boot error from the printed output.
3. Add a finding to the finding registry: Type `java-backend-runtime`, Severity `High`, Owner `java-backend-agent`.
4. Route to `java-backend-agent` with the failure log content.
5. Do not spawn `playwright-e2e-agent` until the backend starts cleanly.
6. After the fix, re-run this warmup sequence from scratch before spawning the agent.

## Cleanup — Mandatory

Run after `playwright-e2e-agent` finishes (pass or fail), and on any early stop
(pre-gate failure, warmup failure, integration test failure that prevents E2E).
Skip cleanup when no warmup was started (Smoke or None mode, or when the reuse-existing
path exited early with `exit 0`).

**macOS / Linux (bash):**

```bash
kill $(cat /tmp/e2e-backend.pid) 2>/dev/null || true
rm -f /tmp/e2e-backend.pid /tmp/e2e-backend.log
```

**Windows (PowerShell):**

```powershell
$PidFile = "$env:TEMP\e2e-backend.pid"
$LogFile  = "$env:TEMP\e2e-backend.log"
if (Test-Path $PidFile) {
    $backendPid = Get-Content $PidFile -ErrorAction SilentlyContinue
    if ($backendPid) {
        try { & taskkill /PID $backendPid /T /F 2>$null | Out-Null } catch { }
    }
    Remove-Item -Force $PidFile, $LogFile -ErrorAction SilentlyContinue
}
```
