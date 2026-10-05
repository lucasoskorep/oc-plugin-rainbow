import { describe, expect, it } from "bun:test";
import { OptimizedBuffer, RGBA } from "@opentui/core";
import plugin, { toRainbowTheme } from "../tui";
import { createRainbowPostProcess } from "../rainbow-post-process";

describe("oc-plugin-rainbow", () => {
  it("resolves rainbow theme from V2 theme tokens", () => {
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
    expect(darkTheme.primary.r).toBeCloseTo(RGBA.fromHex("#5b8cff").r);
    expect(darkTheme.accent.r).toBeCloseTo(RGBA.fromHex("#ff79c6").r);
    expect(darkTheme.secondary.r).toBeCloseTo(RGBA.fromHex("#50fa7b").r);

    const lightTheme = toRainbowTheme(v2Theme, "light");
    expect(lightTheme.primary.r).toBeCloseTo(RGBA.fromHex("#142c6c").r);
    expect(lightTheme.accent.r).toBeCloseTo(RGBA.fromHex("#611645").r);
  });

  it("applies rainbow post-processing to OptimizedBuffer with Uint16Array", () => {
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
    const initialFg = Array.from(buf.buffers.fg.slice(0, 4));
    expect(initialFg).toEqual([235, 238, 245, 255]);

    process(buf, 16);
    const postFg = Array.from(buf.buffers.fg.slice(0, 4));
    expect(postFg).not.toEqual(initialFg);
  });

  it("registers commands, routes, and cleans up on dispose", () => {
    let registeredCommands: any[] = [];
    let registeredRoutes: any[] = [];
    let postProcessFns: any[] = [];

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
          return () => {};
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
          navigate: () => {},
          current: () => ({ type: "home" }),
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

    expect(postProcessFns.length).toBe(2);
    expect(registeredRoutes.map((r) => r.name)).toContain("logo");
    expect(registeredCommands.map((c) => c.id)).toContain("tui-rainbow.logo-splash");
    expect(registeredCommands.map((c) => c.id)).toContain("tui-rainbow.settings");

    if (typeof cleanup === "function") {
      cleanup();
    }

    expect(postProcessFns.length).toBe(0);
    expect(registeredRoutes.length).toBe(0);
  });
});
