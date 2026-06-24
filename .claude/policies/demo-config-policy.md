# Demo Config Policy
# Shared by: team-lead (Step 12), infrastructure-agent, security-agent
# Load when reviewing or writing config/env files in this demo/home-assignment repository.

## Classification

This is a demo/home-assignment repository. Classify config values as:

- `PUBLIC_CONFIG` — safe public value (e.g. localhost URL, default port)
- `PLACEHOLDER_CONFIG` — explicit placeholder, safe (e.g. `your-secret-here`)
- `DEMO_CONFIG_ACCEPTED` — demo/local value needed for task completion
- `UNKNOWN_SENSITIVE_VALUE` — unknown risk; document but do not block by default
- `OBVIOUS_REAL_LEAKED_CREDENTIAL` — **hard block**

## DEMO_CONFIG_ACCEPTED examples

```
JWT_SECRET=dev-secret
DATABASE_PASSWORD=local-password
GOOGLE_CLIENT_ID=demo-client-id
SPRING_PROFILES_ACTIVE=local
```

## Always block OBVIOUS_REAL_LEAKED_CREDENTIAL

- Real AWS access key (`AKIA...`)
- Real GitHub token (`ghp_...`, `ghs_...`)
- Real SSH private key
- Real production database URL with credentials
- Real payment provider secret

## Rules

- Do not block for `PLACEHOLDER_CONFIG` or `DEMO_CONFIG_ACCEPTED`.
- Do not over-block on dotenv/demo-sensitive-looking values.
- Only `OBVIOUS_REAL_LEAKED_CREDENTIAL` blocks unconditionally.
- `.env.example` may contain placeholders only, never real secrets.
