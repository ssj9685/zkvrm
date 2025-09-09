# Repository Guidelines

## Project Structure & Modules
- `src/server/`: Bun server and API routes (`index.ts`). Runs SQL migrations on boot. SQLite database lives at `zkvrm.sqlite`.
- `src/client/`: React 19 app (entry: `client/main.tsx`). Organized by `pages/`, `components/`, `store/`, `hooks/`, `lib/`. Uses Tailwind CSS (`client/index.css`).
- `scripts/`: Database migration tools and `migrations/*.sql` files.
- `dist/`: Built client assets (created by `build`).

## Build, Test, and Development
- `bun install`: Install dependencies.
- `bun run dev`: Start dev server with HMR (prints URL, typically `http://localhost:3000`). Applies pending migrations.
- `bun run build`: Bundle client to `dist/` with sourcemaps, minification.
- `bun run start`: Start server in production mode.
- `bun run migrate`: Apply all SQL migrations in `scripts/migrations/`.
- `bun run create-migration <name>`: Create `YYYYMMDDHHMMSS_<name>.sql` in `scripts/migrations/`.

## Coding Style & Naming
- **Language**: TypeScript (ESM), React 19, strict TS enabled.
- **Indentation**: Tabs (match existing files).
- **Files/dirs**: kebab-case (e.g., `login-page.tsx`, `icon-preview/`).
- **Components**: PascalCase exports; colocate simple UI in `components/`.
- **Imports**: Use path aliases `@client/*`, `@server/*`, `@shared/*`.
- **Styling**: Tailwind CSS utility classes; use `tailwind-merge` via `cn()` where needed.
- **Lint/format**: Biome available; example: `bunx @biomejs/biome check --apply .`.

## Testing Guidelines
- No formal test suite yet. Manually verify flows: register → login → memo CRUD → search → download.
- If adding tests, prefer Bun Test or Vitest; place under `src/**/__tests__/` or `tests/`, name `*.test.ts[x]`. Target stores and API routes first.

## Commit & PR Guidelines
- **Commits**: `<type>: <message>` (seen types: `feature`, `refactor`, `init`). Example: `feature: add memo search` or `refactor: simplify svg sprite`.
- **PRs**: Clear description, linked issues, screenshots/GIFs for UI, steps to reproduce/test, and note any DB/migration changes. Ensure `bun run migrate` passes locally.

## Security & Configuration
- **Env exposure**: Only `BUN_PUBLIC_*` vars are client-exposed (see `bunfig.toml`).
- **Data**: `zkvrm.sqlite` is for local dev; avoid committing production data.


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
