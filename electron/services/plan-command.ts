const READONLY_COMMANDS = new Set([
  "ls",
  "dir",
  "cat",
  "type",
  "head",
  "tail",
  "grep",
  "rg",
  "findstr",
  "where",
  "which",
  "pwd",
  "git",
]);

const READONLY_GIT_SUBCOMMANDS = new Set([
  "status",
  "diff",
  "show",
  "log",
  "rev-parse",
  "ls-files",
  "ls-tree",
  "grep",
  "blame",
  "shortlog",
  "describe",
]);

/**
 * Shell syntax is intentionally tiny in Plan mode. Dedicated read/grep/find
 * tools cover everything else without asking a shell to interpret arbitrary
 * text, which is the only reliable way to keep the no-write invariant.
 */
export function validatePlanCommand(command: string): string | null {
  const trimmed = command.trim();
  if (!trimmed) return "Blocked in plan mode: empty command.";

  // Quotes can hide a dangerous flag from a textual check while the shell
  // removes them before invoking the program (`sort \"-o\" file`).
  const canonical = trimmed.replace(/["']/g, "");
  if (/[;&|\r\n]|`|\$\(/.test(canonical)) {
    return "Blocked in plan mode: command chaining or substitution is not allowed.";
  }
  if (/[<>]/.test(canonical)) {
    return "Blocked in plan mode: shell redirection is not allowed.";
  }

  const tokens = canonical.split(/\s+/);
  const firstToken = tokens[0]?.toLowerCase() ?? "";
  const executable = firstToken.replace(/\.exe$/i, "");
  if (!READONLY_COMMANDS.has(executable)) {
    return `Blocked in plan mode: "${firstToken}" is not in the readonly whitelist.`;
  }

  if (executable === "rg" && /(^|\s)(--pre|--hostname-bin)(=|\s|$)/i.test(canonical)) {
    return "Blocked in plan mode: ripgrep option executes another program.";
  }

  if (executable !== "git") return null;

  const subcommand = tokens[1]?.toLowerCase() ?? "";
  const readonlyRemote =
    subcommand === "remote" &&
    tokens.length <= 3 &&
    tokens.slice(2).every((token) => token === "-v" || token === "--verbose");
  if (!READONLY_GIT_SUBCOMMANDS.has(subcommand) && !readonlyRemote) {
    return `Blocked in plan mode: git subcommand "${subcommand || "(missing)"}" is not readonly.`;
  }

  // These options execute helpers, pagers or diff drivers even though the git
  // subcommand itself only reads repository data.
  if (
    /(^|\s)(-c|--config-env|--exec-path|--upload-pack|--receive-pack|--ext-diff|--textconv|--open-files-in-pager|--paginate)(=|\s|$)/i.test(
      canonical,
    ) ||
    /(^|\s)-O\S*/.test(canonical) ||
    /(^|\s)--output(=|\s)/i.test(canonical)
  ) {
    return "Blocked in plan mode: git option may write a file or execute another program.";
  }

  return null;
}
