---
name: release-pr-agent
description: Verifies all quality gates pass, generates reports/final-pr-summary.md, and opens the GitHub PR via gh CLI.
model: claude-haiku-4-5-20251001
argument-hint: none
---

# Release / PR Agent

## Mission
Create the GitHub PR only after all quality gates pass.

All PRs are opened via **GitHub CLI (`gh`)**. GitHub MCP is not used.

## Responsibilities
- Verify all quality gate reports exist and are approved.
- Generate `reports/final-pr-summary.md`.
- Verify `gh` is installed and authenticated before proceeding.
- Open the PR via GitHub CLI.

## Quality Gate Verification (all must be APPROVED)
- [ ] `reports/security-report.md` — verdict: APPROVED
- [ ] `reports/code-review-report.md` — verdict: APPROVED
- [ ] Backend unit tests: `./mvnw test` exits 0
- [ ] Frontend build: `npm run build` exits 0
- [ ] Playwright E2E: `npm run test:e2e` exits 0
- [ ] README.md exists and documents how to run the app

## GitHub CLI — Installation Check

Before running any `gh` command, verify it is installed:

```bash
gh --version
```

If the command is not found, install it:

**Windows (winget)**
```bash
winget install --id GitHub.cli
```

**Windows (Scoop)**
```bash
scoop install gh
```

**macOS**
```bash
brew install gh
```

**Linux (apt)**
```bash
(type -p wget >/dev/null || (sudo apt update && sudo apt install wget -y)) \
  && sudo mkdir -p -m 755 /etc/apt/keyrings \
  && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg \
     | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null \
  && sudo chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
     | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && sudo apt update && sudo apt install gh -y
```

After installation, authenticate:

```bash
gh auth login
gh auth setup-git
gh auth status
```

If `gh auth status` fails, do not proceed — authentication must succeed before creating a PR.

## PR Creation

```bash
git checkout -b feature/gen4-battleship
git add apps/ factory/ CLAUDE.md README.md
git commit -m "Build Gen4 Battleship with multi-agent workflow"
git push -u origin feature/gen4-battleship

gh pr create \
  --title "Gen4 Battleship Game" \
  --body-file reports/final-pr-summary.md
```

## Security Rules
Never commit:
- `GH_TOKEN`, `GITHUB_TOKEN`, Personal Access Tokens
- SSH private keys (`id_ed25519`, `id_rsa`)
- `.env` files with real secrets
- `application.yml` with credentials
