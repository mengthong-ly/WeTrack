"use client";

import type { ComponentProps, CSSProperties } from "react";
import * as Hairline from "@lucasmarkes/hairline/react";

/**
 * hairline's Hub, wearing your theme. One of @lucasmarkes/hairline's thirty-three
 * isometric line figures: a hub and eight tiles on a grid; the tile nearest the
 * pointer rises and its link to the hub turns solid, its neighbours rising less.
 * The figure's palette is mapped to shadcn's tokens here, so it follows light,
 * dark and whatever you have made of them. A `style` you pass wins over the mapping.
 *
 * Source: https://github.com/lucasmarkes/hairline (registry/src/hairline.tsx), trimmed to the Hub figure.
 * Docs: https://hairline.lucasmarkes.com
 */
const tokens = {
  "--hairline-plate": "var(--background)",
  "--hairline-hi": "var(--foreground)",
  "--hairline-edge": "var(--muted-foreground)",
  "--hairline-mid":
    "color-mix(in oklab, var(--muted-foreground) 55%, var(--background))",
  "--hairline-lo": "var(--border)",
} as CSSProperties;

function Hub({ style, ...props }: ComponentProps<typeof Hairline.Hub>) {
  return <Hairline.Hub style={{ ...tokens, ...style }} {...props} />;
}

export default Hub;
