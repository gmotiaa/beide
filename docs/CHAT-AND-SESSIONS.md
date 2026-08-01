# Chat transcript & sessions

The transcript is the most fragile part of the app: it is produced by streaming
events, held in renderer memory, and persisted by two writers. Read this before
touching `src/stores/chat.ts`, `src/stores/agent.ts` or
`electron/services/sessions.ts`.

## Who owns what

| Layer | Holds | Writes |
| --- | --- | --- |
| `useChatStore.messages` | the **only live copy** of the conversation | `session:save` (full replace) |
| `SessionService` (main) | `{ info, messages }` per file, plus `activeId` | `appendMessages` on prompt, `replaceMessages` on save |

Both writers can create a session file. That is why the renderer asks main
first (`session:active`) before minting a new one — see *Invariants* below.

File layout, `<workspace>/.beide/sessions/<id>.json`:

```jsonc
{
  "info": { "id": "sess_…", "title": "…", "createdAt": 0, "updatedAt": 0, "mode": "agent" },
  "messages": [ /* ChatMessage[] — see src/lib/types.ts */ ]
}
```

`title` is auto-derived from the first user message while it is still
`"New chat"`. Writes are atomic (`tmp` file + `rename`).

## Turn lifecycle

```
user hits send
  └─ useChatStore.appendUserMessage()          (renderer row appears immediately)
  └─ window.beide.agent.prompt(payload)
        └─ main: sessions.appendMessages([user]) → ensureActive() may CREATE the session
        └─ main: pi session.prompt(...)
             └─ agent:event stream ──► useAgentStore.handleEvent
                   ├─ thinking deltas  → tool row `thinking`
                   ├─ tool start/end   → upsertToolMessage() (keyed by toolCallId)
                   ├─ text deltas      → appendAssistantDelta()
                   └─ agent_end        → close stuck tools, finalizeAssistant(), refreshStatus()
  └─ persistSession() debounced 600 ms → session:save (full transcript)
```

`upsertToolMessage` matches on the exact `toolCallId`. Do not add a
match-by-name fallback: concurrent tools of the same name would merge into one
card.

`ensureAssistantStreaming` walks backwards; if the newest rows are tools it
starts a **new** assistant bubble after them, so post-tool narration does not
rewrite the text written before the tools ran.

## Invariants (each one exists because it broke once)

1. **One session file per conversation.** The renderer calls
   `adoptOrCreateSession()`, which prefers `session:active` over
   `session:new`. Before that, main created a session for the prompt and the
   renderer created a second one for the reply — the transcript was split in
   two, one file holding the question and another holding the answer.
2. **Saves carry an explicit snapshot.** `saveSnapshot(api, id, messages)`
   takes the messages by value. `persistSession(true)` reads the store on a
   later microtask, so a caller that clears the store right after asking for a
   flush (`newSession`) used to persist an empty transcript.
3. **A queued save must not land in the next conversation.** `transcriptEpoch`
   is bumped whenever the transcript is replaced; a save whose epoch is stale
   is dropped.
4. **The transcript survives a renderer reload.** `ChatPanel` calls
   `restoreActiveSession()` on mount: it reads `session:active`, loads that
   file, marks restored rows as settled (`streaming: false`,
   `toolStatus: "running"` → `"done"`) and puts the history **in front of**
   whatever is already in the store, de-duplicated by message id. Without it, a
   dev HMR reload (or a crash) mid-stream wiped the prompt and the tool cards,
   and the rest of the answer opened a fresh orphan session — the answer looked
   truncated and the actions were gone.
5. **Images are stripped before saving — by both writers.** The renderer's
   `compactForSave` and main's `SessionService` (`compactImages` in
   `appendMessages`/`replaceMessages`) drop base64 blobs over 2 000 chars.
   Keeping them blew past `sessionMessageChars` on the renderer path, and on
   the main path a few photo-sized images pushed the file past
   `MAX_SESSION_FILE_CHARS`, making the session permanently unreadable.

## Cloud backup

`saveSnapshot` (in `src/stores/chat.ts`) writes the local file first, then
fires a cloud write-through: `upsertCloudSession()` against
`public.chat_sessions`, by value from the same `compacted` array already
saved locally, and fire-and-forget (errors are swallowed — the local file
stays the source of truth when offline). It runs strictly after the local
`api.session.save()` and never reads the store, so it cannot interact with
invariants 2–3 above (no stale-epoch or empty-snapshot risk from the backup
path itself). Restoring a cloud-only chat (fresh machine, wiped `.beide`)
goes through `session:import`, which writes the file wholesale into
`.beide/sessions/` — see `ChatHistory.tsx`'s "From the cloud" section and
[KNOWN-GAPS.md](KNOWN-GAPS.md) for the account-level picture.

## Restoring vs. loading

* `restoreActiveSession()` — silent, on mount, merges with live rows. Never
  clears anything.
* `loadSession(id)` — user picked a chat in `ChatHistory`: flushes the current
  transcript first, then replaces it wholesale and bumps the epoch.
* `newSession()` — pins the outgoing transcript, saves it, then creates a fresh
  file (deliberately **not** `adoptOrCreateSession`, which would reuse the
  session main still points at).

## Testing a change here

There is no automated coverage of the store. Verify by driving the running app
(see [DEVELOPMENT.md](DEVELOPMENT.md#driving-the-running-app-cdp)) and checking:

* a full turn renders: user row, thinking, tool cards, answer;
* reloading the renderer mid-stream keeps all of the above and the same
  `sessionId`;
* `<workspace>/.beide/sessions/` gains exactly one file per conversation;
* switching to a new chat leaves the previous transcript complete on disk.
