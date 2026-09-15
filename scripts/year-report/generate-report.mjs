import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { mkdir, mkdtemp, readFile, writeFile, rename, rm } from "node:fs/promises"
import { GitHubClient } from "./github-client.mjs"
import { deriveTopLanguages, deriveTopRepositories, deriveYearlyStatistics } from "./stats.mjs"
import { generateAiSummary } from "./ai-summary.mjs"
import { renderYearlyReportSvg } from "./svg-renderer.mjs"
import { renderReportHtml } from "./report-html.mjs"
import { renderReportPng } from "./png-renderer.mjs"
import { renderActivitySummary, updateReadmeStatus } from "./profile-assets.mjs"
import { REPORT_DIMENSIONS } from "./design-spec.mjs"
import { addDaysToIsoDate, getDatePartsInTimeZone, getTimeZoneDateRangeIso, parseCliArgs } from "./utils.mjs"

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const config = {
  username: process.env.GH_USERNAME || "Yuki-zik",
  timeZone: process.env.REPORT_TZ || "Asia/Shanghai",
  openAiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
}

function resolveDateRange(argYear) {
  const today = getDatePartsInTimeZone(new Date(), config.timeZone)
  if (argYear != null && (!Number.isInteger(argYear) || argYear < 2008 || argYear > today.year)) {
    throw new Error(`Invalid or future report year: ${argYear}`)
  }
  const isRolling = !argYear
  const start = isRolling ? addDaysToIsoDate(today.isoDate, -364) : `${argYear}-01-01`
  const end = isRolling || argYear === today.year ? today.isoDate : `${argYear}-12-31`
  return {
    year: argYear || today.year,
    ...getTimeZoneDateRangeIso({ startDate: start, endDate: end, timeZone: config.timeZone }),
    searchRange: `${start}..${end}`,
    dateRange: { start, end },
    isRolling,
  }
}
function pad(items, count, placeholder) {
  return [...items, ...Array.from({ length: Math.max(0, count - items.length) }, () => ({ ...placeholder }))].slice(0, count)
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2))
  const { year, from, to, searchRange, dateRange, isRolling } = resolveDateRange(cli.year)
  const token = process.env.GH_STATS_TOKEN || process.env.GITHUB_TOKEN
  if (!token) throw new Error("Set GH_STATS_TOKEN or GITHUB_TOKEN; GitHub Actions supplies the latter automatically")
  const client = new GitHubClient({ token })
  const [profileData, issuesCount, prCount] = await Promise.all([
    client.fetchYearlyProfileData({ username: config.username, year, from, to }),
    client.fetchIssueCount({ username: config.username, activityRange: searchRange }),
    client.fetchPrCount({ username: config.username, activityRange: searchRange }),
  ])
  const user = profileData.user
  const collection = user.contributionsCollection
  const stats = deriveYearlyStatistics(collection.contributionCalendar, { year, timeZone: config.timeZone, dateRange })
  const repositories = collection.commitContributionsByRepository || []
  const topRepos = pad(deriveTopRepositories(repositories, 3), 3, { nameWithOwner: "暂无公开仓库数据", url: "", description: "当前统计区间暂无可展示的公开提交仓库。", stars: 0, forks: 0, commits: 0 })
  const topLanguages = pad(deriveTopLanguages(repositories, 5), 5, { language: "N/A", bytes: 0, ratio: 0 })
  const profile = { name: user.name || user.login, login: user.login, bio: user.bio || "", avatarUrl: user.avatarUrl, followers: user.followers?.totalCount || 0, following: user.following?.totalCount || 0 }
  const aiSummary = await generateAiSummary({ enabled: !cli.noAi, apiKey: process.env.OPENAI_API_KEY, baseUrl: config.openAiBaseUrl, model: config.openAiModel, username: user.login, profile, year, stats, issuesCount, prCount, topLanguages, topRepos, isRolling })
  const model = { profile, year, stats, issuesCount, prCount, topRepos, topLanguages, aiSummary, isRolling, dateRangeLabel: isRolling ? "过去一年" : null }
  const { heatmapWeeks, ...snapshotStats } = stats
  const snapshot = {
    generatedAt: new Date().toISOString(), year, timezone: config.timeZone, username: user.login,
    dateRange, isRolling, profile, aiMode: aiSummary.mode, aiReason: aiSummary.reason || null,
    rateLimit: profileData.rateLimit, stats: snapshotStats, issuesCount, prCount, topRepos, topLanguages, aiSummary,
    dataScope: {
      contributions: "GitHub contribution calendar visible to the configured token; not all commits or all private activity",
      restrictedContributions: collection.restrictedContributionsCount || 0,
      repositoryDetails: "public repositories only; at most 100 repositories returned by GitHub",
      issuesAndPrs: "public issues and pull requests authored by this user and created during the report date range",
      languages: "current code bytes in the public contributed repositories; not lines personally written",
    },
    render: { mode: "pending", reason: null },
  }
  if (cli.dryRun) {
    console.log(JSON.stringify({ generatedAt: snapshot.generatedAt, username: user.login, year, dateRange, totalContributions: stats.totalContributions, averageContributionsPerDay: stats.averageContributionsPerDay, maxContributionsMonth: stats.maxContributionsMonth, aiMode: aiSummary.mode, issuesCount, prCount }, null, 2))
    return
  }
  const assetsDir = path.join(repoRoot, "assets")
  await mkdir(assetsDir, { recursive: true })
  const stagingDir = await mkdtemp(path.join(assetsDir, ".report-"))
  try {
    const pngPath = path.join(stagingDir, "github-annual-report.png")
    snapshot.render = await renderReportPng({ html: renderReportHtml(model), outputPath: pngPath, dimensions: REPORT_DIMENSIONS })
    const svg = renderYearlyReportSvg({ pngBuffer: await readFile(pngPath), width: REPORT_DIMENSIONS.width, height: REPORT_DIMENSIONS.height, title: `${user.login} GitHub Activity Report`, description: `${dateRange.start} to ${dateRange.end}; generated ${snapshot.generatedAt}.` })
    await Promise.all([
      writeFile(path.join(stagingDir, "github-annual-report.svg"), svg, "utf8"),
      writeFile(path.join(stagingDir, "github-annual-report.json"), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8"),
      writeFile(path.join(stagingDir, "github-activity-summary.svg"), renderActivitySummary(snapshot), "utf8"),
    ])
    // Publish only after fetching, rendering and serialization have all succeeded.
    for (const file of ["github-annual-report.png", "github-annual-report.svg", "github-annual-report.json", "github-activity-summary.svg"]) {
      await rename(path.join(stagingDir, file), path.join(assetsDir, file))
    }
    await updateReadmeStatus(path.join(repoRoot, "README.md"), snapshot)
    console.log(`Report generated successfully: ${dateRange.start} to ${dateRange.end}; AI=${snapshot.aiMode}`)
    if (process.env.GITHUB_STEP_SUMMARY) {
      await writeFile(process.env.GITHUB_STEP_SUMMARY, `## Profile report\n\nPeriod: ${dateRange.start} → ${dateRange.end}\n\nContributions: ${stats.totalContributions}; active days: ${stats.activeDays}; authored public issues/PRs: ${issuesCount}/${prCount}.\n\nAI summary: ${snapshot.aiMode}; renderer: ${snapshot.render.mode}.\n`, { flag: "a" })
    }
  } finally {
    await rm(stagingDir, { recursive: true, force: true })
  }
}
main().catch(error => {
  console.error(error.message)
  if (error.cause) console.error(error.cause.message)
  process.exitCode = 1
})
