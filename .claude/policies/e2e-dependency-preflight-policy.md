# E2E Dependency Preflight Policy

Used by: Playwright E2E Agent, Team Lead (E2E pre-gate).
Load before any E2E test run.

---

## Purpose

E2E tests depend on Playwright's bundled Chromium, the project-local Playwright installation,
and a correctly started frontend and backend. This policy defines how to verify and restore
those dependencies before running any test.

---

## E2E Port Conventions

| Service | Default port | Override env var |
|---------|-------------|-----------------|
| E2E frontend | **3010** | `E2E_FRONTEND_PORT` |
| E2E backend | **8081** | _(fixed by Spring profile)_ |
| Normal dev frontend | 3001 | _(never changed by E2E)_ |

The E2E frontend must always start on a **dedicated port** (default: 3010) that is separate
from the developer's normal frontend (3001). This ensures:
- E2E never accidentally tests a developer-running frontend
- Port conflicts between dev and E2E are avoided
- `reuseExistingServer` does not silently pick up the wrong server

---

## Chromium Preflight — Required Before Running Any E2E Test

### Step 1: Check project-local Playwright Chromium

Run from `apps/frontend` so the check uses the project-local Playwright version:

```js
// check-chromium.js — run with: node check-chromium.js
const { chromium } = require('@playwright/test');
const fs = require('fs');
const executablePath = chromium.executablePath();
if (!executablePath || !fs.existsSync(executablePath)) {
  console.error('CHROMIUM_MISSING:' + executablePath);
  process.exit(1);
}
console.log('CHROMIUM_OK:' + executablePath);
```

Or inline:
```bash
cd apps/frontend && node -e "
const { chromium } = require('@playwright/test');
const fs = require('fs');
const p = chromium.executablePath();
if (!p || !fs.existsSync(p)) { console.error('CHROMIUM_MISSING:'+p); process.exit(1); }
console.log('CHROMIUM_OK:'+p);
"
```

### Step 2: If Chromium is missing — auto-install

```bash
cd apps/frontend && npx playwright install chromium
```

- On macOS: installs to Playwright's local cache under the project. No `--with-deps` needed.
- On Linux: default is same. Use `--with-deps` only when explicitly authorized and on a Linux agent that permits OS-level dependency installation.
- On Windows (native): same command without `--with-deps`.

### Step 3: Re-verify after installation

Re-run the Step 1 check. If Chromium is still missing:
- Return `BLOCKED` (do not proceed to `test:e2e`)
- Include in the blocked report:
  - Detected OS (`uname -s` or `process.platform`)
  - Shell (`echo "$SHELL"`)
  - Frontend directory
  - Playwright version (`npx playwright --version` or from `package.json`)
  - Expected executable path (from `chromium.executablePath()`)
  - Install command attempted
  - Full failure output
  - Required manual action

### Step 4: Proceed only when Chromium is verified

Do not run `npm run test:e2e` unless Step 1 or Step 3 returned `CHROMIUM_OK`.

---

## Forbidden Chromium Sources

| Source | Why forbidden |
|--------|---------------|
| System Chrome / Chromium | Different binary, not Playwright-compatible |
| Global Playwright installation | May be a different version than project's `@playwright/test` |
| Guessed cache directories (`~/.cache/ms-playwright/...`) | Fragile — varies by OS, user, version |
| Browser from another worktree | Worktrees are isolated; use the project-local check |

---

## E2E Script Verification

Before running, confirm the E2E script exists in `apps/frontend/package.json`:

```bash
cat apps/frontend/package.json | grep '"test:e2e"'
```

If `test:e2e` is present: use `npm run test:e2e`.  
If only `e2e:ci` is present: use `npm run e2e:ci`.  
If neither exists: report `BLOCKED — E2E script missing` to Team Lead.

The correct script name takes precedence over any document or SKILL.md that references an old name.
Always verify the actual `package.json` before executing.

---

## Preflight Checklist (Full E2E Mode)

Run in order before spawning any E2E test:

- [ ] OS and shell detected and recorded
- [ ] Repository root resolved via `git rev-parse --show-toplevel`
- [ ] Maven wrapper exists in `apps/backend/` for detected OS
- [ ] `apps/backend/src/main/resources/application-e2e.yml` exists
- [ ] Maven `e2e` profile exists in `apps/backend/pom.xml`
- [ ] `playwright.config.ts` has backend `webServer` entry with `-Pe2e -Dspring-boot.run.profiles=e2e`
- [ ] `playwright.config.ts` passes `VITE_API_BASE_URL: 'http://localhost:8081'` to frontend webServer
- [ ] Playwright Chromium verified (Steps 1–3 above)
- [ ] E2E frontend port available (default 3010, override via `E2E_FRONTEND_PORT`)
- [ ] E2E backend port 8081 available or warmed up and reusable
- [ ] E2E script (`test:e2e`) exists in `apps/frontend/package.json`

For Smoke E2E, skip backend-related checks (Maven wrapper, application-e2e.yml, Maven profile, backend webServer, port 8081). Still verify Chromium and frontend.

---

## Port Conflict Recovery

If port 3010 is in use:
```bash
lsof -i :3010 | grep LISTEN    # macOS/Linux
# or
netstat -ano | findstr :3010   # Windows
```

Options:
1. Kill the conflicting process if it is safe to do so
2. Override via `E2E_FRONTEND_PORT=3011 npm run test:e2e`
3. Report conflict to Team Lead and stop

If port 8081 is in use but the backend is the E2E backend from a prior warmup, `reuseExistingServer: true` handles it — no action needed.
