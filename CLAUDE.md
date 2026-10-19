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
