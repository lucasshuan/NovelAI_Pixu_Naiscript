import { PANEL_ID } from "./config";
import { stableSlotKey } from "./storage";
import type { Entry } from "./types";

type RemoveEntryHandler = (entryId: string) => Promise<void>;
type MoveEntryHandler = (entryId: string, direction: "up" | "down") => Promise<void>;

export function buildWidgetContent(
  entry: Entry,
  label: string,
  onRemove: RemoveEntryHandler,
  onMove: MoveEntryHandler,
  canMoveUp: boolean,
  canMoveDown: boolean,
): UIPart[] {
  const buttonStyle = {
    backgroundColor: "bg2",
    height: 24,
    width: 24,
    padding: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };

  const headerRow = api.v1.ui.part.row({
    spacing: "space-between",
    content: [
      api.v1.ui.part.text({
        text: label,
        style: { color: "textMain", opacity: 0.2, fontSize: 9, wordBreak: "break-word", },
      }),
      api.v1.ui.part.row({
        spacing: "center",
        content: [
          api.v1.ui.part.button({
            iconId: "arrow-up",
            style: buttonStyle,
            disabled: !canMoveUp,
            disabledWhileCallbackRunning: true,
            callback: async () => {
              await onMove(entry.id, "up");
            },
          }),
          api.v1.ui.part.button({
            iconId: "arrow-down",
            style: buttonStyle,
            disabled: !canMoveDown,
            disabledWhileCallbackRunning: true,
            callback: async () => {
              await onMove(entry.id, "down");
            },
          }),
          api.v1.ui.part.button({
            iconId: "x",
            style: buttonStyle,
            callback: async () => {
              await onRemove(entry.id);
            },
          }),
        ],
      }),
    ],
  });

  const slotKey = stableSlotKey(entry);

  const imageContainer = api.v1.ui.part.image({
    src: "",
    height: 340,
    style: { display: "none", objectFit: "contain", borderRadius: "10px", border: "2px dashed textHeadings" },
    id: `cg-img-${slotKey}`,
    alt: `Image #${slotKey}`,
  });

  const extensionWarning = api.v1.ui.part.box({
    id: `cg-warning=${slotKey}`,
    style: {
      borderRadius: 6,
      padding: "0px 6px",
      width: 340,
      backgroundColor: "rgba(255, 0, 0, 0.1)",
      border: "1px solid rgba(255, 0, 0, 0.4)",
    },
    content: [
      api.v1.ui.part.text({
        text: "Images won’t appear until the extension is installed. Download the extension:\nhttps://github.com/lucasshuan/NovelAI_Pixu_Extension/releases",
        style: { color: "warning", fontSize: 10 },
      }),
    ],
  });

  return [
    api.v1.ui.part.box({
      style: { borderRadius: 10, padding: "6px 6px" },
      content: [
        api.v1.ui.part.column({
          spacing: "center",
          content: [headerRow, extensionWarning, imageContainer],
        }),
      ],
    }),
  ];
}

export async function renderPanel(opts: {
  onAddImageSlot: () => Promise<void>;
  onClearAll: () => Promise<void>;
}): Promise<void> {
  await api.v1.ui.register([
    api.v1.ui.extension.scriptPanel({
      id: PANEL_ID,
      name: "Image Slots",
      iconId: "image",
      content: [
        api.v1.ui.part.column({
          content: [
            api.v1.ui.part.row({
              wrap: true,
              spacing: "center",
              content: [
                api.v1.ui.part.button({
                  text: "Add Image Slot",
                  iconId: "plus",
                  callback: opts.onAddImageSlot,
                }),
                api.v1.ui.part.button({
                  text: "Clear All Image Slots",
                  iconId: "trash",
                  callback: opts.onClearAll,
                  style: { color: "warning" },
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ]);
}
