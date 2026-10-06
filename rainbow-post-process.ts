import { RGBA } from "@opentui/core";
import type { ResolvedTheme } from "@opencode/theme/tui";

const eps = 1 / 510;
const top = "▀".charCodeAt(0);
const tilt = (25 * Math.PI) / 180;
const dx = Math.cos(tilt);
const dy = Math.sin(tilt);
const pi = Math.PI;
const miss = 2;
const missU16 = 512;

export type RainbowColor = {
  r: number;
  g: number;
  b: number;
  a: number;
};

export type RainbowTheme = {
  text: RainbowColor;
  textMuted: RainbowColor;
  primary: RainbowColor;
  accent: RainbowColor;
  secondary: RainbowColor;
  background: RainbowColor;
  backgroundPanel: RainbowColor;
  backgroundElement: RainbowColor;
  backgroundMenu: RainbowColor;
};

export type RainbowConfig = {
  fg: boolean;
  bg: boolean;
  speed: number;
  turns: number;
  glow: number;
};

export type RainbowBuffer = {
  width: number;
  height: number;
  buffers: {
    char: ArrayLike<number>;
    fg: Float32Array | Uint16Array;
    bg: Float32Array | Uint16Array;
  };
};

type ThemeCache = {
  ready: boolean;
  values: number[];
  palette: number[];
  paletteCount: number;
  bgMarks: number[];
  paletteU16: number[];
  bgMarksU16: number[];
};

const colorInt = (value: number) => Math.round(value * 255);

const colorKey = (r: number, g: number, b: number, a: number) => {
  return (((colorInt(r) * 256 + colorInt(g)) * 256 + colorInt(b)) * 256 + colorInt(a)) >>> 0;
};

const rgbKey = (r: number, g: number, b: number) => {
  return ((colorInt(r) * 256 + colorInt(g)) * 256 + colorInt(b)) >>> 0;
};

const colorChanged = (values: number[], offset: number, ink: RainbowColor) => {
  return (
    values[offset] !== ink.r ||
    values[offset + 1] !== ink.g ||
    values[offset + 2] !== ink.b ||
    values[offset + 3] !== ink.a
  );
};

const storeColor = (values: number[], offset: number, ink: RainbowColor) => {
  values[offset] = ink.r;
  values[offset + 1] = ink.g;
  values[offset + 2] = ink.b;
  values[offset + 3] = ink.a;
};

const mixChannel = (a: number, b: number, t: number) => a + (b - a) * t;

const addPalette = (
  palette: number[],
  seen: Set<number>,
  r: number,
  g: number,
  b: number,
  a: number,
) => {
  const key = colorKey(r, g, b, a);
  if (seen.has(key)) return;
  seen.add(key);
  palette.push(r, g, b);
};

const addPaletteMix = (
  palette: number[],
  seen: Set<number>,
  a: RainbowColor,
  b: RainbowColor,
  t: number,
) => {
  addPalette(
    palette,
    seen,
    mixChannel(a.r, b.r, t),
    mixChannel(a.g, b.g, t),
    mixChannel(a.b, b.b, t),
    mixChannel(a.a, b.a, t),
  );
};

const addBgMark = (marks: number[], seen: Set<number>, ink: RainbowColor) => {
  const key = rgbKey(ink.r, ink.g, ink.b);
  if (seen.has(key)) return;
  seen.add(key);
  marks.push(ink.r, ink.g, ink.b);
};

const syncThemeCache = (cache: ThemeCache, theme: RainbowTheme) => {
  if (
    cache.ready &&
    !colorChanged(cache.values, 0, theme.text) &&
    !colorChanged(cache.values, 4, theme.textMuted) &&
    !colorChanged(cache.values, 8, theme.primary) &&
    !colorChanged(cache.values, 12, theme.accent) &&
    !colorChanged(cache.values, 16, theme.secondary) &&
    !colorChanged(cache.values, 20, theme.background) &&
    !colorChanged(cache.values, 24, theme.backgroundPanel) &&
    !colorChanged(cache.values, 28, theme.backgroundElement) &&
    !colorChanged(cache.values, 32, theme.backgroundMenu)
  ) {
    return;
  }

  storeColor(cache.values, 0, theme.text);
  storeColor(cache.values, 4, theme.textMuted);
  storeColor(cache.values, 8, theme.primary);
  storeColor(cache.values, 12, theme.accent);
  storeColor(cache.values, 16, theme.secondary);
  storeColor(cache.values, 20, theme.background);
  storeColor(cache.values, 24, theme.backgroundPanel);
  storeColor(cache.values, 28, theme.backgroundElement);
  storeColor(cache.values, 32, theme.backgroundMenu);

  const paletteSeen = new Set<number>();
  const palette: number[] = [];
  addPaletteMix(palette, paletteSeen, theme.text, theme.primary, 0.4);
  addPalette(
    palette,
    paletteSeen,
    theme.primary.r,
    theme.primary.g,
    theme.primary.b,
    theme.primary.a,
  );
  addPaletteMix(palette, paletteSeen, theme.primary, theme.accent, 0.5);
  addPalette(palette, paletteSeen, theme.accent.r, theme.accent.g, theme.accent.b, theme.accent.a);
  addPaletteMix(palette, paletteSeen, theme.accent, theme.secondary, 0.5);
  addPalette(
    palette,
    paletteSeen,
    theme.secondary.r,
    theme.secondary.g,
    theme.secondary.b,
    theme.secondary.a,
  );
  addPaletteMix(palette, paletteSeen, theme.secondary, theme.textMuted, 0.35);

  if (!palette.length) {
    palette.push(theme.primary.r, theme.primary.g, theme.primary.b);
  }

  const bgSeen = new Set<number>();
  const bgMarks: number[] = [];
  addBgMark(bgMarks, bgSeen, theme.background);
  addBgMark(bgMarks, bgSeen, theme.backgroundPanel);
  addBgMark(bgMarks, bgSeen, theme.backgroundElement);
  addBgMark(bgMarks, bgSeen, theme.backgroundMenu);

  cache.ready = true;
  cache.palette = palette;
  cache.paletteCount = palette.length / 3;
  cache.bgMarks = bgMarks;
  cache.paletteU16 = palette.map((v) => Math.round(v * 255));
  cache.bgMarksU16 = bgMarks.map((v) => Math.round(v * 255));
};

const paintFull = (
  buf: Float32Array | Uint16Array,
  slot: number,
  palette: number[],
  paletteCount: number,
  phase: number,
) => {
  const pos = (phase - Math.floor(phase)) * paletteCount;
  const idx = Math.floor(pos);
  const gap = pos - idx;
  const base = idx * 3;
  const next = idx + 1 === paletteCount ? 0 : base + 3;
  const baseR = palette[base]!;
  const baseG = palette[base + 1]!;
  const baseB = palette[base + 2]!;
  const nextR = palette[next]!;
  const nextG = palette[next + 1]!;
  const nextB = palette[next + 2]!;
  const r = baseR + (nextR - baseR) * gap;
  const g = baseG + (nextG - baseG) * gap;
  const b = baseB + (nextB - baseB) * gap;

  buf[slot] = r;
  buf[slot + 1] = g;
  buf[slot + 2] = b;
};

const paintBlend = (
  buf: Float32Array | Uint16Array,
  slot: number,
  palette: number[],
  paletteCount: number,
  phase: number,
  amt: number,
) => {
  const pos = (phase - Math.floor(phase)) * paletteCount;
  const idx = Math.floor(pos);
  const gap = pos - idx;
  const base = idx * 3;
  const next = idx + 1 === paletteCount ? 0 : base + 3;
  const baseR = palette[base]!;
  const baseG = palette[base + 1]!;
  const baseB = palette[base + 2]!;
  const nextR = palette[next]!;
  const nextG = palette[next + 1]!;
  const nextB = palette[next + 2]!;
  const r = baseR + (nextR - baseR) * gap;
  const g = baseG + (nextG - baseG) * gap;
  const b = baseB + (nextB - baseB) * gap;
  const prevR = buf[slot]!;
  const prevG = buf[slot + 1]!;
  const prevB = buf[slot + 2]!;

  buf[slot] = prevR + (r - prevR) * amt;
  buf[slot + 1] = prevG + (g - prevG) * amt;
  buf[slot + 2] = prevB + (b - prevB) * amt;
};

const paintFullU16 = (
  buf: Uint16Array | Float32Array,
  slot: number,
  palette: number[],
  paletteCount: number,
  phase: number,
) => {
  const pos = (phase - Math.floor(phase)) * paletteCount;
  const idx = Math.floor(pos);
  const gap = pos - idx;
  const base = idx * 3;
  const next = idx + 1 === paletteCount ? 0 : base + 3;
  const baseR = palette[base]!;
  const baseG = palette[base + 1]!;
  const baseB = palette[base + 2]!;
  const nextR = palette[next]!;
  const nextG = palette[next + 1]!;
  const nextB = palette[next + 2]!;
  const r = baseR + (nextR - baseR) * gap;
  const g = baseG + (nextG - baseG) * gap;
  const b = baseB + (nextB - baseB) * gap;

  buf[slot] = Math.round(r);
  buf[slot + 1] = Math.round(g);
  buf[slot + 2] = Math.round(b);
};

const paintBlendU16 = (
  buf: Uint16Array | Float32Array,
  slot: number,
  palette: number[],
  paletteCount: number,
  phase: number,
  amt: number,
) => {
  const pos = (phase - Math.floor(phase)) * paletteCount;
  const idx = Math.floor(pos);
  const gap = pos - idx;
  const base = idx * 3;
  const next = idx + 1 === paletteCount ? 0 : base + 3;
  const baseR = palette[base]!;
  const baseG = palette[base + 1]!;
  const baseB = palette[base + 2]!;
  const nextR = palette[next]!;
  const nextG = palette[next + 1]!;
  const nextB = palette[next + 2]!;
  const r = baseR + (nextR - baseR) * gap;
  const g = baseG + (nextG - baseG) * gap;
  const b = baseB + (nextB - baseB) * gap;
  // Mask with 0xff to read the true color channel and ignore intent metadata in the high byte
  const prevR = buf[slot]! & 255;
  const prevG = buf[slot + 1]! & 255;
  const prevB = buf[slot + 2]! & 255;

  buf[slot] = Math.round(prevR + (r - prevR) * amt);
  buf[slot + 1] = Math.round(prevG + (g - prevG) * amt);
  buf[slot + 2] = Math.round(prevB + (b - prevB) * amt);
};

const applyBoth = (
  buffer: RainbowBuffer,
  palette: number[],
  paletteCount: number,
  fgStep: number,
  fgRow: number,
  fgShift: number,
  bgStep: number,
  bgRow: number,
  bgShift: number,
  glow: number,
  textR: number,
  textG: number,
  textB: number,
  mutedR: number,
  mutedG: number,
  mutedB: number,
  bg0r: number,
  bg0g: number,
  bg0b: number,
  bg1r: number,
  bg1g: number,
  bg1b: number,
  bg2r: number,
  bg2g: number,
  bg2b: number,
  bg3r: number,
  bg3g: number,
  bg3b: number,
) => {
  const width = buffer.width;
  const height = buffer.height;
  const fg = buffer.buffers.fg;
  const bg = buffer.buffers.bg;
  const char = buffer.buffers.char;

  for (let y = 0, cell = 0, slot = 0; y < height; y++) {
    let fgPhase = y * fgRow + fgShift;
    let bgPhase = y * bgRow + bgShift;

    for (let x = 0; x < width; x++, cell++, slot += 4) {
      const r = fg[slot]!;
      const g = fg[slot + 1]!;
      const b = fg[slot + 2]!;

      if (
        (Math.abs(r - textR) <= eps && Math.abs(g - textG) <= eps && Math.abs(b - textB) <= eps) ||
        (Math.abs(r - mutedR) <= eps && Math.abs(g - mutedG) <= eps && Math.abs(b - mutedB) <= eps)
      ) {
        paintFull(fg, slot, palette, paletteCount, fgPhase);
      }

      const br = bg[slot]!;
      const bgg = bg[slot + 1]!;
      const bb = bg[slot + 2]!;
      const matchBg =
        (Math.abs(br - bg0r) <= eps && Math.abs(bgg - bg0g) <= eps && Math.abs(bb - bg0b) <= eps) ||
        (Math.abs(br - bg1r) <= eps && Math.abs(bgg - bg1g) <= eps && Math.abs(bb - bg1b) <= eps) ||
        (Math.abs(br - bg2r) <= eps && Math.abs(bgg - bg2g) <= eps && Math.abs(bb - bg2b) <= eps) ||
        (Math.abs(br - bg3r) <= eps && Math.abs(bgg - bg3g) <= eps && Math.abs(bb - bg3b) <= eps);

      if (matchBg) {
        const rise = Math.sin((bgPhase - Math.floor(bgPhase)) * pi);
        const amt = glow * (0.35 + 0.65 * rise * rise);
        paintBlend(bg, slot, palette, paletteCount, bgPhase, amt);

        if (
          char[cell] === top &&
          ((Math.abs(r - bg0r) <= eps && Math.abs(g - bg0g) <= eps && Math.abs(b - bg0b) <= eps) ||
            (Math.abs(r - bg1r) <= eps && Math.abs(g - bg1g) <= eps && Math.abs(b - bg1b) <= eps) ||
            (Math.abs(r - bg2r) <= eps && Math.abs(g - bg2g) <= eps && Math.abs(b - bg2b) <= eps) ||
            (Math.abs(r - bg3r) <= eps && Math.abs(g - bg3g) <= eps && Math.abs(b - bg3b) <= eps))
        ) {
          paintBlend(fg, slot, palette, paletteCount, bgPhase, amt);
        }
      }

      fgPhase += fgStep;
      bgPhase += bgStep;
    }
  }
};

const applyBothU16 = (
  buffer: RainbowBuffer,
  palette: number[],
  paletteCount: number,
  fgStep: number,
  fgRow: number,
  fgShift: number,
  bgStep: number,
  bgRow: number,
  bgShift: number,
  glow: number,
  textR: number,
  textG: number,
  textB: number,
  mutedR: number,
  mutedG: number,
  mutedB: number,
  bg0r: number,
  bg0g: number,
  bg0b: number,
  bg1r: number,
  bg1g: number,
  bg1b: number,
  bg2r: number,
  bg2g: number,
  bg2b: number,
  bg3r: number,
  bg3g: number,
  bg3b: number,
) => {
  const width = buffer.width;
  const height = buffer.height;
  const fg = buffer.buffers.fg;
  const bg = buffer.buffers.bg;
  const char = buffer.buffers.char;

  for (let y = 0, cell = 0, slot = 0; y < height; y++) {
    let fgPhase = y * fgRow + fgShift;
    let bgPhase = y * bgRow + bgShift;

    for (let x = 0; x < width; x++, cell++, slot += 4) {
      // In OpenTUI 0.5 Uint16Array buffers, low byte holds color and high byte holds intent metadata
      const r = fg[slot]! & 255;
      const g = fg[slot + 1]! & 255;
      const b = fg[slot + 2]! & 255;

      if (
        (r === textR && g === textG && b === textB) ||
        (r === mutedR && g === mutedG && b === mutedB)
      ) {
        paintFullU16(fg, slot, palette, paletteCount, fgPhase);
      }

      const br = bg[slot]! & 255;
      const bgg = bg[slot + 1]! & 255;
      const bb = bg[slot + 2]! & 255;
      const matchBg =
        (br === bg0r && bgg === bg0g && bb === bg0b) ||
        (br === bg1r && bgg === bg1g && bb === bg1b) ||
        (br === bg2r && bgg === bg2g && bb === bg2b) ||
        (br === bg3r && bgg === bg3g && bb === bg3b);

      if (matchBg) {
        const rise = Math.sin((bgPhase - Math.floor(bgPhase)) * pi);
        const amt = glow * (0.35 + 0.65 * rise * rise);
        paintBlendU16(bg, slot, palette, paletteCount, bgPhase, amt);

        if (
          char[cell] === top &&
          ((r === bg0r && g === bg0g && b === bg0b) ||
            (r === bg1r && g === bg1g && b === bg1b) ||
            (r === bg2r && g === bg2g && b === bg2b) ||
            (r === bg3r && g === bg3g && b === bg3b))
        ) {
          paintBlendU16(fg, slot, palette, paletteCount, bgPhase, amt);
        }
      }

      fgPhase += fgStep;
      bgPhase += bgStep;
    }
  }
};

const applyFgOnly = (
  buffer: RainbowBuffer,
  palette: number[],
  paletteCount: number,
  fgStep: number,
  fgRow: number,
  fgShift: number,
  textR: number,
  textG: number,
  textB: number,
  mutedR: number,
  mutedG: number,
  mutedB: number,
) => {
  const width = buffer.width;
  const height = buffer.height;
  const fg = buffer.buffers.fg;

  for (let y = 0, slot = 0; y < height; y++) {
    let fgPhase = y * fgRow + fgShift;

    for (let x = 0; x < width; x++, slot += 4) {
      const r = fg[slot]!;
      const g = fg[slot + 1]!;
      const b = fg[slot + 2]!;
      if (
        (Math.abs(r - textR) <= eps && Math.abs(g - textG) <= eps && Math.abs(b - textB) <= eps) ||
        (Math.abs(r - mutedR) <= eps && Math.abs(g - mutedG) <= eps && Math.abs(b - mutedB) <= eps)
      ) {
        paintFull(fg, slot, palette, paletteCount, fgPhase);
      }
      fgPhase += fgStep;
    }
  }
};

const applyFgOnlyU16 = (
  buffer: RainbowBuffer,
  palette: number[],
  paletteCount: number,
  fgStep: number,
  fgRow: number,
  fgShift: number,
  textR: number,
  textG: number,
  textB: number,
  mutedR: number,
  mutedG: number,
  mutedB: number,
) => {
  const width = buffer.width;
  const height = buffer.height;
  const fg = buffer.buffers.fg;

  for (let y = 0, slot = 0; y < height; y++) {
    let fgPhase = y * fgRow + fgShift;

    for (let x = 0; x < width; x++, slot += 4) {
      const r = fg[slot]! & 255;
      const g = fg[slot + 1]! & 255;
      const b = fg[slot + 2]! & 255;
      if (
        (r === textR && g === textG && b === textB) ||
        (r === mutedR && g === mutedG && b === mutedB)
      ) {
        paintFullU16(fg, slot, palette, paletteCount, fgPhase);
      }
      fgPhase += fgStep;
    }
  }
};

const applyBgOnly = (
  buffer: RainbowBuffer,
  palette: number[],
  paletteCount: number,
  bgStep: number,
  bgRow: number,
  bgShift: number,
  glow: number,
  bg0r: number,
  bg0g: number,
  bg0b: number,
  bg1r: number,
  bg1g: number,
  bg1b: number,
  bg2r: number,
  bg2g: number,
  bg2b: number,
  bg3r: number,
  bg3g: number,
  bg3b: number,
) => {
  const width = buffer.width;
  const height = buffer.height;
  const fg = buffer.buffers.fg;
  const bg = buffer.buffers.bg;
  const char = buffer.buffers.char;

  for (let y = 0, cell = 0, slot = 0; y < height; y++) {
    let bgPhase = y * bgRow + bgShift;

    for (let x = 0; x < width; x++, cell++, slot += 4) {
      const r = fg[slot]!;
      const g = fg[slot + 1]!;
      const b = fg[slot + 2]!;
      const br = bg[slot]!;
      const bgg = bg[slot + 1]!;
      const bb = bg[slot + 2]!;
      const matchBg =
        (Math.abs(br - bg0r) <= eps && Math.abs(bgg - bg0g) <= eps && Math.abs(bb - bg0b) <= eps) ||
        (Math.abs(br - bg1r) <= eps && Math.abs(bgg - bg1g) <= eps && Math.abs(bb - bg1b) <= eps) ||
        (Math.abs(br - bg2r) <= eps && Math.abs(bgg - bg2g) <= eps && Math.abs(bb - bg2b) <= eps) ||
        (Math.abs(br - bg3r) <= eps && Math.abs(bgg - bg3g) <= eps && Math.abs(bb - bg3b) <= eps);

      if (matchBg) {
        const rise = Math.sin((bgPhase - Math.floor(bgPhase)) * pi);
        const amt = glow * (0.35 + 0.65 * rise * rise);
        paintBlend(bg, slot, palette, paletteCount, bgPhase, amt);

        if (
          char[cell] === top &&
          ((Math.abs(r - bg0r) <= eps && Math.abs(g - bg0g) <= eps && Math.abs(b - bg0b) <= eps) ||
            (Math.abs(r - bg1r) <= eps && Math.abs(g - bg1g) <= eps && Math.abs(b - bg1b) <= eps) ||
            (Math.abs(r - bg2r) <= eps && Math.abs(g - bg2g) <= eps && Math.abs(b - bg2b) <= eps) ||
            (Math.abs(r - bg3r) <= eps && Math.abs(g - bg3g) <= eps && Math.abs(b - bg3b) <= eps))
        ) {
          paintBlend(fg, slot, palette, paletteCount, bgPhase, amt);
        }
      }

      bgPhase += bgStep;
    }
  }
};

const applyBgOnlyU16 = (
  buffer: RainbowBuffer,
  palette: number[],
  paletteCount: number,
  bgStep: number,
  bgRow: number,
  bgShift: number,
  glow: number,
  bg0r: number,
  bg0g: number,
  bg0b: number,
  bg1r: number,
  bg1g: number,
  bg1b: number,
  bg2r: number,
  bg2g: number,
  bg2b: number,
  bg3r: number,
  bg3g: number,
  bg3b: number,
) => {
  const width = buffer.width;
  const height = buffer.height;
  const fg = buffer.buffers.fg;
  const bg = buffer.buffers.bg;
  const char = buffer.buffers.char;

  for (let y = 0, cell = 0, slot = 0; y < height; y++) {
    let bgPhase = y * bgRow + bgShift;

    for (let x = 0; x < width; x++, cell++, slot += 4) {
      const r = fg[slot]! & 255;
      const g = fg[slot + 1]! & 255;
      const b = fg[slot + 2]! & 255;
      const br = bg[slot]! & 255;
      const bgg = bg[slot + 1]! & 255;
      const bb = bg[slot + 2]! & 255;
      const matchBg =
        (br === bg0r && bgg === bg0g && bb === bg0b) ||
        (br === bg1r && bgg === bg1g && bb === bg1b) ||
        (br === bg2r && bgg === bg2g && bb === bg2b) ||
        (br === bg3r && bgg === bg3g && bb === bg3b);

      if (matchBg) {
        const rise = Math.sin((bgPhase - Math.floor(bgPhase)) * pi);
        const amt = glow * (0.35 + 0.65 * rise * rise);
        paintBlendU16(bg, slot, palette, paletteCount, bgPhase, amt);

        if (
          char[cell] === top &&
          ((r === bg0r && g === bg0g && b === bg0b) ||
            (r === bg1r && g === bg1g && b === bg1b) ||
            (r === bg2r && g === bg2g && b === bg2b) ||
            (r === bg3r && g === bg3g && b === bg3b))
        ) {
          paintBlendU16(fg, slot, palette, paletteCount, bgPhase, amt);
        }
      }

      bgPhase += bgStep;
    }
  }
};

export const toRgba = (color: RainbowColor): RGBA => {
  if (color instanceof RGBA) return color;
  return RGBA.fromValues(color.r, color.g, color.b, color.a);
};

export type LegacyTheme = {
  text: RainbowColor;
  textMuted: RainbowColor;
  primary: RainbowColor;
  accent: RainbowColor;
  secondary: RainbowColor;
  background: RainbowColor;
  backgroundPanel?: RainbowColor;
  backgroundElement?: RainbowColor;
  backgroundMenu?: RainbowColor;
};

export type PartialResolvedTheme = {
  text: { base: RainbowColor; muted: RainbowColor; action?: any };
  background: {
    base: RainbowColor;
    raised: { base: RainbowColor; high: RainbowColor; max: RainbowColor };
  };
  hue?: { interactive?: Record<number, RainbowColor>; accent?: Record<number, RainbowColor> };
  categorical?: Array<Record<number, RainbowColor>>;
  syntax?: { keyword?: RainbowColor; function?: RainbowColor };
};

export const toRainbowTheme = (
  theme: ResolvedTheme | RainbowTheme | LegacyTheme | PartialResolvedTheme,
  _mode: "dark" | "light" = "dark",
): RainbowTheme => {
  if ("primary" in theme && "background" in theme && "text" in theme) {
    const legacy = theme as LegacyTheme;
    return {
      text: legacy.text,
      textMuted: legacy.textMuted,
      primary: legacy.primary,
      accent: legacy.accent,
      secondary: legacy.secondary,
      background: legacy.background,
      backgroundPanel: legacy.backgroundPanel ?? legacy.background,
      backgroundElement: legacy.backgroundElement ?? legacy.backgroundPanel ?? legacy.background,
      backgroundMenu: legacy.backgroundMenu ?? legacy.backgroundElement ?? legacy.background,
    };
  }

  // ResolvedTheme from @opencode/theme/tui
  // In OpenCode 2.0, hue scales are already resolved for the active mode and step 200 represents
  // the prominent foreground accent/interactive color in both light and dark modes.
  const step = 200;
  const primary =
    theme.hue?.interactive?.[step] ??
    theme.text?.action?.primary?.base ??
    theme.text?.base ??
    RGBA.fromValues(0.36, 0.55, 1, 1);
  const accent = theme.hue?.accent?.[step] ?? theme.syntax?.keyword ?? primary;
  const secondary = theme.categorical?.[0]?.[step] ?? theme.syntax?.function ?? primary;

  return {
    text: theme.text.base,
    textMuted: theme.text.muted,
    primary,
    accent,
    secondary,
    background: theme.background.base,
    backgroundPanel: theme.background.raised.base,
    backgroundElement: theme.background.raised.high,
    backgroundMenu: theme.background.raised.max,
  };
};

export const createRainbowPostProcess = (theme: () => RainbowTheme, value: () => RainbowConfig) => {
  let time = 0;
  const cache: ThemeCache = {
    ready: false,
    values: new Array(36).fill(0),
    palette: [0, 0, 0],
    paletteCount: 1,
    bgMarks: [],
    paletteU16: [0, 0, 0],
    bgMarksU16: [],
  };

  return (buffer: RainbowBuffer, delta: number) => {
    const cfg = value();
    const useFg = cfg.fg;
    const useBg = cfg.bg && cfg.glow > 0;
    if (!useFg && !useBg) return;

    time += delta * cfg.speed;

    const skin = theme();
    syncThemeCache(cache, skin);

    const isUint16 = buffer.buffers.fg instanceof Uint16Array;
    const invSpan = 1 / Math.max(1, buffer.width * dx + buffer.height * dy);
    const fgStep = dx * invSpan * cfg.turns;
    const fgRow = dy * invSpan * cfg.turns;
    const fgShift = time * 0.1;
    const blur = Math.max(0.5, cfg.turns * 0.55);
    const bgStep = dx * invSpan * blur;
    const bgRow = dy * invSpan * blur;
    const bgShift = time * 0.04 + 0.17;

    if (isUint16) {
      const textR = Math.round(skin.text.r * 255);
      const textG = Math.round(skin.text.g * 255);
      const textB = Math.round(skin.text.b * 255);
      const mutedR = Math.round(skin.textMuted.r * 255);
      const mutedG = Math.round(skin.textMuted.g * 255);
      const mutedB = Math.round(skin.textMuted.b * 255);

      const bgMarks = cache.bgMarksU16;
      const bg0r = bgMarks[0] ?? missU16;
      const bg0g = bgMarks[1] ?? missU16;
      const bg0b = bgMarks[2] ?? missU16;
      const bg1r = bgMarks[3] ?? missU16;
      const bg1g = bgMarks[4] ?? missU16;
      const bg1b = bgMarks[5] ?? missU16;
      const bg2r = bgMarks[6] ?? missU16;
      const bg2g = bgMarks[7] ?? missU16;
      const bg2b = bgMarks[8] ?? missU16;
      const bg3r = bgMarks[9] ?? missU16;
      const bg3g = bgMarks[10] ?? missU16;
      const bg3b = bgMarks[11] ?? missU16;

      const palette = cache.paletteU16;
      const paletteCount = cache.paletteCount;

      if (useFg && useBg) {
        applyBothU16(
          buffer,
          palette,
          paletteCount,
          fgStep,
          fgRow,
          fgShift,
          bgStep,
          bgRow,
          bgShift,
          cfg.glow,
          textR,
          textG,
          textB,
          mutedR,
          mutedG,
          mutedB,
          bg0r,
          bg0g,
          bg0b,
          bg1r,
          bg1g,
          bg1b,
          bg2r,
          bg2g,
          bg2b,
          bg3r,
          bg3g,
          bg3b,
        );
        return;
      }

      if (useFg) {
        applyFgOnlyU16(
          buffer,
          palette,
          paletteCount,
          fgStep,
          fgRow,
          fgShift,
          textR,
          textG,
          textB,
          mutedR,
          mutedG,
          mutedB,
        );
        return;
      }

      applyBgOnlyU16(
        buffer,
        palette,
        paletteCount,
        bgStep,
        bgRow,
        bgShift,
        cfg.glow,
        bg0r,
        bg0g,
        bg0b,
        bg1r,
        bg1g,
        bg1b,
        bg2r,
        bg2g,
        bg2b,
        bg3r,
        bg3g,
        bg3b,
      );
      return;
    }

    const textR = skin.text.r;
    const textG = skin.text.g;
    const textB = skin.text.b;
    const mutedR = skin.textMuted.r;
    const mutedG = skin.textMuted.g;
    const mutedB = skin.textMuted.b;

    const bgMarks = cache.bgMarks;
    const bg0r = bgMarks[0] ?? miss;
    const bg0g = bgMarks[1] ?? miss;
    const bg0b = bgMarks[2] ?? miss;
    const bg1r = bgMarks[3] ?? miss;
    const bg1g = bgMarks[4] ?? miss;
    const bg1b = bgMarks[5] ?? miss;
    const bg2r = bgMarks[6] ?? miss;
    const bg2g = bgMarks[7] ?? miss;
    const bg2b = bgMarks[8] ?? miss;
    const bg3r = bgMarks[9] ?? miss;
    const bg3g = bgMarks[10] ?? miss;
    const bg3b = bgMarks[11] ?? miss;

    const palette = cache.palette;
    const paletteCount = cache.paletteCount;

    if (useFg && useBg) {
      applyBoth(
        buffer,
        palette,
        paletteCount,
        fgStep,
        fgRow,
        fgShift,
        bgStep,
        bgRow,
        bgShift,
        cfg.glow,
        textR,
        textG,
        textB,
        mutedR,
        mutedG,
        mutedB,
        bg0r,
        bg0g,
        bg0b,
        bg1r,
        bg1g,
        bg1b,
        bg2r,
        bg2g,
        bg2b,
        bg3r,
        bg3g,
        bg3b,
      );
      return;
    }

    if (useFg) {
      applyFgOnly(
        buffer,
        palette,
        paletteCount,
        fgStep,
        fgRow,
        fgShift,
        textR,
        textG,
        textB,
        mutedR,
        mutedG,
        mutedB,
      );
      return;
    }

    applyBgOnly(
      buffer,
      palette,
      paletteCount,
      bgStep,
      bgRow,
      bgShift,
      cfg.glow,
      bg0r,
      bg0g,
      bg0b,
      bg1r,
      bg1g,
      bg1b,
      bg2r,
      bg2g,
      bg2b,
      bg3r,
      bg3g,
      bg3b,
    );
  };
};
