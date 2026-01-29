import { ensurePerms, registerHooks } from "./hooks";
import { getEntries, setEntries } from "./storage";
import { buildWidgetContent, renderPanel } from "./ui";
import type { Entry } from "./types";

export async function run(): Promise<void> {
  const widgetHandles = new Map<
    string,
    DecorationWidgetHandle<DecorationCreateNodeWidgetOptions>
  >();

  function uid(): string {
    return Math.random().toString(36).slice(2, 10);
  }

  function entryLabel(entry: Entry): string {
    return `Image Slot ${entry.sectionId}:${entry.order + 1}`;
  }

  async function createWidget(entry: Entry): Promise<void> {
    const handle = await api.v1.editor.decorations.createWidget({
      type: "node",
      sectionId: entry.sectionId,
      side: "after",
      content: buildWidgetContent(entry, entryLabel(entry), removeEntry),
      onChange: (event) => {
        if (event.type === "dispose") {
          widgetHandles.delete(entry.id);
        }
      },
    } as DecorationCreateNodeWidgetOptions);

    widgetHandles.set(entry.id, handle);
  }

  async function syncWidgets(): Promise<void> {
    const entries = await getEntries();
    const entryIds = new Set(entries.map((entry) => entry.id));

    for (const [entryId, handle] of widgetHandles) {
      if (!entryIds.has(entryId)) {
        await handle.dispose();
        widgetHandles.delete(entryId);
      }
    }

    for (const entry of entries) {
      if (!widgetHandles.has(entry.id)) {
        await createWidget(entry);
      }
    }
  }

  async function addImageHere(): Promise<void> {
    await ensurePerms();

    const selection = await api.v1.editor.selection.get();
    const sectionId: number | undefined = selection?.from?.sectionId;

    if (sectionId === undefined || sectionId === null) {
      api.v1.ui.toast(
        "Couldn't detect the current section. Click inside the story text first.",
      );
      return;
    }

    const entries = await getEntries();

    const inSection = entries.filter((e) => e.sectionId === sectionId);
    const nextOrder = inSection.length
      ? Math.max(...inSection.map((e) => e.order)) + 1
      : 0;

    const next: Entry = { id: uid(), sectionId, order: nextOrder };

    await setEntries([...entries, next]);

    await createWidget(next);
  }

  async function clearEntries(): Promise<void> {
    await ensurePerms();
    await setEntries([]);
    for (const handle of widgetHandles.values()) {
      await handle.dispose();
    }
    widgetHandles.clear();
    api.v1.ui.toast("Cleared saved image slots for this story.");
  }

  async function removeEntry(entryId: string): Promise<void> {
    await ensurePerms();
    const entries = await getEntries();
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;

    const nextEntries = entries.filter((e) => e.id !== entryId);
    await setEntries(nextEntries);

    const handle = widgetHandles.get(entryId);
    if (handle) {
      await handle.dispose();
      widgetHandles.delete(entryId);
    }
  }

  registerHooks(async () => {
    await ensurePerms();
    api.v1.editor.decorations.clearWidgets();
    widgetHandles.clear();
    await syncWidgets();
  });

  await renderPanel({
    onAddImageSlot: addImageHere,
    onClearAll: clearEntries,
  });
}
