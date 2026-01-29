import { KEY_ENTRIES } from "./config";
import type { Entry } from "./types";

export async function getEntries(): Promise<Entry[]> {
  const v = await api.v1.storyStorage.get(KEY_ENTRIES);
  const entries = (v ?? []) as Entry[];
  const missingStoryId = entries.some((entry) => !entry.storyId);
  if (!missingStoryId) return entries;

  const storyId = await api.v1.story.id();
  const updated = entries.map((entry) => ({
    ...entry,
    storyId: entry.storyId ?? storyId,
  }));

  await api.v1.storyStorage.set(KEY_ENTRIES, updated);
  return updated;
}

export async function setEntries(entries: Entry[]): Promise<void> {
  await api.v1.storyStorage.set(KEY_ENTRIES, entries);
}

export function stableSlotKey(entry: Entry): string {
  return `${entry.storyId}:${entry.id}`;
}

function buildSectionIndex(
  sections: { sectionId: number }[],
): Map<number, number> {
  const sectionIndex = new Map<number, number>();
  for (let i = 0; i < sections.length; i++) {
    sectionIndex.set(sections[i].sectionId, i);
  }
  return sectionIndex;
}

export async function getOrderedEntries(entries: Entry[]): Promise<Entry[]> {
  const sections = await api.v1.document.scan();
  const sectionIndex = buildSectionIndex(sections);

  return [...entries].sort((a, b) => {
    const ai = sectionIndex.get(a.sectionId) ?? Number.MAX_SAFE_INTEGER;
    const bi = sectionIndex.get(b.sectionId) ?? Number.MAX_SAFE_INTEGER;
    if (ai !== bi) return ai - bi;
    return a.order - b.order;
  });
}
