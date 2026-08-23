# zkvrm

A personal memo/note-taking app built around a spatial "brain graph" canvas where notes appear as sticky notes connected by yarn.

## Tech Stack

- **Runtime**: Bun
- **Frontend**: React (SPA), HTML5 Canvas for the brain graph, Tailwind CSS
- **Backend**: Bun HTTP server, SQLite
- **Language**: TypeScript throughout

## Design Principles

- **Warm, organic aesthetic**: tan/cream palette, rounded corners, paper/fabric textures
- **Scrapbook metaphor**: sticky notes, pins, yarn connections between notes
- **Minimal chrome**: information emerges from spatial layout, not from buttons or menus
- **Touch-first**: all interactions must work well on mobile with one hand
- **Korean-first UI text** with English technical labels (e.g., "selected memo", "note stack")

## Self-Review Checklist (UI changes)

- [ ] Is the interaction discoverable without instructions?
- [ ] Does it work on mobile touch without opening unwanted panels?
- [ ] Is there only ONE obvious way to perform this action?
- [ ] Does the visual weight match the action importance?
- [ ] Are connection-related actions visible without scrolling?

## Commands

```bash
bun test                # Run unit tests
bunx tsc --noEmit       # TypeScript check
bun run build           # Production build
bun run preview         # Preview production build
```

### Known test issues

- `design-variant.test.ts` has 2 pre-existing failures (ignore)
- `session.test.ts` and `http-routes.ts` have pre-existing TS errors (ignore in `tsc --noEmit`)

## Code Conventions

- **Design variant system**: `design-variant.ts` defines visual styles, geometries, and themes per variant
- **Palette tones**: `MemoTone` for sticky note colors, `MemoPinColor` for pin colors, `MemoYarnColor` for yarn/connection colors
- **Component patterns**: functional components, hooks for state, `cn()` utility for conditional classNames
- **Brain graph**: `brain-graph.ts` handles projection/layout, `brain-hit.ts` handles hit testing, `brain-window.ts` handles floating window positioning
- **Mobile**: bottom sheet with drag handle for editor; desktop uses floating context dock
