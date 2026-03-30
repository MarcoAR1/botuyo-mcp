# Contributing to @botuyo/mcp

Thanks for your interest in contributing! This MCP server is the open-source bridge between AI coding tools and the BotUyo platform.

## Getting Started

1. **Fork & clone** the repository
2. Install dependencies:
   ```sh
   npm install
   ```
3. Build:
   ```sh
   npm run build
   ```
4. Run tests:
   ```sh
   npm test
   ```

## Development Workflow

```sh
# Watch mode — auto-rebuilds on save
npm run dev

# Test with MCP Inspector (requires a BotUyo account)
BOTUYO_API_KEY=pk_live_... npm run inspect
```

### Project Structure

```
src/
├── index.ts              # Entry point + sub-command routing
├── client.ts             # Thin HTTP client for the BotUyo API
├── commands/             # CLI sub-commands (login, auth, setup, etc.)
│   └── __tests__/
├── tools/                # MCP tool handlers (one file per tool)
│   └── __tests__/
└── __tests__/
```

### Adding a New Tool

1. Create `src/tools/your_tool.ts` exporting a handler function
2. Register it in `src/tools/index.ts`
3. Add tests in `src/tools/__tests__/your_tool.spec.ts`
4. Run `npm test` to verify

## Pull Requests

- **One PR per feature/fix** — keep changes focused
- **Include tests** — all new tools must have a corresponding spec file
- **Follow existing patterns** — look at existing tools for handler structure and input validation
- **TypeScript only** — no plain JS files
- **Run `npm test`** before submitting

## Reporting Issues

Open an issue with:
- Steps to reproduce
- Expected vs actual behavior
- Your MCP client (Antigravity, Claude Desktop, Cursor, etc.)
- Node.js version (`node -v`)

## Code Style

- TypeScript strict mode
- No external runtime dependencies beyond `@modelcontextprotocol/sdk` and `zod`
- Keep the package lightweight — it runs via `npx`

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
