# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in `@botuyo/mcp`, please **do not** open a public issue.

Instead, email us at **support@botuyo.com** with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

We'll acknowledge your report within **48 hours** and aim to release a fix within **7 days** for critical issues.

## Scope

This policy covers the MCP server package (`@botuyo/mcp`). For vulnerabilities in the BotUyo platform itself (API, admin panel, widget), please contact us at the same email.

## Credentials & Tokens

- **Never commit** `.npmrc`, `.env`, or `credentials.json` files
- API keys and tokens are resolved from environment variables or `~/.botuyo/credentials.json` — never hardcoded
- The `.gitignore` is configured to exclude all sensitive files
