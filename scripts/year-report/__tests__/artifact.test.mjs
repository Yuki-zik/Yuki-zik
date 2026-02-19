import test from "node:test"
import assert from "node:assert/strict"
import os from "node:os"
import path from "node:path"
import { mkdtemp, readFile, stat, writeFile } from "node:fs/promises"

import { renderReportHtml } from "../report-html.mjs"
import { writeFallbackPng } from "../png-renderer.mjs"
import { renderYearlyReportSvg } from "../svg-renderer.mjs"
import { REPORT_DIMENSIONS } from "../design-spec.mjs"

function buildHeatmapWeeks(year) {
  const weeks = []
  let dayCursor = new Date(Date.UTC(year, 0, 1))

  for (let w = 0; w < 53; w += 1) {
    const days = []
    for (let d = 0; d < 7; d += 1) {
      const date = dayCursor.toISOString().slice(0, 10)
      const count = (w + d) % 5 === 0 ? 3 : 0
      days.push({
        date,
        count,
        level: count > 0 ? "SECOND_QUARTILE" : "NONE",
        weekday: d,
        included: true,
      })
      dayCursor = new Date(dayCursor.getTime() + 24 * 60 * 60 * 1000)
    }
    weeks.push({ days })
  }

  return weeks
}

function createMockReportModel() {
  const year = 2026

  return {
    profile: {
      name: "Yuki-zik",
      login: "Yuki-zik",
      bio: "Focused on automation and practical tooling.",
      avatarUrl: "",
      followers: 12,
      following: 7,
    },
    year,
    stats: {
      totalContributions: 120,
      totalDaysConsidered: 45,
      activeDays: 20,
      averageContributionsPerDay: 3,
      maxContributionsInADay: 12,
      maxContributionsDate: `${year}-01-18`,
      longestStreak: 9,
      longestStreakStartDate: `${year}-01-10`,
      longestStreakEndDate: `${year}-01-18`,
      longestGap: 14,
      longestGapStartDate: `${year}-02-01`,
      longestGapEndDate: `${year}-02-14`,
      maxContributionsMonth: `${year}-01`,
      maxMonthlyContributions: 80,
      monthlyContributions: [80, 20, 12, 8, 0, 0, 0, 0, 0, 0, 0, 0],
      weekdayContributions: [10, 12, 14, 16, 20, 30, 18],
      busiestWeekday: 5,
      heatmapWeeks: buildHeatmapWeeks(year),
    },
    issuesCount: 5,
    prCount: 3,
    topRepos: [
      {
        nameWithOwner: "Yuki-zik/sample-a",
        description: "alpha",
        stars: 3,
        forks: 1,
        commits: 20,
      },
      {
        nameWithOwner: "Yuki-zik/sample-b",
        description: "beta",
        stars: 2,
        forks: 0,
        commits: 10,
      },
      {
        nameWithOwner: "Yuki-zik/sample-c",
        description: "gamma",
        stars: 1,
        forks: 0,
        commits: 5,
      },
    ],
    topLanguages: [
      { language: "TypeScript", ratio: 0.42 },
      { language: "Python", ratio: 0.26 },
      { language: "CSS", ratio: 0.12 },
      { language: "HTML", ratio: 0.11 },
      { language: "Shell", ratio: 0.09 },
    ],
    aiSummary: {
      mode: "fallback",
      intro: "你在 2026 年保持了稳定的 GitHub 活跃度。",
      sections: [
        { heading: "活跃节奏", content: "贡献峰值集中在 1 月，最长连续打卡 9 天。" },
        { heading: "高光时刻", content: "1 月 18 日达到 12 次贡献。" },
        { heading: "协作信号", content: "全年共参与 6 个 Issues，休息最长 14 天。" },
      ],
    },
  }
}

test("artifact pipeline should produce html, png, svg, and json files", async () => {
  const model = createMockReportModel()
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "year-report-artifact-"))

  const htmlPath = path.join(tempDir, "report.html")
  const pngPath = path.join(tempDir, "report.png")
  const svgPath = path.join(tempDir, "report.svg")
  const jsonPath = path.join(tempDir, "report.json")

  const html = renderReportHtml(model)
  await writeFile(htmlPath, html, "utf8")

  const pngBuffer = await writeFallbackPng(pngPath, REPORT_DIMENSIONS)
  const svg = renderYearlyReportSvg({
    pngBuffer,
    width: REPORT_DIMENSIONS.width,
    height: REPORT_DIMENSIONS.height,
    title: "test report",
  })

  await writeFile(svgPath, svg, "utf8")
  await writeFile(jsonPath, `${JSON.stringify(model, null, 2)}\n`, "utf8")

  const [htmlStat, pngStat, svgStat, jsonStat] = await Promise.all([
    stat(htmlPath),
    stat(pngPath),
    stat(svgPath),
    stat(jsonPath),
  ])

  assert.ok(htmlStat.size > 0)
  assert.ok(pngStat.size > 0)
  assert.ok(svgStat.size > 0)
  assert.ok(jsonStat.size > 0)

  const [svgText, jsonText] = await Promise.all([
    readFile(svgPath, "utf8"),
    readFile(jsonPath, "utf8"),
  ])

  assert.match(svgText, /data:image\/png;base64,/)
  assert.match(jsonText, /"year": 2026/)
})
