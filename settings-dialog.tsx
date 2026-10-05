/** @jsxImportSource @opentui/solid */
import { useKeyboard } from "@opentui/solid";
import { For, createMemo, createSignal } from "solid-js";
import { toRgba, type RainbowTheme } from "./rainbow-post-process";

export type SettingsState = {
  fg: boolean;
  bg: boolean;
  speed: number;
  turns: number;
  glow: number;
};

export type ToggleField = "fg" | "bg";
export type NumberField = "speed" | "turns" | "glow";
export type Field = ToggleField | NumberField;

type RowBase = {
  title: string;
  description: string;
  category: string;
};

type ToggleRow = RowBase & {
  key: ToggleField;
  kind: "toggle";
};

type NumberRow = RowBase & {
  key: NumberField;
  kind: "number";
  step: number;
  min: number;
  max: number;
  digits: number;
};

type Row = ToggleRow | NumberRow;

const rows: Row[] = [
  {
    key: "fg",
    title: "Foreground effect",
    description: "Animate neutral text colors",
    category: "Effects",
    kind: "toggle",
  },
  {
    key: "bg",
    title: "Background effect",
    description: "Animate neutral background surfaces",
    category: "Effects",
    kind: "toggle",
  },
  {
    key: "speed",
    title: "Animation speed",
    description: "Controls how quickly the color band moves",
    category: "Motion",
    kind: "number",
    step: 0.001,
    min: 0,
    max: 0.03,
    digits: 3,
  },
  {
    key: "turns",
    title: "Band count",
    description: "Controls how many diagonal bands span the screen",
    category: "Motion",
    kind: "number",
    step: 0.25,
    min: 0.25,
    max: 8,
    digits: 2,
  },
  {
    key: "glow",
    title: "Background strength",
    description: "Intensity of the background color wash",
    category: "Surface",
    kind: "number",
    step: 0.01,
    min: 0,
    max: 0.15,
    digits: 2,
  },
];

export const settingByField = Object.fromEntries(rows.map((item) => [item.key, item])) as {
  [K in ToggleField]: ToggleRow;
} & {
  [K in NumberField]: NumberRow;
};

const status = (value: boolean) => {
  return value ? "ON" : "OFF";
};

const metric = (value: SettingsState, key: NumberField) => {
  return value[key].toFixed(settingByField[key].digits ?? 0);
};

export const SettingsDialog = (props: {
  theme: () => RainbowTheme;
  value: () => SettingsState;
  flip: (key: ToggleField) => void;
  tune: (key: NumberField, dir: -1 | 1) => void;
  onClose: () => void;
}) => {
  const [curIndex, setCurIndex] = createSignal(0);
  const theme = createMemo(() => props.theme());
  const current = createMemo(() => rows[curIndex()] ?? rows[0]!);

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault();
      evt.stopPropagation();
      props.onClose();
      return;
    }

    if (evt.name === "up" || evt.name === "k") {
      evt.preventDefault();
      evt.stopPropagation();
      setCurIndex((prev) => (prev > 0 ? prev - 1 : rows.length - 1));
      return;
    }

    if (evt.name === "down" || evt.name === "j") {
      evt.preventDefault();
      evt.stopPropagation();
      setCurIndex((prev) => (prev < rows.length - 1 ? prev + 1 : 0));
      return;
    }

    const item = current();
    if (!item) return;

    if (evt.name === "space" || evt.name === "return") {
      if (item.kind === "toggle") {
        evt.preventDefault();
        evt.stopPropagation();
        props.flip(item.key);
        return;
      }
    }

    if (evt.name !== "left" && evt.name !== "right") return;
    evt.preventDefault();
    evt.stopPropagation();
    if (item.kind === "toggle") {
      props.flip(item.key);
      return;
    }
    props.tune(item.key, evt.name === "left" ? -1 : 1);
  });

  return (
    <box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={toRgba(theme().text)}>
          <b>Rainbow settings</b>
        </text>
        <text fg={toRgba(theme().textMuted)}>esc to close</text>
      </box>
      <box flexDirection="column">
        <For each={rows}>
          {(item, index) => {
            const isSelected = () => index() === curIndex();
            const footer = () =>
              item.kind === "toggle"
                ? status(props.value()[item.key])
                : metric(props.value(), item.key);
            return (
              <box
                flexDirection="row"
                justifyContent="space-between"
                paddingLeft={1}
                paddingRight={1}
                backgroundColor={isSelected() ? toRgba(theme().backgroundElement) : undefined}
              >
                <box flexDirection="row" gap={1}>
                  <text fg={toRgba(isSelected() ? theme().primary : theme().textMuted)}>
                    {isSelected() ? ">" : " "}
                  </text>
                  <text fg={toRgba(isSelected() ? theme().text : theme().textMuted)}>
                    <b>{item.title}</b>
                  </text>
                  <text fg={toRgba(theme().textMuted)}>- {item.description}</text>
                </box>
                <text fg={toRgba(isSelected() ? theme().primary : theme().text)}>
                  <b>{footer()}</b>
                </text>
              </box>
            );
          }}
        </For>
      </box>
      <box flexDirection="row" gap={3} marginTop={1} paddingTop={1} flexShrink={0}>
        <text>
          <span style={{ fg: toRgba(theme().text) }}>
            <b>navigate</b>{" "}
          </span>
          <span style={{ fg: toRgba(theme().textMuted) }}>up/down</span>
        </text>
        <text>
          <span style={{ fg: toRgba(theme().text) }}>
            <b>toggle</b>{" "}
          </span>
          <span style={{ fg: toRgba(theme().textMuted) }}>space enter left/right</span>
        </text>
        <text>
          <span style={{ fg: toRgba(theme().text) }}>
            <b>adjust</b>{" "}
          </span>
          <span style={{ fg: toRgba(theme().textMuted) }}>left/right</span>
        </text>
      </box>
    </box>
  );
};
