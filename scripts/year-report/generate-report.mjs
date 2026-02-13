import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"
import { mkdir, writeFile } from "node:fs/promises"

import { GitHubClient } from "./github-client.mjs"
import {
  deriveTopLanguages,
  deriveTopRepositories,
  deriveYearlyStatistics,
} from "./stats.mjs"
import { generateAiSummary } from "./ai-summary.mjs"
import { renderYearlyReportSvg } from "./svg-renderer.mjs"
import { getDatePartsInTimeZone, parseCliArgs } from "./utils.mjs"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "..", "..")

const DEFAULT_CONFIG = {
  username: process.env.GH_USERNAME || "Yuki-zik",
  timeZone: process.env.REPORT_TZ || "Asia/Shanghai",
  openAiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openAiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  reportYearMode: process.env.REPORT_YEAR_MODE || "current",
}

function validateYear(value) {
  if (!Number.isInteger(value) || value < 2008 || value > 2100) {
    throw new Error(`Invalid year: ${value}`)
  }
}

function resolveReportYear({ argYear, timeZone }) {
  if (argYear) {
    validateYear(argYear)
    return argYear
  }

  const { year } = getDatePartsInTimeZone(new Date(), timeZone)
  validateYear(year)

  return year
}

function withRepoPlaceholders(repos) {
  if (repos.length >= 3) {
    return repos.slice(0, 3)
  }

  const result = [...repos]

  while (result.length < 3) {
    result.push({
      nameWithOwner: "暂无仓库数据",
      url: "",
      description: "本年度暂无可展示的提交仓库。",
      stars: 0,
      forks: 0,
      commits: 0,
    })
  }

  return result
}

function withLanguagePlaceholders(languages) {
  if (languages.length >= 5) {
    return languages.slice(0, 5)
  }

  const result = [...languages]

  while (result.length < 5) {
    result.push({
      language: "N/A",
      bytes: 0,
      ratio: 0,
    })
  }

  return result
}

async function main() {
  const cli = parseCliArgs(process.argv.slice(2))

  if (DEFAULT_CONFIG.reportYearMode !== "current") {
    console.warn(`REPORT_YEAR_MODE=${DEFAULT_CONFIG.reportYearMode} is ignored. Only 'current' mode is supported.`)
  }

  const year = resolveReportYear({ argYear: cli.year, timeZone: DEFAULT_CONFIG.timeZone })
  const token = process.env.GH_STATS_TOKEN

  if (!token) {
    throw new Error("GH_STATS_TOKEN is required")
  }

  const client = new GitHubClient({ token })

  const [profileData, issuesCount] = await Promise.all([
    client.fetchYearlyProfileData({ username: DEFAULT_CONFIG.username, year }),
    client.fetchIssueCount({ username: DEFAULT_CONFIG.username, year }),
  ])

  const user = profileData.user
  const calendar = user.contributionsCollection.contributionCalendar
  const commitContributionsByRepository =
    user.contributionsCollection.commitContributionsByRepository ?? []

  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: DEFAULT_CONFIG.timeZone,
  })

  const topRepos = withRepoPlaceholders(
    deriveTopRepositories(commitContributionsByRepository, 3),
  )

  const topLanguages = withLanguagePlaceholders(
    deriveTopLanguages(commitContributionsByRepository, 5),
  )

  const aiSummary = await generateAiSummary({
    enabled: !cli.noAi,
    apiKey: process.env.OPENAI_API_KEY,
    baseUrl: DEFAULT_CONFIG.openAiBaseUrl,
    model: DEFAULT_CONFIG.openAiModel,
    username: user.login,
    year,
    stats,
    issuesCount,
    topLanguages,
    topRepos,
  })

  const reportModel = {
    profile: {
      name: user.name || user.login,
      login: user.login,
      bio: user.bio || "",
      avatarUrl: user.avatarUrl,
      followers: user.followers?.totalCount ?? 0,
      following: user.following?.totalCount ?? 0,
    },
    year,
    stats,
    issuesCount,
    topRepos,
    topLanguages,
    aiSummary,
  }

  const snapshot = {
    generatedAt: new Date().toISOString(),
    year,
    timezone: DEFAULT_CONFIG.timeZone,
    username: user.login,
    aiMode: aiSummary.mode,
    aiReason: aiSummary.reason || null,
    rateLimit: profileData.rateLimit,
    stats,
    issuesCount,
    topRepos,
    topLanguages,
    aiSummary,
  }

  if (cli.dryRun) {
    const summary = {
      generatedAt: snapshot.generatedAt,
      username: user.login,
      year,
      totalContributions: stats.totalContributions,
      averageContributionsPerDay: stats.averageContributionsPerDay,
      maxContributionsMonth: stats.maxContributionsMonth,
      aiMode: aiSummary.mode,
      issuesCount,
    }

    console.log(JSON.stringify(summary, null, 2))
    return
  }

  const assetsDir = path.join(repoRoot, "assets")
  const svgPath = path.join(assetsDir, "github-annual-report.svg")
  const jsonPath = path.join(assetsDir, "github-annual-report.json")

  await mkdir(assetsDir, { recursive: true })

  const svg = renderYearlyReportSvg(reportModel)

  await Promise.all([
    writeFile(svgPath, svg, "utf8"),
    writeFile(jsonPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8"),
  ])

  console.log(`Updated report: ${svgPath}`)
  console.log(`Updated snapshot: ${jsonPath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
