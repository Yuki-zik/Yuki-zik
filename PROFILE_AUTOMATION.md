# Profile automation

## What refreshes

| Component | Workflow | Schedule (UTC) | Published files |
| --- | --- | --- | --- |
| Rolling activity report + local activity card | `yearly-report.yml` | Monday 02:15; also relevant code changes on main | `assets/github-annual-report.{png,svg,json}`, `assets/github-activity-summary.svg`, README refresh timestamp |
| Five summary cards | `profile-summary-cards.yml` | Daily 00:23; also relevant code changes on main | `profile-summary-card-output/buefy/` |
| Contribution snake | `snake.yml` | Existing daily workflow and pushes | `output` branch |

The two main-branch writers use the same concurrency group. The snake writes a separate branch. Asset commits stage files before checking the diff, so newly generated files are included. Push races are retried with a non-forced rebase; conflicts fail visibly.

## Credentials

No secrets belong in source files, screenshots or chat.

- `GITHUB_TOKEN` is supplied by Actions. Workflows explicitly request `contents: write` to publish generated files.
- `GH_STATS_TOKEN` is optional. When set, it is used for report data reads; otherwise the workflow uses its built-in token. An expired or invalid custom token must be replaced or removed in repository Actions secrets; a missing custom token no longer prevents a public-data report.
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` are optional and their existing values are preserved. Missing keys or failed AI requests use the existing deterministic summary. `no_ai=true` disables AI for one manual run.
- Never widen token access just to make public statistics appear larger. Private repository names, descriptions, URLs and per-repository language data are filtered before rendering and before AI summarization.

## Dates and statistics

The default window is the last 365 calendar dates in `Asia/Shanghai`, including today. A manual `year` input selects that calendar year; the current year stops at today, and future years are rejected. The JSON records the exact date range and generation time.

The contribution calendar reflects GitHub's contribution rules and the configured token's visibility. It is not a count of all work or every commit. Private activity depends on token access and the account's contribution-visibility settings. Public Issue/PR totals use `author:USERNAME is:public created:START..END`; they do not include items merely commented on or updated later. Repository language rankings use current repository code bytes, not the author's personal code output. Summary cards have independent scopes and can legitimately differ from the rolling report.

## Verification and failure behavior

1. `npm ci` installs the lockfile versions.
2. Existing tests (`npm run test:all`) and `node --test scripts/year-report/__tests__/reliability.node.mjs` run before report generation.
3. Chromium and CJK fonts are installed. The renderer waits for fonts/images with a bounded timeout and disables screenshot animations.
4. PNG signature/dimensions, JSON render mode and SVG XML are checked before publishing. Summary cards are validated before their single commit; no regex rewriting of SVG is used.
5. Failed rendering raises an error and never substitutes a solid-color image. Existing published files remain unchanged because the commit step does not run on failure.

The legacy `writeFallbackPng` export remains exclusively for offline fixture tests. Production rendering never calls it.

## Manual refresh

Open **Actions → yearly report → Run workflow**. Leave `year` empty for the rolling report; use `no_ai=true` to isolate GitHub/rendering from AI-provider issues. A completed successful run should update the README timestamp and JSON `generatedAt`/`dateRange`/`dataScope` fields.

If a run is disabled, enable it in Actions. If a run fails, inspect the first failing step rather than assuming a green workflow proves the rendered image is correct. For a token failure, inspect the optional custom token's validity/access; do not publish token values. For `npm ci` failures, synchronize `package.json` and `package-lock.json` locally and commit both.

This repair intentionally preserves the profile's existing personal introduction. It changes the automation and statistics presentation, not the author's identity or project selection.
