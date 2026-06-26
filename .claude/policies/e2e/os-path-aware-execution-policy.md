# OS / Path-Aware Execution Policy

Used by: Team Lead, Playwright E2E Agent, and any agent that runs shell commands.
Load when running OS-sensitive commands, resolving paths, or verifying E2E environment.

---

## Core Rules

1. **Commands must be selected based on actual runtime OS and shell**, not assumed from prior runs or user machine history.
2. **Paths must be resolved from the active repository/worktree root** using `git rev-parse --show-toplevel`.
3. **Static absolute paths are forbidden** — no hardcoded `/home/user/...`, `/Users/amirbena/...`, `C:\...\mvn.cmd`, or any path tied to a specific machine or user account.
4. **Commands must not use stale paths from previous runs** — always resolve fresh from the current environment.
5. **Worktree isolation must be preserved** — if running in a worktree, all paths resolve from that worktree, not from the main clone.
6. **E2E must not rely on the user's currently running local frontend** — the E2E config must start its own isolated frontend on the dedicated E2E port.

---

## OS Detection

### Shell command (POSIX)
```bash
uname -s    # → Linux, Darwin, MINGW64_NT, CYGWIN_NT, etc.
echo "$SHELL"
```

### Node.js / Playwright config
```ts
const isWindows = process.platform === 'win32';
```

### Maven wrapper selection
| OS | Command |
|----|---------|
| macOS | `./mvnw` |
| Linux | `./mvnw` |
| WSL (detected as Linux) | `./mvnw` |
| Windows (native) | `mvnw.cmd` |

Always run from the backend directory (`apps/backend`). Use `cwd` option in Playwright config — do not `cd` and assume state persists.

---

## Repository Root Detection

```bash
git rev-parse --show-toplevel
```

Use this value as the base for all relative paths within a run. Do not assume the current working directory is the repository root — agents may be invoked from subdirectories or worktrees.

---

## Runtime Environment Evidence

Before E2E or any OS-sensitive operation, agents must record:

```md
## Runtime Environment

Repository root: <git rev-parse --show-toplevel>
Current working directory: <pwd>
Current branch: <git branch --show-current>
OS: <uname -s or process.platform>
Shell: <echo "$SHELL">
Frontend directory: <repo-root>/apps/frontend
Backend directory: <repo-root>/apps/backend
Maven wrapper (macOS/Linux): <test -f apps/backend/mvnw && echo OK || echo MISSING>
Maven wrapper (Windows): <test -f apps/backend/mvnw.cmd && echo OK || echo MISSING>
Frontend package.json: <test -f apps/frontend/package.json && echo OK || echo MISSING>
E2E frontend port: ${E2E_FRONTEND_PORT:-3010}
Backend E2E port: 8081
```

Suggested detection commands (POSIX):
```bash
git rev-parse --show-toplevel
pwd
git branch --show-current
uname -s
echo "$SHELL"
test -f apps/backend/mvnw && echo "mvnw: OK" || echo "mvnw: MISSING"
test -f apps/backend/mvnw.cmd && echo "mvnw.cmd: OK" || echo "mvnw.cmd: MISSING"
test -f apps/frontend/package.json && echo "frontend package.json: OK" || echo "MISSING"
node -p "process.platform"
```

---

## Forbidden Patterns

| Pattern | Why forbidden |
|---------|---------------|
| `C:\apache-maven-...\mvn.cmd` | Hardcoded Windows path — breaks on any other machine |
| `/home/user/.m2/...` | Hardcoded user home — breaks on any other machine |
| `$HOME/.m2/...` as a command | May differ between shell and Node runtime |
| Inferring OS from prior conversation or reports | OS may differ between runs |
| Assuming CWD is repo root | Not true in worktrees or nested invocations |
| Reusing paths from a prior worktree | Each worktree is isolated |
| Running against an already-running dev frontend | E2E must own its own frontend instance |

---

## Worktree Isolation

If an agent is invoked in a git worktree:
- All `git rev-parse` commands reflect the worktree root.
- Maven wrapper (`mvnw` / `mvnw.cmd`) must exist in the worktree's `apps/backend/`.
- Playwright must start services within the worktree, not from the main clone.
- Never reference `../../main-clone/...` from within a worktree.
