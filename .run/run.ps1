<#
.SYNOPSIS
  .run/run.ps1 -- Fast local run (Windows PowerShell)

.DESCRIPTION
  Starts ONLY Postgres + Redis as Docker containers, then runs the Spring Boot
  backend and the Vite frontend NATIVELY in real time. Avoids the heavy
  `docker compose up --build` image rebuild for a fast dev inner loop, while
  still satisfying the backend's requirement for a reachable Postgres + Redis.

  Containers are LEFT RUNNING on exit (faster next boot). Stop them with the
  `docker compose ... down` command printed at shutdown.
#>

$ErrorActionPreference = 'Stop'

# --- Resolve repo root (one level above this script's .run\ directory) ------
$ScriptDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $ScriptDir

$EnvFile = 'apps/backend/.env'
$ComposeDownCmd = "docker compose --env-file $EnvFile down"

# --- Demo defaults (overridden by apps/backend/.env when present) ----------
$PostgresDb = 'battleship'
$PostgresUser = 'battleship'
$PostgresPassword = 'battleship_dev'

if (Test-Path $EnvFile) {
    foreach ($line in Get-Content $EnvFile) {
        if ($line -match '^POSTGRES_DB=(.*)$')          { $PostgresDb = $Matches[1].Trim() }
        elseif ($line -match '^POSTGRES_USER=(.*)$')    { $PostgresUser = $Matches[1].Trim() }
        elseif ($line -match '^POSTGRES_PASSWORD=(.*)$') { $PostgresPassword = $Matches[1].Trim() }
    }
} else {
    Write-Warning "$EnvFile not found - using demo defaults (battleship/battleship/battleship_dev)."
    Write-Host   "      Create it with: cp apps/backend/.env.example apps/backend/.env"
}

function Fail([string]$Message) {
    Write-Host "ERROR: $Message" -ForegroundColor Red
    exit 1
}

# --- 1. Preflight checks ---------------------------------------------------
Write-Host "==> Preflight checks"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Fail "Docker is not installed. Install Docker Desktop: https://docker.com"
}
try { docker --version | Out-Null } catch { Fail "Docker is installed but 'docker --version' failed." }
try { docker info 2>$null | Out-Null; if ($LASTEXITCODE -ne 0) { throw } }
catch { Fail "Docker daemon is not reachable. Start Docker Desktop and retry." }

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    Fail "Java is not installed. Java 17+ required: https://adoptium.net"
}
# java -version writes to stderr; route through cmd.exe to avoid PS 5.1 NativeCommandError.
$javaRaw = (& cmd /c "java -version 2>&1" | Select-Object -First 1)
$javaVer = 0
if ($javaRaw -match 'version "(\d+)') { $javaVer = [int]$Matches[1] }
if ($javaVer -lt 17) { Fail "Java 17+ required, found '$javaRaw'. Install from https://adoptium.net" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Fail "Node.js is not installed. Node 18+ required: https://nodejs.org"
}
$nodeRaw = (& node -v)
$nodeVer = 0
if ($nodeRaw -match 'v(\d+)') { $nodeVer = [int]$Matches[1] }
if ($nodeVer -lt 18) { Fail "Node 18+ required, found '$nodeRaw'. Install from https://nodejs.org" }

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail "npm is not installed (bundled with Node.js): https://nodejs.org"
}

Write-Host "    docker: ok | java: $javaVer | node: $nodeRaw | npm: $(npm -v)"

# --- 2. Start ONLY Postgres + Redis containers -----------------------------
Write-Host "==> Starting Postgres + Redis containers (backend/frontend images are NOT built)"
docker compose --env-file $EnvFile up -d postgres redis
if ($LASTEXITCODE -ne 0) { Fail "Failed to start postgres/redis containers. See Docker output above." }

# --- 2b. Wait for both to be healthy ---------------------------------------
function Wait-Healthy([string]$Service, [int]$TimeoutSec = 60) {
    Write-Host "    waiting for '$Service' to become healthy (timeout ${TimeoutSec}s)..."
    $elapsed = 0
    while ($elapsed -lt $TimeoutSec) {
        $cid = (docker compose --env-file $EnvFile ps -q $Service 2>$null)
        if ($cid) {
            $status = (docker inspect -f '{{.State.Health.Status}}' $cid 2>$null)
            if ($status -eq 'healthy') {
                Write-Host "    '$Service' is healthy."
                return
            }
        }
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
    Fail "'$Service' did not become healthy within ${TimeoutSec}s. Check: docker compose --env-file $EnvFile logs $Service"
}

Wait-Healthy 'postgres' 60
Wait-Healthy 'redis' 60

# --- Helper: test whether a TCP port is open (no nested try/catch in main flow) ---
function Test-TcpPort([int]$Port) {
    try {
        $sock = New-Object Net.Sockets.TcpClient
        $sock.Connect('localhost', $Port)
        $sock.Close()
        return $true
    } catch {
        return $false
    }
}

function Stop-ProcTree($Proc) {
    if ($Proc -and -not $Proc.HasExited) {
        # taskkill /T kills the whole process tree (mvnw -> JVM, npm -> node).
        try { & taskkill /PID $Proc.Id /T /F 2>$null | Out-Null } catch { $null = $_ }
    }
}

# --- Helper: prompt whether to also tear down the containers ---------------
# Defined before the main try/finally so its try/catch is NOT nested inside the
# outer try -- this avoids the PS 5.1 parser mis-binding a nested catch.
# Returns $true only on an explicit yes; never hangs when non-interactive.
function Confirm-ComposeDown {
    if (-not [Environment]::UserInteractive) { return $false }
    try {
        $answer = Read-Host "Also stop the Postgres + Redis containers? [y/N]"
    } catch {
        # CTRL+C or no console available -- fall back to leave-up default.
        return $false
    }
    return ($answer -eq 'y' -or $answer -eq 'Y')
}

# --- 3 & 4. Launch native backend + frontend -------------------------------
$BackendProc  = $null
$FrontendProc = $null

try {
    # Ensure Maven Wrapper JAR is present. mvnw.cmd's built-in download uses a
    # cmd.exe for/f + curl trick that fails on some Windows setups (blank URL from
    # CRLF parsing). PowerShell's Invoke-WebRequest is reliable -- use it instead.
    $wrapperJar   = Join-Path $ScriptDir 'apps\backend\.mvn\wrapper\maven-wrapper.jar'
    $wrapperProps = Join-Path $ScriptDir 'apps\backend\.mvn\wrapper\maven-wrapper.properties'
    if (-not (Test-Path $wrapperJar)) {
        $wrapperUrl = ((Get-Content $wrapperProps |
            Where-Object { $_ -match '^wrapperUrl=' } |
            Select-Object -First 1) -replace '^wrapperUrl=', '').Trim()
        Write-Host "    Downloading Maven Wrapper JAR (one-time)..."
        Invoke-WebRequest -Uri $wrapperUrl -OutFile $wrapperJar -UseBasicParsing
        Write-Host "    Maven Wrapper JAR ready."
    }

    # 3. Backend -- native, postgres profile, pointing at local containers
    Write-Host "==> Starting backend natively (Spring Boot, postgres profile) on :8080/api/v1"
    $env:SPRING_PROFILES_ACTIVE     = 'postgres'
    $env:SPRING_DATASOURCE_URL      = "jdbc:postgresql://localhost:5432/$PostgresDb"
    $env:SPRING_DATASOURCE_USERNAME = $PostgresUser
    $env:SPRING_DATASOURCE_PASSWORD = $PostgresPassword
    $env:SPRING_REDIS_HOST          = 'localhost'
    $env:SPRING_REDIS_PORT          = '6379'
    $env:CORS_ALLOWED_ORIGIN        = 'http://localhost:3001'
    $BackendProc = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', 'mvnw.cmd spring-boot:run' `
        -WorkingDirectory (Join-Path $ScriptDir 'apps\backend') `
        -NoNewWindow -PassThru

    # Wait until backend is accepting connections before starting the frontend.
    # Spring Boot takes ~30s; polling port 8080 is more reliable than a fixed sleep.
    Write-Host "==> Waiting for backend on :8080 (Spring Boot typically takes ~30s)..."
    $backendReady = $false
    for ($i = 0; $i -lt 40; $i++) {
        if (Test-TcpPort 8080) {
            Write-Host "    backend is ready."
            $backendReady = $true
            break
        }
        Start-Sleep -Seconds 3
    }
    if (-not $backendReady) {
        Write-Host "    WARN: backend did not respond within 120s -- starting frontend anyway."
    }

    # 4. Frontend -- native Vite dev server, pointing at native backend
    Write-Host "==> Starting frontend natively (Vite dev) on :3001"
    $frontendDir = Join-Path $ScriptDir 'apps\frontend'
    if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) {
        Write-Host "    node_modules missing - running npm install..."
        Push-Location $frontendDir
        npm install
        Pop-Location
    }
    $env:VITE_API_BASE_URL = 'http://localhost:8080'
    $FrontendProc = Start-Process -FilePath 'cmd.exe' `
        -ArgumentList '/c', 'npm run dev' `
        -WorkingDirectory $frontendDir `
        -NoNewWindow -PassThru

    Write-Host ""
    Write-Host "============================================================"
    Write-Host " Fast local run is up:"
    Write-Host "   Frontend (Vite dev) : http://localhost:3001"
    Write-Host "   Backend API         : http://localhost:8080/api/v1"
    Write-Host "   Postgres            : localhost:5432"
    Write-Host "   Redis               : localhost:6379"
    Write-Host ""
    Write-Host " Press Ctrl+C to stop the native backend + frontend."
    Write-Host " Containers stay up; stop them with: $ComposeDownCmd"
    Write-Host "============================================================"
    Write-Host ""

    # --- 5 & 6. Wait -- Ctrl+C drops into finally for cleanup --------
    while ($true) {
        if ($BackendProc  -and $BackendProc.HasExited)  { Write-Host "[backend] process exited.";  break }
        if ($FrontendProc -and $FrontendProc.HasExited) { Write-Host "[frontend] process exited."; break }
        Start-Sleep -Seconds 1
    }
}
finally {
    Write-Host ""
    Write-Host "==> Shutting down native processes..."
    Stop-ProcTree $FrontendProc
    Stop-ProcTree $BackendProc
    Write-Host ""
    Write-Host "Native backend + frontend stopped."

    if (Confirm-ComposeDown) {
        Write-Host "==> Stopping Postgres + Redis containers..."
        docker compose --env-file $EnvFile down
        Write-Host "Postgres + Redis containers stopped."
    } else {
        Write-Host "Postgres + Redis containers are STILL RUNNING (left up for a faster next boot)."
        Write-Host "To stop them:  $ComposeDownCmd"
    }
}
