# Error and status copy audit, unified in messages.ts (2026-11-01)

Id: error-copy-audit

Closed RockyRoadImport-jmf. Modelled on Aurora's shell error-copy audit: one voice rule, one shared
module, a source-scan test so the copy can't drift back.

## Found

- Four parse-failure shapes (`Error parsing X file`, `Conversion error`, `Download failed`, `Failed to load`/`Could not read`), and ".psarc file" the only file kind named by extension.
- `part(s)`/`note(s)`/`track(s)` plural hacks, `1/2 part(s)`, and "wasm module" shown to users.
- Skipped-instrument line duplicated in the GP and MusicXML stores; empty states mostly had no next step.
- Raw `err.message` passed through, blank for an empty message.
- `Hand Fallback Used` was the only Title Case string.

## Done

- `src/messages.ts` holds the copy: failures read `Couldn't <verb> the <thing>: <reason>.`, blank reasons become "unknown error", real pluralization, file kinds named consistently (PSARC file).
- Total conversion failure now lists the per-arrangement reasons; empty states name a likely cause.
- `messages.test.ts` bans the old phrasings in stores, panels and App.
- `Program.cs` reason is now "SNG data unreadable" (it is shown inside the failure list); README troubleshooting heading updated to match.
- `errorMessage()` in `fileIo.ts` removed; `messages.ts` owns reason formatting.
