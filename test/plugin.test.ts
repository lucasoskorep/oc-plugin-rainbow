import { describe, expect, it } from "bun:test";
import { OptimizedBuffer, RGBA } from "@opentui/core";
import plugin from "../tui";
import { createRainbowPostProcess, toRainbowTheme } from "../rainbow-post-process";

describe("oc-plugin-rainbow", () => {
  it("resolves rainbow theme from V2 theme tokens in dark and light modes", () => {
    const v2Theme = {
      text: {
        base: RGBA.fromHex("#ebeef5"),
        muted: RGBA.fromHex("#8e95a9"),
      },
      background: {
        base: RGBA.fromHex("#12151c"),
        raised: {
          base: RGBA.fromHex("#181c26"),
          high: RGBA.fromHex("#1e222e"),
          max: RGBA.fromHex("#161922"),
        },
      },
      hue: {
        interactive: { 200: RGBA.fromHex("#5b8cff"), 700: RGBA.fromHex("#142c6c") },
        accent: { 200: RGBA.fromHex("#ff79c6"), 700: RGBA.fromHex("#611645") },
      },
      categorical: [{ 200: RGBA.fromHex("#50fa7b"), 700: RGBA.fromHex("#0a501f") }],
    };

    const darkTheme = toRainbowTheme(v2Theme, "dark");
    expect(darkTheme.text.r).toBeCloseTo(RGBA.fromHex("#ebeef5").r);
    expect(darkTheme.background.r).toBeCloseTo(RGBA.fromHex("#12151c").r);
    expect(darkTheme.backgroundElement.r).toBeCloseTo(RGBA.fromHex("#1e222e").r);
    // In OpenCode 2.0, step 200 is the prominent foreground accent color
    expect(darkTheme.primary.r).toBeCloseTo(RGBA.fromHex("#5b8cff").r);
    expect(darkTheme.accent.r).toBeCloseTo(RGBA.fromHex("#ff79c6").r);
    expect(darkTheme.secondary.r).toBeCloseTo(RGBA.fromHex("#50fa7b").r);

    // In light mode, step 200 is also the vivid foreground color (not near-white step 700)
    const lightTheme = toRainbowTheme(v2Theme, "light");
    expect(lightTheme.primary.r).toBeCloseTo(RGBA.fromHex("#5b8cff").r);
    expect(lightTheme.accent.r).toBeCloseTo(RGBA.fromHex("#ff79c6").r);
  });

  it("handles legacy theme objects in toRainbowTheme", () => {
    const legacyTheme = {
      text: RGBA.fromHex("#ffffff"),
      textMuted: RGBA.fromHex("#888888"),
      primary: RGBA.fromHex("#ff0000"),
      accent: RGBA.fromHex("#00ff00"),
      secondary: RGBA.fromHex("#0000ff"),
      background: RGBA.fromHex("#000000"),
      backgroundPanel: RGBA.fromHex("#111111"),
      backgroundElement: RGBA.fromHex("#222222"),
      backgroundMenu: RGBA.fromHex("#333333"),
    };

    const resolved = toRainbowTheme(legacyTheme);
    expect(resolved.primary.r).toBe(1);
    expect(resolved.background.r).toBe(0);
  });

  it("applies rainbow post-processing to OptimizedBuffer with Uint16Array including intent metadata", () => {
    const theme = {
      text: RGBA.fromHex("#ebeef5"),
      textMuted: RGBA.fromHex("#8e95a9"),
      primary: RGBA.fromHex("#5b8cff"),
      accent: RGBA.fromHex("#ff79c6"),
      secondary: RGBA.fromHex("#50fa7b"),
      background: RGBA.fromHex("#12151c"),
      backgroundPanel: RGBA.fromHex("#181c26"),
      backgroundElement: RGBA.fromHex("#1e222e"),
      backgroundMenu: RGBA.fromHex("#161922"),
    };

    const process = createRainbowPostProcess(
      () => theme,
      () => ({
        fg: true,
        bg: true,
        speed: 0.008,
        turns: 3,
        glow: 0.05,
      }),
    );

    const buf = OptimizedBuffer.create(80, 24, "unicode");
    buf.setCell(0, 0, "A", RGBA.fromHex("#ebeef5"), RGBA.fromHex("#12151c"));

    // Cell with high-byte intent/palette slot metadata (0x0700 | 235 = 2027)
    buf.buffers.fg[4] = 235 | (7 << 8);
    buf.buffers.fg[5] = 238;
    buf.buffers.fg[6] = 245;
    buf.buffers.fg[7] = 255;
    buf.buffers.bg[4] = 18;
    buf.buffers.bg[5] = 21;
    buf.buffers.bg[6] = 28;
    buf.buffers.bg[7] = 255;

    process(buf, 16);

    // Standard cell should be recolored
    const postFg0 = Array.from(buf.buffers.fg.slice(0, 4));
    expect(postFg0[0]).not.toBe(235);
    expect(postFg0[3]).toBe(255);

    // Cell with high-byte intent metadata should mask and be recolored to clean RGB
    const postFg1 = Array.from(buf.buffers.fg.slice(4, 8));
    expect(postFg1[0]).not.toBe(235 | (7 << 8));
    expect(postFg1[0]).toBeLessThanOrEqual(255);
    expect(postFg1[3]).toBe(255);
  });

  it("supports Float32Array buffers", () => {
    const theme = {
      text: { r: 1, g: 1, b: 1, a: 1 },
      textMuted: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      primary: { r: 0, g: 0, b: 1, a: 1 },
      accent: { r: 1, g: 0, b: 0, a: 1 },
      secondary: { r: 0, g: 1, b: 0, a: 1 },
      background: { r: 0, g: 0, b: 0, a: 1 },
      backgroundPanel: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
      backgroundElement: { r: 0.2, g: 0.2, b: 0.2, a: 1 },
      backgroundMenu: { r: 0.3, g: 0.3, b: 0.3, a: 1 },
    };

    const process = createRainbowPostProcess(
      () => theme,
      () => ({
        fg: true,
        bg: true,
        speed: 0.008,
        turns: 3,
        glow: 0.05,
      }),
    );

    const floatBuf = {
      width: 10,
      height: 10,
      buffers: {
        char: new Uint32Array(100),
        fg: new Float32Array(400).fill(1),
        bg: new Float32Array(400).fill(0),
      },
    };

    process(floatBuf, 16);
    expect(floatBuf.buffers.fg[0]).not.toBe(1);
  });

  it("supports Float32Array buffers with bg-only mode", () => {
    const theme = {
      text: { r: 1, g: 1, b: 1, a: 1 },
      textMuted: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
      primary: { r: 0, g: 0, b: 1, a: 1 },
      accent: { r: 1, g: 0, b: 0, a: 1 },
      secondary: { r: 0, g: 1, b: 0, a: 1 },
      background: { r: 0, g: 0, b: 0, a: 1 },
      backgroundPanel: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
      backgroundElement: { r: 0.2, g: 0.2, b: 0.2, a: 1 },
      backgroundMenu: { r: 0.3, g: 0.3, b: 0.3, a: 1 },
    };

    const process = createRainbowPostProcess(
      () => theme,
      () => ({
        fg: false,
        bg: true,
        speed: 0.008,
        turns: 3,
        glow: 0.05,
      }),
    );

    const floatBuf = {
      width: 10,
      height: 10,
      buffers: {
        char: new Uint32Array(100),
        fg: new Float32Array(400).fill(0.3),
        bg: new Float32Array(400).fill(0),
      },
    };
    floatBuf.buffers.char[0] = "▀".charCodeAt(0);

    process(floatBuf, 16);
    // Background and upper half-block fg should be blended
    expect(floatBuf.buffers.bg[0]).toBeGreaterThan(0);
    expect(floatBuf.buffers.fg[0]).not.toBe(0.3);
  });

  it("registers commands, routes, and cleans up on dispose", () => {
    let registeredCommands: any[] = [];
    let registeredRoutes: any[] = [];
    let postProcessFns: any[] = [];
    let slotDisposed = false;
    let currentRoute: any = { type: "home" };

    const mockContext = {
      options: { enabled: true },
      renderer: {
        requestRender: () => {},
        requestLive: () => {},
        dropLive: () => {},
        addPostProcessFn: (fn: any) => postProcessFns.push(fn),
        removePostProcessFn: (fn: any) => {
          postProcessFns = postProcessFns.filter((f) => f !== fn);
        },
      },
      theme: {
        text: { base: RGBA.fromHex("#ebeef5"), muted: RGBA.fromHex("#8e95a9") },
        background: {
          base: RGBA.fromHex("#12151c"),
          raised: {
            base: RGBA.fromHex("#181c26"),
            high: RGBA.fromHex("#1e222e"),
            max: RGBA.fromHex("#161922"),
          },
        },
        hue: {
          interactive: { 200: RGBA.fromHex("#5b8cff") },
          accent: { 200: RGBA.fromHex("#ff79c6") },
        },
        categorical: [{ 200: RGBA.fromHex("#50fa7b") }],
      },
      themeMode: "dark",
      ui: {
        slot: (claim: any) => {
          claim.render();
          return () => {
            slotDisposed = true;
          };
        },
        dialog: {
          set: () => {},
          show: () => {},
          clear: () => {},
        },
        router: {
          register: (page: any) => {
            registeredRoutes.push(page);
            return () => {
              registeredRoutes = registeredRoutes.filter((p) => p !== page);
            };
          },
          navigate: (dest: any) => {
            currentRoute = dest;
          },
          current: () => currentRoute,
        },
      },
      keymap: {
        layer: (factory: any) => {
          const layer = factory();
          registeredCommands.push(...(layer.commands || []));
        },
      },
      storage: {
        store: (_key: string, opts: any) => [opts.initial, async () => {}],
      },
    };

    expect(plugin.id).toBe("tui-rainbow");
    const cleanup = plugin.setup(mockContext as any);
    expect(typeof cleanup).toBe("function");

    expect(postProcessFns.length).toBe(2);
    expect(registeredRoutes.map((r) => r.name)).toContain("logo");
    expect(registeredCommands.map((c) => c.id)).toContain("tui-rainbow.logo-splash");
    expect(registeredCommands.map((c) => c.id)).toContain("tui-rainbow.settings");

    if (typeof cleanup === "function") {
      cleanup();
    }

    expect(postProcessFns.length).toBe(0);
    expect(registeredRoutes.length).toBe(0);
    expect(slotDisposed).toBe(true);
  });
});
