# Ivy Security Rules

## Credentials and Secrets (No Hardcoding)

- API Key patterns: `sk-[a-zA-Z0-9]{20,}`, `ghp_[a-zA-Z0-9]{36}`, `AKIA[A-Z0-9]{16}`
- Database connection strings: `jdbc://`, `mongodb://`, `postgresql://` (with password portion)
- Remediation: Use environment variables, e.g. `process.env.OPENAI_API_KEY`

## Personal Identifiable Information (PII)

- China mobile: `1[3-9]\d{9}`
- Email: `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`
- Remediation: Confirm test data; mask production data

## Sensitive File Blacklist

Agents MUST NOT read or write:

- `.env`, `.env.*`, `.envrc`
- `credentials.json`, `credentials.toml`, `secrets.yaml`
- `*.pem`, `*.key`, `id_rsa`, `id_ed25519`
- `service-account.json`, `firebase-*.json`
- `terraform.tfvars`, `.aws/credentials`

## Important Notice

AI scanning is NOT equivalent to professional SAST tools (SonarQube, Checkmarx, etc.).
Production deployments MUST pass professional security review.
