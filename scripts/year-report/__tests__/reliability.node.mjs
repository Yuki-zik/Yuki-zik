import test from "node:test"
import assert from "node:assert/strict"
import os from "node:os"
import path from "node:path"
import { mkdtemp, readFile, writeFile, readdir, rm } from "node:fs/promises"
import { GitHubClient } from "../github-client.mjs"
import { renderReportPng, createSolidPngBuffer } from "../png-renderer.mjs"
import { renderActivitySummary, updateReadmeStatus } from "../profile-assets.mjs"

const success = data => new Response(JSON.stringify({ data }), { status: 200 })
test("GitHub token is required", () => {
  assert.throws(() => new GitHubClient({ token: "" }), /token is required/)
})
test("Issue/PR counts use author + creation date + public scope", async () => {
  const queries = []
  const client = new GitHubClient({ token: "test", fetchImpl: async (_, options) => {
    queries.push(JSON.parse(options.body).variables.queryString)
    return success({ search: { issueCount: 7 } })
  } })
  const input = { username: "someone", activityRange: "2026-01-01..2026-09-15" }
  assert.equal(await client.fetchIssueCount(input), 7)
  assert.equal(await client.fetchPrCount(input), 7)
  assert.deepEqual(queries, [
    "author:someone is:issue is:public created:2026-01-01..2026-09-15",
    "author:someone is:pr is:public created:2026-01-01..2026-09-15",
  ])
})
test("Transient GitHub failures retry", async () => {
  let calls = 0
  const client = new GitHubClient({ token: "test", sleep: async () => {}, fetchImpl: async () => {
    calls++
    return calls < 3 ? new Response("temporary", { status: 503 }) : success({ value: 1 })
  } })
  assert.deepEqual(await client.graphql("query {}"), { value: 1 })
  assert.equal(calls, 3)
})
test("Authentication failures do not retry or expose response bodies", async () => {
  let calls = 0
  const client = new GitHubClient({ token: "test", fetchImpl: async () => { calls++; return new Response("sensitive detail", { status: 401 }) } })
  await assert.rejects(client.graphql("query {}"), error => /401/.test(error.message) && !/sensitive/.test(error.message))
  assert.equal(calls, 1)
})
test("GraphQL errors and missing counts fail rather than reporting zero", async () => {
  const client = new GitHubClient({ token: "test", fetchImpl: async () => success({ search: {} }) })
  await assert.rejects(client.fetchIssueCount({ username: "test", year: 2026 }), /no issue count/)
  client.fetchImpl = async () => new Response(JSON.stringify({ errors: [{ message: "restricted" }] }))
  await assert.rejects(client.graphql("query {}"), /restricted/)
})
test("Private and unknown-visibility repositories never reach public artifacts", async () => {
  const repositories = [
    { repository: { nameWithOwner: "u/public", isPrivate: false } },
    { repository: { nameWithOwner: "u/private", isPrivate: true } },
    { repository: { nameWithOwner: "u/unknown" } },
  ]
  const client = new GitHubClient({ token: "test", fetchImpl: async () => success({ user: {
    login: "u", contributionsCollection: { commitContributionsByRepository: repositories },
  } }) })
  const data = await client.fetchYearlyProfileData({ username: "u", year: 2026 })
  assert.deepEqual(data.user.contributionsCollection.commitContributionsByRepository.map(x => x.repository.nameWithOwner), ["u/public"])
})

const dimensions = { width: 10, height: 10, deviceScaleFactor: 2 }
function mockChromium(screenshot) {
  return async () => ({ launch: async () => ({
    newPage: async () => ({ setDefaultTimeout() {}, setContent: async () => {}, evaluate: async () => {}, screenshot }),
    close: async () => {},
  }) })
}
test("Browser failure preserves the previous PNG and leaves no temporary files", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "profile-render-test-"))
  try {
    const target = path.join(dir, "report.png")
    await writeFile(target, "previous-good-report")
    await assert.rejects(renderReportPng({ html: "content", outputPath: target, dimensions, loadChromium: async () => { throw new Error("browser missing") } }), /previous image was preserved/)
    assert.equal(await readFile(target, "utf8"), "previous-good-report")
    assert.deepEqual(await readdir(dir), ["report.png"])
  } finally { await rm(dir, { recursive: true, force: true }) }
})
test("Invalid screenshot is rejected without replacing the previous PNG", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "profile-render-test-"))
  try {
    const target = path.join(dir, "report.png")
    await writeFile(target, "previous-good-report")
    const loadChromium = mockChromium(async options => writeFile(options.path, "invalid png"))
    await assert.rejects(renderReportPng({ html: "content", outputPath: target, dimensions, loadChromium }), /previous image was preserved/)
    assert.equal(await readFile(target, "utf8"), "previous-good-report")
    assert.deepEqual(await readdir(dir), ["report.png"])
  } finally { await rm(dir, { recursive: true, force: true }) }
})
test("Successful screenshot validates scaled dimensions before publication", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "profile-render-test-"))
  try {
    const target = path.join(dir, "report.png")
    const fixture = createSolidPngBuffer({ width: 20, height: 20 })
    const loadChromium = mockChromium(async options => {
      assert.equal(options.animations, "disabled")
      await writeFile(options.path, fixture)
    })
    const result = await renderReportPng({ html: "content", outputPath: target, dimensions, loadChromium })
    assert.equal(result.ok, true)
    assert.deepEqual(await readFile(target), fixture)
    assert.deepEqual(await readdir(dir), ["report.png"])
  } finally { await rm(dir, { recursive: true, force: true }) }
})
const snapshot = { username: "u<&", generatedAt: "2026-09-15T07:00:00.000Z", dateRange: { start: "2025-09-16", end: "2026-09-15" }, stats: { totalContributions: 100, activeDays: 20, longestStreak: 4 }, aiMode: "fallback" }
test("Activity card is self-contained, escaped and dated", () => {
  const svg = renderActivitySummary(snapshot)
  assert.match(svg, /u&lt;&amp;/)
  assert.match(svg, /2026-09-15 UTC/)
  assert.match(svg, /2025-09-16 – 2026-09-15/)
  assert.doesNotMatch(svg, /<image|<script|foreignObject|heroku/)
  assert.throws(() => renderActivitySummary({ ...snapshot, stats: {} }), /Invalid report metric/)
})
test("README status update preserves surrounding content and is idempotent", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "profile-readme-test-"))
  try {
    const file = path.join(dir, "README.md")
    await writeFile(file, "before\n<!-- REPORT_STATUS:START -->\nold\n<!-- REPORT_STATUS:END -->\nafter")
    await updateReadmeStatus(file, snapshot)
    const first = await readFile(file, "utf8")
    await updateReadmeStatus(file, snapshot)
    assert.equal(await readFile(file, "utf8"), first)
    assert.ok(first.startsWith("before\n"))
    assert.ok(first.endsWith("\nafter"))
    assert.match(first, /2026-09-15 07:00:00 UTC/)
    await writeFile(file, "no markers")
    await assert.rejects(updateReadmeStatus(file, snapshot), /missing report status markers/)
  } finally { await rm(dir, { recursive: true, force: true }) }
})
