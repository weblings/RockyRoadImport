# Releasing a version

Status: evergreen reference, not a plan
Id: releasing

How a version bump is made here. Merging to `dev` or `main` never deploys the demo; only
`npm run deploy` (build:demo, then gh-pages) does.

## Checklist

1. Bump with `npm version <x.y.z> --no-git-tag-version` in `SongConverter/`; it updates `package.json`
   and `package-lock.json`. `src/version.ts` reads `package.json`, so `GeneratedBy` follows.
2. Add the entry to the top of `CHANGELOG.txt` (guidance below), as its own commit before the version commit.
3. Run `npm run lint`, `npx tsc --noEmit`, `npx vitest run` and `npx playwright test` in `SongConverter/`.
4. Merge, then tag `v<x.y.z>` on the commit that bumped the version, once it is on `main`.

## Changelog entries

Entries are for someone deciding whether to upgrade, not a record of what was built.

- One line per change, no parentheticals or mechanism; about four bullets a release. Merge related
  changes into one bullet (error copy, inline warnings and download errors are one "Errors" line).
- Prefix each line with its kind: `Dev -` for internal work, `Errors -`, `Fix -`; unprefixed lines are new features.
- Leave out housekeeping with no effect on use: audit overrides, dev-only tools (the error-state
  walkthrough), and test or doc changes beyond one `Dev -` line.
- Don't promise what the commits only imply. Claim accessibility or behavior only when it was checked.
