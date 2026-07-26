// Bundle-size stub for `shiki`, wired in via the `paths` mapping in
// .design-sync/tsconfig.ds.json (build-time only — the app itself never sees it).
//
// Only the *bundle registries* are replaced. Everything else — the highlighter
// core, both regex engines, the shorthands — is the real shiki, re-exported
// unchanged, so `createHighlighter` behaves exactly as it does in the app.
//
// Why: shiki's full bundle registers every grammar (`@shikijs/langs`, 7.4 MB)
// and every theme (`@shikijs/themes`, 1.3 MB) as inline lazy loaders. esbuild
// inlines all of them, which alone put `_ds_bundle.js` 2.4 MB over the 12 MB
// upload ceiling. `@pierre/diffs` (the diff viewer behind EditTool / WriteTool /
// the file-diff cards) reaches them through `bundledLanguages`, and it is the
// only path in the library that does.
//
// The registries below carry the languages an IDE design actually shows in a
// diff, and the two themes the app requests by name (`github-light` /
// `github-dark`, see src/components/agent-elements/tools/edit-tool.tsx). A file
// in a language outside this list renders in the diff viewer as plain,
// uncoloured text — the same tradeoff already taken for Markdown code fences in
// .design-sync/stubs/streamdown-code.ts. Layout, gutters, +/- shading and every
// other diff affordance are untouched.

import {
  createBundledHighlighter,
  createSingletonShorthands,
  guessEmbeddedLanguages,
} from "@shikijs/core";
import { createJavaScriptRegexEngine, defaultJavaScriptRegexConstructor } from "@shikijs/engine-javascript";
import { createOnigurumaEngine, loadWasm } from "@shikijs/engine-oniguruma";

export * from "@shikijs/core";
export { createJavaScriptRegexEngine, defaultJavaScriptRegexConstructor, createOnigurumaEngine, loadWasm };

type Loader = () => Promise<{ default: unknown }>;
type LangInfo = { id: string; name: string; aliases?: string[]; import: Loader };
type ThemeInfo = { id: string; displayName: string; type: "light" | "dark"; import: Loader };

export const bundledLanguagesInfo: LangInfo[] = [
  { id: "c", name: "C", import: () => import("@shikijs/langs/c") },
  { id: "csharp", name: "C#", aliases: ["c#", "cs"], import: () => import("@shikijs/langs/csharp") },
  { id: "css", name: "CSS", import: () => import("@shikijs/langs/css") },
  { id: "diff", name: "Diff", import: () => import("@shikijs/langs/diff") },
  { id: "docker", name: "Dockerfile", aliases: ["dockerfile"], import: () => import("@shikijs/langs/docker") },
  { id: "go", name: "Go", import: () => import("@shikijs/langs/go") },
  { id: "graphql", name: "GraphQL", aliases: ["gql"], import: () => import("@shikijs/langs/graphql") },
  { id: "html", name: "HTML", import: () => import("@shikijs/langs/html") },
  { id: "ini", name: "INI", aliases: ["properties"], import: () => import("@shikijs/langs/ini") },
  { id: "java", name: "Java", import: () => import("@shikijs/langs/java") },
  { id: "javascript", name: "JavaScript", aliases: ["js"], import: () => import("@shikijs/langs/javascript") },
  { id: "json", name: "JSON", import: () => import("@shikijs/langs/json") },
  { id: "jsonc", name: "JSON with Comments", import: () => import("@shikijs/langs/jsonc") },
  { id: "jsx", name: "JSX", import: () => import("@shikijs/langs/jsx") },
  { id: "markdown", name: "Markdown", aliases: ["md"], import: () => import("@shikijs/langs/markdown") },
  { id: "python", name: "Python", aliases: ["py"], import: () => import("@shikijs/langs/python") },
  { id: "rust", name: "Rust", aliases: ["rs"], import: () => import("@shikijs/langs/rust") },
  {
    id: "shellscript",
    name: "Shell",
    aliases: ["bash", "sh", "shell", "zsh"],
    import: () => import("@shikijs/langs/shellscript"),
  },
  { id: "sql", name: "SQL", import: () => import("@shikijs/langs/sql") },
  { id: "toml", name: "TOML", import: () => import("@shikijs/langs/toml") },
  { id: "tsx", name: "TSX", import: () => import("@shikijs/langs/tsx") },
  { id: "typescript", name: "TypeScript", aliases: ["ts"], import: () => import("@shikijs/langs/typescript") },
  { id: "xml", name: "XML", import: () => import("@shikijs/langs/xml") },
  { id: "yaml", name: "YAML", aliases: ["yml"], import: () => import("@shikijs/langs/yaml") },
];

export const bundledThemesInfo: ThemeInfo[] = [
  { id: "github-dark", displayName: "GitHub Dark", type: "dark", import: () => import("@shikijs/themes/github-dark") },
  {
    id: "github-dark-default",
    displayName: "GitHub Dark Default",
    type: "dark",
    import: () => import("@shikijs/themes/github-dark-default"),
  },
  {
    id: "github-light",
    displayName: "GitHub Light",
    type: "light",
    import: () => import("@shikijs/themes/github-light"),
  },
  {
    id: "github-light-default",
    displayName: "GitHub Light Default",
    type: "light",
    import: () => import("@shikijs/themes/github-light-default"),
  },
];

// Same construction as shiki's own langs-bundle-full: base ids first, then the
// alias entries pointing at the same loader.
export const bundledLanguagesBase: Record<string, Loader> = Object.fromEntries(
  bundledLanguagesInfo.map((i) => [i.id, i.import]),
);
export const bundledLanguagesAlias: Record<string, Loader> = Object.fromEntries(
  bundledLanguagesInfo.flatMap((i) => i.aliases?.map((a) => [a, i.import]) ?? []),
);
export const bundledLanguages: Record<string, Loader> = {
  ...bundledLanguagesBase,
  ...bundledLanguagesAlias,
};
export const bundledThemes: Record<string, Loader> = Object.fromEntries(
  bundledThemesInfo.map((t) => [t.id, t.import]),
);

// Mirrors shiki/dist/bundle-full.mjs exactly, only with the registries above.
export const createHighlighter = createBundledHighlighter({
  langs: bundledLanguages as never,
  themes: bundledThemes as never,
  engine: () => createOnigurumaEngine(import("shiki/wasm")),
});

export const {
  codeToHtml,
  codeToHast,
  codeToTokens,
  codeToTokensBase,
  codeToTokensWithThemes,
  getSingletonHighlighter,
  getLastGrammarState,
} = createSingletonShorthands(createHighlighter, { guessEmbeddedLanguages });
