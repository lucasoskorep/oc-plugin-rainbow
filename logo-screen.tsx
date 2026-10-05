/** @jsxImportSource @opentui/solid */
import { RGBA, TextAttributes } from "@opentui/core";
import { For, createMemo, type JSX } from "solid-js";
import { useKeyboard } from "@opentui/solid";
import type { RainbowColor, RainbowTheme } from "./rainbow-post-process";

const logo = {
  left: [
    "                   ",
    "█▀▀█ █▀▀█ █▀▀█ █▀▀▄",
    "█__█ █__█ █^^^ █__█",
    "▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀~~▀",
  ],
  right: [
    "             ▄     ",
    "█▀▀▀ █▀▀█ █▀▀█ █▀▀█",
    "█___ █__█ █__█ █^^^",
    "▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀",
  ],
};
const marks = "_^~";
const shadowMarker = new RegExp(`[${marks}]`);

const toRgba = (color: RainbowColor): RGBA => {
  if (color instanceof RGBA) return color;
  return RGBA.fromValues(color.r, color.g, color.b, color.a);
};

const tint = (a: RGBA, b: RGBA, amt: number) => {
  return RGBA.fromValues(
    a.r + (b.r - a.r) * amt,
    a.g + (b.g - a.g) * amt,
    a.b + (b.b - a.b) * amt,
    a.a + (b.a - a.a) * amt,
  );
};

const renderLine = (line: string, fg: RGBA, background: RGBA, bold: boolean): JSX.Element[] => {
  const shadow = tint(background, fg, 0.25);
  const attrs = bold ? TextAttributes.BOLD : undefined;
  const elements: JSX.Element[] = [];
  let i = 0;

  while (i < line.length) {
    const rest = line.slice(i);
    const markerIndex = rest.search(shadowMarker);

    if (markerIndex === -1) {
      elements.push(
        <text fg={fg} attributes={attrs} selectable={false}>
          {rest}
        </text>,
      );
      break;
    }

    if (markerIndex > 0) {
      elements.push(
        <text fg={fg} attributes={attrs} selectable={false}>
          {rest.slice(0, markerIndex)}
        </text>,
      );
    }

    switch (rest[markerIndex]) {
      case "_":
        elements.push(
          <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
            {" "}
          </text>,
        );
        break;
      case "^":
        elements.push(
          <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
            ▀
          </text>,
        );
        break;
      case "~":
        elements.push(
          <text fg={shadow} attributes={attrs} selectable={false}>
            ▀
          </text>,
        );
        break;
    }

    i += markerIndex + 1;
  }

  return elements;
};

export function LogoScreen(props: { theme: () => RainbowTheme; onExit: () => void }) {
  const theme = createMemo(() => props.theme());

  useKeyboard((evt) => {
    if (evt.name !== "escape") return;
    evt.preventDefault();
    evt.stopPropagation();
    props.onExit();
  });

  return (
    <box width="100%" height="100%" flexDirection="column" alignItems="center">
      <box flexGrow={1} minHeight={0} />
      <box flexShrink={0}>
        <For each={logo.left}>
          {(line, index) => {
            const bg = () => toRgba(theme().background);
            const muted = () => toRgba(theme().textMuted);
            const text = () => toRgba(theme().text);
            return (
              <box flexDirection="row" gap={1}>
                <box flexDirection="row">{renderLine(line, muted(), bg(), false)}</box>
                <box flexDirection="row">
                  {renderLine(logo.right[index()] ?? "", text(), bg(), true)}
                </box>
              </box>
            );
          }}
        </For>
      </box>
      <box height={3} minHeight={0} flexShrink={0} />
      <box flexGrow={1} minHeight={0} />
    </box>
  );
}
