# CLAUDE.md

Read [AGENTS.md](AGENTS.md) first — it is the entry point for every agent
working in this repo and links the docs under [docs/](docs/).

Session notes specific to Claude Code:

* Answer the user in Russian; keep code, identifiers, filenames and comments in
  English.
* Windows host. The default shell is PowerShell; a Bash tool is also available —
  each needs its own syntax. Paths are `C:\…`.
* Long-running verification (`npm run build`, launching Electron) belongs in a
  background task, not a blocking call.
* Never read, copy or print token values from `~/.pi/agent/auth.json` — key
  names, types and connection booleans only.
* Before editing `src/stores/chat.ts`, read
  [docs/CHAT-AND-SESSIONS.md](docs/CHAT-AND-SESSIONS.md); its invariants are
  regression fixes, not style.
* Finish with `npm run typecheck` and `npm test`, and say plainly what was and
  was not verified.
