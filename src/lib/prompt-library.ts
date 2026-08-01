import { getBeide } from "./ipc";

export type PromptTemplate = {
  /** Filename without the .md extension — what the "/" menu lists. */
  name: string;
  /** Full markdown body — replaces the draft when picked. */
  content: string;
};

/**
 * The workspace prompt library: every `*.md` file under `.beide/prompts`,
 * read through the workspace bridge (paths are workspace-relative). A missing
 * directory, a closed workspace or an unreadable file all degrade to "no
 * prompts" — the composer shows a hint row instead of an error.
 */
export async function loadPromptLibrary(): Promise<PromptTemplate[]> {
  const api = getBeide();
  if (!api) return [];
  try {
    const entries = await api.workspace.readDir(".beide/prompts");
    const files = entries.filter(
      (entry) => entry.type === "file" && /\.md$/i.test(entry.name),
    );
    const prompts = await Promise.all(
      files.map(async (file) => {
        try {
          const content = await api.workspace.readFile(file.path);
          return { name: file.name.replace(/\.md$/i, ""), content };
        } catch {
          return null;
        }
      }),
    );
    return prompts.filter(
      (prompt): prompt is PromptTemplate =>
        prompt !== null && prompt.content.trim().length > 0,
    );
  } catch {
    return [];
  }
}
