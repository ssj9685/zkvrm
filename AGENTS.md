# Repository Guidelines

<!-- BUN-GUIDELINE: Preserve all Bun-specific setup and commands unless explicitly instructed otherwise. -->

## Project Structure & Module Organization
- `src/server/` hosts the Bun HTTP API (`index.ts`) and runs SQLite migrations against `zkvrm.sqlite` on boot.
- `src/client/` contains the React 19 front end; entry point `client/main.tsx` wires pages, components, hooks, and store modules.
- `scripts/` provides migration helpers and SQL (`scripts/migrations/*.sql`); `dist/` holds built assets from `bun run build`.

## Build, Test, and Development Commands
- `bun install` installs dependencies.
- `bun run dev` starts the HMR dev server at `http://localhost:3000` and applies pending migrations.
- `bun run build` bundles the client to `dist/` with sourcemaps and minification.
- `bun run start` serves the production bundle.
- `bun run migrate` applies all SQL migrations; pair with `bun run create-migration <name>` to scaffold new files.

## Coding Style & Naming Conventions
- Codebase uses TypeScript (ESM) with strict typing; React components export in PascalCase.
- Indent with tabs and prefer kebab-case for files and directories.
- Use Tailwind utilities, merging via the shared `cn()` helper when combining class strings.
- Import via aliases (`@client/*`, `@server/*`, `@shared/*`) to avoid brittle relative paths.
- Run `bunx @biomejs/biome check --apply .` before committing to ensure formatting and lint rules pass.

## Testing Guidelines
- Default to Bun Test (`bun test`) for unit coverage; Vitest is acceptable when needed for compatibility.
- Place specs under `src/**/__tests__/` or `tests/` and name them `*.test.ts[x]`.
- Prioritize high-value flows: auth, memo CRUD, search, and download logic in both API routes and stores.
- When adding new features, supply focused tests or document manual steps in the PR description.

## Commit & Pull Request Guidelines
- Follow the observed convention `<type>: <message>` (examples: `feature: add memo search`, `refactor: simplify svg sprite`).
- Commits should be cohesive; avoid mixing unrelated refactors or formatting.
- PRs include a clear summary, linked issues, reproduction steps, and screenshots/GIFs for UI work.
- Note any schema or migration changes and confirm `bun run migrate` succeeds locally.

## Security & Configuration Tips
- Only expose environment variables prefixed with `BUN_PUBLIC_`; keep secrets server-side.
- SQLite data lives in `zkvrm.sqlite` for local development—never commit production datasets.
- Prefer Bun primitives (`Bun.file`, `bun:sqlite`, `Bun.serve`) over Node alternatives to stay aligned with platform expectations.

---
description: Use Bun instead of Node.js, npm, pnpm, or vite.
globs: "*.ts, *.tsx, *.html, *.css, *.js, *.jsx, package.json"
alwaysApply: false
---

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";

// import .css files directly and it works
import './index.css';

import { createRoot } from "react-dom/client";

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.md`.
