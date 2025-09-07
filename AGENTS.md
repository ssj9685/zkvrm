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
