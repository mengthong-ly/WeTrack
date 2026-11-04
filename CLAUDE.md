@AGENTS.md

## Before any task that changes code

Before writing or changing any code, config, migration, script or test, do these four steps in order and say which step you are on. Read-only questions and one-word replies (`yes`, `continue`) skip them.

1. **Code structure.** Read the files the change touches and trace the real flow end to end: `app/` (routes, layouts, route handlers), `components/` (`ui/` is shadcn), `lib/` (queries, domain logic, `labels.ts`), `lib/db` and `drizzle/` (schema, migrations), `scripts/`. Find what already exists to reuse before writing anything new. The product spec is `docs/spec.md`.
2. **Tech stack.** Check the installed version in `package.json` before using its API: Next.js 16 (App Router; see the Next.js block in `AGENTS.md`), React 19, Tailwind 4, shadcn `base-nova` on `@base-ui/react`, Motion 14, Drizzle ORM on Postgres, better-auth, Tiptap 3, zod 4, three. The package manager is `pnpm`; tests run with `pnpm test` (`node --test lib/*.test.ts`).
3. **Skills.** Pick the skills the task needs and load them with the Skill tool before building; say `Using <skill> to <purpose>`. UI work loads the skills in "Before any UI or UX work" below. A bug loads `superpowers:systematic-debugging`; new logic in `lib/` loads `tdd`. If no skill fits, say so.
4. **Docs.** When the task calls a framework or package API, read the docs for the installed version first: `node_modules/next/dist/docs/` for Next.js, `pnpm dlx shadcn@latest docs <component>` for shadcn, Context7 (`resolve-library-id`, then one `query-docs` per concept) for everything else. Note anything that contradicts what you assumed.

Then state the plan in a few lines (files to touch, how you will verify it, what is out of scope) and build.

## Before any UI or UX work

Read [DESIGN.md](./DESIGN.md) and follow it for every page, component, style, animation, copy or interaction. Reuse the components and patterns it lists before writing new ones. If the work needs something DESIGN.md doesn't cover, add it to DESIGN.md in the same change.

Then invoke these skills with the Skill tool, in this order, and build:

1. `impeccable`: the design pass (hierarchy, layout, states, copy, accessibility).
2. `frontend-design`: aesthetic direction and detail.
3. `emil-design-eng`: polish and the invisible details.
4. `animate-expo`: motion decisions. This app is web (Next.js), not Expo: take its decision order (should it animate, which properties, spring or timing, interruption, reduced motion) and implement with DESIGN.md's motion tokens and `components/motion-bits.tsx`, not Reanimated.

Where a skill and DESIGN.md disagree, DESIGN.md wins.

Finish with DESIGN.md's "Before you ship UI" checklist, including a browser check at desktop, 375px and in dark mode.

## Components: shadcn first

Every control and component is shadcn. For each piece a screen needs (a picker, filter, menu, date field, tooltip, table, toast), before writing any markup:

1. Load the `shadcn` skill.
2. Look in `components/ui/`, then search the registries under every name the piece goes by (a filter dropdown is `select`, `combobox` and `dropdown-menu`): `pnpm dlx shadcn@latest search @shadcn -q <name>` (also `@coss` and `@animate-ui`), then `pnpm dlx shadcn@latest docs <name>` for the match.
3. Found: add it if missing (`pnpm dlx shadcn@latest add <name>`), read the added file, and compose it. Restyle only through DESIGN.md's tokens via `className` / `classNames`.
4. Nothing fits: stop and ask the owner before building it by hand, naming the names you searched. Build it only on a yes.

Controls whose popup the browser draws (a bare `<select>`, `<input type="date|time|datetime-local|color">`, `title=` tooltips) ignore the theme, so they count as "nothing fits" and need the owner's yes.

Done when every interactive element in the change is a `ui/` component, a composition of them, or one the owner approved.

## Colours and radius: tokens only

Every colour is a token from DESIGN.md (`bg-background`, `bg-card`, `text-muted-foreground`, `border-input`, `text-success-foreground`). Task and project meaning (status, priority, health, project colours) comes only from `lib/labels.ts`. Radius is `rounded-row|panel|card|tile|sheet`. No `rounded-[…]`, raw hex or one-off easing in app code.

Done when this scan over the files you touched prints nothing outside `components/ui/` and `lib/labels.ts`:

```sh
grep -nE -e '#[0-9a-fA-F]{3,8}\b' -e '(rgb|hsl|oklch)\(' -e 'rounded-\[' -e '\b(bg|text|border|ring|fill|stroke|from|via|to|outline|divide|shadow)-(white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b' <files>
```
