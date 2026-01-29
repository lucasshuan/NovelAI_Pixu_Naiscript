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
    return `${entry.storyId}:${entry.sectionId}:${entry.order + 1}`;
  }

  function getMoveInfo(
    sections: { sectionId: number }[],
    sectionId: number,
  ): {
    canMoveUp: boolean;
    canMoveDown: boolean;
    prevSectionId: number | null;
    nextSectionId: number | null;
  } {
    const index = sections.findIndex((section) => section.sectionId === sectionId);
    if (index === -1) {
      return {
        canMoveUp: false,
        canMoveDown: false,
        prevSectionId: null,
        nextSectionId: null,
      };
    }

    const prevSectionId = index > 0 ? sections[index - 1].sectionId : null;
    const nextSectionId =
      index < sections.length - 1 ? sections[index + 1].sectionId : null;

    return {
      canMoveUp: prevSectionId !== null,
      canMoveDown: nextSectionId !== null,
      prevSectionId,
      nextSectionId,
    };
  }

  async function createWidget(
    entry: Entry,
    sections?: { sectionId: number }[],
  ): Promise<void> {
    const docSections = sections ?? (await api.v1.document.scan());
    const moveInfo = getMoveInfo(docSections, entry.sectionId);

    const handle = await api.v1.editor.decorations.createWidget({
      type: "node",
      sectionId: entry.sectionId,
      side: "after",
      content: buildWidgetContent(
        entry,
        entryLabel(entry),
        removeEntry,
        moveEntry,
        moveInfo.canMoveUp,
        moveInfo.canMoveDown,
      ),
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
    const sections = await api.v1.document.scan();

    for (const [entryId, handle] of widgetHandles) {
      if (!entryIds.has(entryId)) {
        await handle.dispose();
        widgetHandles.delete(entryId);
      }
    }

    for (const entry of entries) {
      if (!widgetHandles.has(entry.id)) {
        await createWidget(entry, sections);
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
    const storyId = await api.v1.story.id();

    const inSection = entries.filter((e) => e.sectionId === sectionId);
    const nextOrder = inSection.length
      ? Math.max(...inSection.map((e) => e.order)) + 1
      : 0;

    const next: Entry = { id: uid(), storyId, sectionId, order: nextOrder };

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

  async function moveEntry(
    entryId: string,
    direction: "up" | "down",
  ): Promise<void> {
    await ensurePerms();

    const entries = await getEntries();
    const entry = entries.find((candidate) => candidate.id === entryId);
    if (!entry) return;

    const sections = await api.v1.document.scan();
    const moveInfo = getMoveInfo(sections, entry.sectionId);
    const targetSectionId =
      direction === "up" ? moveInfo.prevSectionId : moveInfo.nextSectionId;

    if (targetSectionId === null) return;

    const inTarget = entries.filter((e) => e.sectionId === targetSectionId);
    const nextOrder = inTarget.length
      ? Math.max(...inTarget.map((e) => e.order)) + 1
      : 0;

    const updatedEntry: Entry = {
      ...entry,
      sectionId: targetSectionId,
      order: nextOrder,
    };

    const nextEntries = entries.map((e) =>
      e.id === entryId ? updatedEntry : e,
    );

    await setEntries(nextEntries);

    const handle = widgetHandles.get(entryId);
    if (handle) {
      await handle.dispose();
      widgetHandles.delete(entryId);
    }
    await createWidget(updatedEntry, sections);
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
