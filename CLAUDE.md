@AGENTS.md

## UI and UX work: read the design system first

Before you create or change any page, component, style, animation, copy or interaction, read
[DESIGN.md](./DESIGN.md) and follow it:

- Reuse the components and patterns it lists before writing new ones.
- Use its tokens only (`rounded-row|panel|card|tile|sheet`, theme colours, semantic colours from
  `lib/labels.ts`, motion from `components/motion-bits.tsx`). No `rounded-[…]`, raw hex or one-off
  easing in app code.
- If the work needs something DESIGN.md doesn't cover, add it to DESIGN.md in the same change.
- Finish with DESIGN.md's "Before you ship UI" checklist, including a browser check at desktop,
  375px and in dark mode.

## Every UI task: skills and shadcn first

CLAUDE.md is loaded at the start of every session. On **every** task that touches UI, before writing code:

1. Read [DESIGN.md](./DESIGN.md) (above).
2. Load the **`emil-design-eng`** and **`impeccable`** skills and apply them (motion, easing, press feedback,
   polish pass). They refine within DESIGN.md; DESIGN.md wins on conflicts.
3. Read the shadcn component before you use or build UI: check `components/ui/` and `components.json`, run
   `pnpm dlx shadcn@latest docs <component>` and read the docs and examples it points to. Search the shadcn
   registry (`pnpm dlx shadcn@latest search @shadcn -q "<need>"`) and other registries before hand-rolling
   markup. Add missing primitives with `pnpm dlx shadcn@latest add <component>`, then read the added file.
4. Build on those components (Calendar, Sheet, Table, Select, Button, …) and restyle with DESIGN.md tokens
   through `className` / `classNames`, instead of re-implementing them with raw elements.
