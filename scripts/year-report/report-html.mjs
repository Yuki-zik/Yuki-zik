import {
  CONTRIBUTION_LEVEL_COLORS,
  escapeXml,
  estimateTextWidth,
  formatDateCN,
  formatDateRangeCN,
  formatNumber,
  toPercent,
  truncate,
  wrapLines,
} from "./utils.mjs"
import { REPORT_DIMENSIONS, buildReportLayout, getChartGeometry } from "./design-spec.mjs"

const L = {
  day0: "\u65e5",
  day1: "\u4e00",
  day2: "\u4e8c",
  day3: "\u4e09",
  day4: "\u56db",
  day5: "\u4e94",
  day6: "\u516d",
  month: "\u6708",
  year: "\u5e74",
  dot: "\u00b7",
  modeAi: "\u6a21\u5f0f\uff1aAI \u751f\u6210",
  modeFallback: "\u6a21\u5f0f\uff1a\u89c4\u5219\u964d\u7ea7",
  analysis: "\u5206\u6790",
  noRepoData: "\u6682\u65e0\u4ed3\u5e93\u6570\u636e",
  noRepoDesc: "\u6682\u65e0\u4ed3\u5e93\u63cf\u8ff0",
  aiTitle: "AI \u5e74\u5ea6\u603b\u7ed3",
  followers: "\u5173\u6ce8\u8005",
  following: "\u5173\u6ce8\u4e2d",
  total: "\u5171",
  only: "\u4ec5",
  contributions: "\u6b21\u8d21\u732e",
  activeMonth: "\u8fd9\u4e00\u5e74\u7684\u9ad8\u5149\u6708\u4efd",
  avgPerDay: "\u65e5\u5747\u8d21\u732e",
  issuesInYearSuffix: "\u5e74\u78b0\u8fc7\u7684 Issues",
  maxDay: "\u4f60\u6700\u6d3b\u8dc3\u7684\u4e00\u5929",
  longestStreak: "\u6700\u957f\u8fde\u7eed\u6253\u5361",
  longestGap: "\u4f11\u606f\u6700\u4e45\u7684\u4e00\u6bb5\u65f6\u95f4",
  dayUnit: "\u5929",
  reposTitleSuffix: "\u5e74\u4f60\u5728\u6298\u817e\u7684\u4ed3\u5e93",
  tabHot: "\u6700\u51fa\u5708\u7684",
  tabNew: "\u65b0\u5f00\u7684",
  langsTitleSuffix: "\u5e74\u4f60\u6700\u5e38\u7528\u7684\u8bed\u8a00",
  monthlyTitleSuffix: "\u4e00\u5e74\u7684\u8d77\u4f0f\u8f68\u8ff9",
  weeklyTitleSuffix: "\u4f60\u4e00\u5468\u91cc\u7684\u8282\u594f",
  yearlyTotal: "\u8fd9\u4e00\u5e74\u7684\u603b\u8d21\u732e\uff1a",
  peakMoment: "\u9ad8\u5149\u65f6\u523b\uff1a",
  busiestMoment: "\u6700\u5fd9\u7684\u65f6\u5019\uff1a",
  weekdayPrefix: "\u661f\u671f",
  stars: "Stars",
  forks: "Fork",
  commits: "Commits",
}

const WEEKDAY_LABELS = [L.day0, L.day1, L.day2, L.day3, L.day4, L.day5, L.day6]
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) => `${i + 1}${L.month}`)

const ICONS = {
  chevronLeft: {
    paths: ["m15 18-6-6 6-6"],
  },
  chevronRight: {
    paths: ["m9 18 6-6-6-6"],
  },
  lock: {
    paths: ["M7 11V7a5 5 0 0 1 10 0v4"],
    rects: [{ x: 3, y: 11, width: 18, height: 11, rx: 2, ry: 2 }],
  },
  rotateCw: {
    paths: ["M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8", "M21 3v5h-5"],
  },
  share: {
    paths: ["M12 2v13", "m16 6-4-4-4 4", "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"],
  },
  plus: {
    paths: ["M5 12h14", "M12 5v14"],
  },
  copy: {
    paths: ["M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"],
    rects: [{ x: 8, y: 8, width: 14, height: 14, rx: 2, ry: 2 }],
  },
  atSign: {
    paths: ["M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"],
    circles: [{ cx: 12, cy: 12, r: 4 }],
  },
  user: {
    paths: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"],
    circles: [{ cx: 12, cy: 7, r: 4 }],
  },
  sparkles: {
    paths: [
      "M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z",
      "M20 2v4",
      "M22 4h-4",
    ],
    circles: [{ cx: 4, cy: 20, r: 2 }],
  },
  calendarArrowUp: {
    paths: [
      "m14 18 4-4 4 4",
      "M16 2v4",
      "M18 22v-8",
      "M21 11.343V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h9",
      "M3 10h18",
      "M8 2v4",
    ],
  },
  scale: {
    paths: [
      "M12 3v18",
      "m19 8 3 8a5 5 0 0 1-6 0zV7",
      "M3 7h1a17 17 0 0 0 8-2 17 17 0 0 0 8 2h1",
      "m5 8 3 8a5 5 0 0 1-6 0zV7",
      "M7 21h10",
    ],
  },
  messageSquareQuote: {
    paths: [
      "M14 14a2 2 0 0 0 2-2V8h-2",
      "M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z",
      "M8 14a2 2 0 0 0 2-2V8H8",
    ],
  },
  arrowBigUpDash: {
    paths: [
      "M9 13a1 1 0 0 0-1-1H5.061a1 1 0 0 1-.75-1.811l6.836-6.835a1.207 1.207 0 0 1 1.707 0l6.835 6.835a1 1 0 0 1-.75 1.811H16a1 1 0 0 0-1 1v2a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z",
      "M9 20h6",
    ],
  },
  calendarDays: {
    paths: [
      "M8 2v4",
      "M16 2v4",
      "M3 10h18",
      "M8 14h.01",
      "M12 14h.01",
      "M16 14h.01",
      "M8 18h.01",
      "M12 18h.01",
      "M16 18h.01",
    ],
    rects: [{ x: 3, y: 4, width: 18, height: 18, rx: 2 }],
  },
  calendarMinus2: {
    paths: ["M8 2v4", "M16 2v4", "M3 10h18", "M10 16h4"],
    rects: [{ x: 3, y: 4, width: 18, height: 18, rx: 2 }],
  },
  folderGit2: {
    paths: [
      "M18 19a5 5 0 0 1-5-5v8",
      "M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5",
    ],
    circles: [{ cx: 13, cy: 12, r: 2 }, { cx: 20, cy: 19, r: 2 }],
  },
  squareCode: {
    paths: ["m10 9-3 3 3 3", "m14 15 3-3-3-3"],
    rects: [{ x: 3, y: 3, width: 18, height: 18, rx: 2 }],
  },
  calendarRange: {
    paths: [
      "M16 2v4",
      "M3 10h18",
      "M8 2v4",
      "M17 14h-6",
      "M13 18H7",
      "M7 14h.01",
      "M17 18h.01",
    ],
    rects: [{ x: 3, y: 4, width: 18, height: 18, rx: 2 }],
  },
}

const LANGUAGE_SLUG_MAP = {
  JavaScript: "javascript",
  TypeScript: "typescript",
  Python: "python",
  Java: "java",
  C: "c",
  "C++": "cplusplus",
  "C#": "csharp",
  Go: "go",
  Rust: "rust",
  Ruby: "ruby",
  PHP: "php",
  Swift: "swift",
  Kotlin: "kotlin",
  Dart: "dart",
  Scala: "scala",
  R: "r",
  Lua: "lua",
  Shell: "gnubash",
  Bash: "gnubash",
  PowerShell: "powershell",
  HTML: "html5",
  CSS: "css",
  SCSS: "sass",
  Sass: "sass",
  Less: "less",
  Vue: "vuedotjs",
  Svelte: "svelte",
  Markdown: "markdown",
  JSON: "json",
  YAML: "yaml",
  TOML: "toml",
  SQL: "mysql",
  Dockerfile: "docker",
  CMake: "cmake",
  MDX: "mdx",
}

function svgIcon(name, size = 16, className = "ico") {
  const icon = ICONS[name]
  if (!icon) {
    return ""
  }

  const paths = (icon.paths || []).map((d) => `<path d="${d}"></path>`).join("")
  const rects = (icon.rects || [])
    .map((rect) => `<rect${Object.entries(rect).map(([k, v]) => ` ${k}="${v}"`).join("")}></rect>`)
    .join("")
  const circles = (icon.circles || [])
    .map((circle) => `<circle${Object.entries(circle).map(([k, v]) => ` ${k}="${v}"`).join("")}></circle>`)
    .join("")

  return `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}${rects}${circles}</svg>`
}

function githubIcon(size = 34) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385c.6.105.825-.255.825-.57c0-.285-.015-1.23-.015-2.235c-3.015.555-3.795-.735-4.035-1.41c-.135-.345-.72-1.41-1.23-1.695c-.42-.225-1.02-.78-.015-.795c.945-.015 1.62.87 1.845 1.23c1.08 1.815 2.805 1.305 3.495.99c.105-.78.42-1.305.765-1.605c-2.67-.3-5.46-1.335-5.46-5.925c0-1.305.465-2.385 1.23-3.225c-.12-.3-.54-1.53.12-3.18c0 0 1.005-.315 3.3 1.23c.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23c.66 1.65.24 2.88.12 3.18c.765.84 1.23 1.905 1.23 3.225c0 4.605-2.805 5.625-5.475 5.925c.435.375.81 1.095.81 2.22c0 1.605-.015 2.895-.015 3.3c0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z"></path></svg>`
}

function starIcon(size = 12) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><path d="M8.243 7.34l-6.38.925a1 1 0 0 0-.554 1.707l4.621 4.499-1.09 6.355a1 1 0 0 0 1.45 1.046L12 18.87l5.693 3a1 1 0 0 0 1.45-1.046l-1.09-6.356 4.621-4.498a1 1 0 0 0-.554-1.707l-6.38-.925-2.853-5.78a1 1 0 0 0-1.794 0z"></path></svg>`
}

function ensure(values, len) {
  const out = Array.from({ length: len }, () => 0)
  values?.slice(0, len).forEach((v, i) => {
    out[i] = Number.isFinite(v) ? v : 0
  })
  return out
}

function normalizeHeatmap(weeks) {
  const result = []
  for (let weekIndex = 0; weekIndex < 53; weekIndex += 1) {
    const row = []
    const srcWeek = weeks?.[weekIndex]?.days || []
    for (let dayIndex = 0; dayIndex < 7; dayIndex += 1) {
      const level = String(srcWeek[dayIndex]?.level || "NONE").toUpperCase()
      row.push(CONTRIBUTION_LEVEL_COLORS[level] || CONTRIBUTION_LEVEL_COLORS.NONE)
    }
    result.push(row)
  }
  return result
}

function getLanguageSlug(language) {
  if (!language) {
    return undefined
  }
  if (LANGUAGE_SLUG_MAP[language]) {
    return LANGUAGE_SLUG_MAP[language]
  }

  const lowered = language.toLowerCase()
  const matched = Object.keys(LANGUAGE_SLUG_MAP).find((key) => key.toLowerCase() === lowered)
  if (matched) {
    return LANGUAGE_SLUG_MAP[matched]
  }

  const fallback = lowered.replace(/[^a-z0-9]/g, "")
  return fallback || undefined
}

function languageInitial(language) {
  if (!language) {
    return "?"
  }
  if (language === "C++") {
    return "C+"
  }
  if (language === "C#") {
    return "C#"
  }
  return language.slice(0, 1).toUpperCase()
}

function renderLanguageIcon(language, size = 16) {
  const slug = getLanguageSlug(language)
  const fallback = escapeXml(languageInitial(language))

  if (!slug) {
    return `<span class="lang-fallback-only" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.68)}px">${fallback}</span>`
  }

  const src = escapeXml(`https://cdn.simpleicons.org/${slug}`)
  return `<span class="lang-icon-wrap" style="width:${size}px;height:${size}px"><img src="${src}" alt="${escapeXml(language || "language")} icon" width="${size}" height="${size}" loading="eager" onerror="this.style.display='none';this.nextElementSibling.style.display='inline-flex'"/><span class="lang-fallback" style="display:none;font-size:${Math.round(size * 0.68)}px">${fallback}</span></span>`
}

function staticCard(rect, content, className = "") {
  return `<section class="panel ${className}" style="left:${rect.x}px;top:${rect.y}px;width:${rect.w}px;height:${rect.h}px"><div class="static-card"><div class="sc-l1"><div class="sc-l2"><div class="sc-l3"><div class="sc-content">${content}</div></div></div></div></div></section>`
}

function renderHeatmap(stats) {
  const matrix = normalizeHeatmap(stats.heatmapWeeks)
  const cells = []
  matrix.forEach((week, w) => {
    week.forEach((color, d) => {
      cells.push(`<span class="heat-cell" style="grid-column:${w + 1};grid-row:${d + 1};background:${color}"></span>`)
    })
  })

  return `<div class="heatmap"><div class="heat-months">${MONTH_LABELS.map((m) => `<span>${m}</span>`).join("")}</div><div class="heat-grid">${cells.join("")}</div></div>`
}

function renderAi(aiSummary) {
  const introLines = wrapLines(aiSummary?.intro || "", 34, 2).filter(Boolean)
  const sections = (aiSummary?.sections || []).slice(0, 3)
  const mode = aiSummary?.mode === "ai" ? L.modeAi : L.modeFallback

  return `<div class="ai-card"><div class="ai-head"><span class="icon-slot">${svgIcon("sparkles", 18)}</span><h3>${L.aiTitle}</h3></div><div class="ai-body">${introLines.map((line) => `<p class="ai-intro">${escapeXml(line)}</p>`).join("")}<p class="ai-mode">${escapeXml(mode)}</p>${sections.map((section) => {
      const heading = escapeXml(section?.heading || L.analysis)
      const lines = wrapLines(section?.content || "", 34, 2).filter(Boolean)
      return `<div class="ai-sec"><h4>${heading}</h4>${lines.map((line) => `<p>${escapeXml(line)}</p>`).join("")}</div>`
    }).join("")}</div></div>`
}

function renderInlineStat(iconName, title, value) {
  return `<div class="inline-stat"><div class="inline-stat-left"><span class="icon-slot">${svgIcon(iconName, 20)}</span><span>${escapeXml(title)}</span></div><span class="inline-stat-value">${escapeXml(value)}</span></div>`
}

function renderKpi(iconName, title, value, unit, subText) {
  const text = formatNumber(value)
  const spacing = Math.max(12, Math.round(estimateTextWidth(text, 50) * 0.02))
  return `<div class="kpi"><div class="kpi-head"><span class="icon-slot">${svgIcon(iconName, 20)}</span><span>${escapeXml(title)}</span></div><div class="kpi-main"><span class="kpi-num">${text}</span><span class="kpi-unit" style="margin-left:${spacing}px">${escapeXml(unit)}</span></div><p class="kpi-sub">${escapeXml(subText)}</p></div>`
}

function renderRepos(repos) {
  return repos.slice(0, 3).map((repo) => {
    const name = escapeXml(repo.nameWithOwner || L.noRepoData)
    const starValue = formatNumber(repo.stars || 0)
    const forks = formatNumber(repo.forks || 0)
    const commits = formatNumber(repo.commits || 0)
    const description = escapeXml(truncate(repo.description || L.noRepoDesc, 40))

    return `<li class="repo-item"><div class="repo-title-row"><p class="repo-name">${name}</p><span class="repo-star">${starIcon(12)}${starValue}</span></div><p class="repo-meta">${L.stars} ${starValue} ${L.dot} ${L.forks} ${forks} ${L.dot} ${L.commits} ${commits}</p><p class="repo-desc">${description}</p></li>`
  }).join("")
}

function renderLanguages(items) {
  return items.slice(0, 5).map((item, index) => {
    const language = item.language || "N/A"
    const ratio = Math.max(0, Math.min(1, item.ratio || 0))
    const width = Math.max(2, Math.round(ratio * 100))

    return `<li class="lang-item"><span class="lang-rank">#${index + 1}</span><div class="lang-name">${renderLanguageIcon(language, 16)}<span>${escapeXml(language)}</span></div><div class="lang-track"><span class="lang-fill" style="width:${width}%"></span></div><span class="lang-percent">${toPercent(ratio, 1)}</span></li>`
  }).join("")
}

function chartTicks(maxValue) {
  const max = Math.max(1, maxValue)
  return [0, 1, 2, 3, 4].map((step) => Math.round((max / 4) * step))
}

function renderChartPlot(card, values, labels) {
  const geometry = getChartGeometry(card)
  const maxValue = Math.max(...values, 1)
  const ticks = chartTicks(maxValue)
  const count = values.length
  const barWidth = count === 12 ? 38 : 72
  const gap = count > 1 ? (geometry.plotW - barWidth * count) / (count - 1) : 0

  const guides = ticks.map((tick) => {
    const ratio = maxValue > 0 ? tick / maxValue : 0
    const y = geometry.plotH - Math.round(geometry.plotH * ratio)
    return `<span class="plot-guide" style="top:${y}px"></span>`
  }).join("")

  const yLabels = ticks.map((tick) => {
    const ratio = maxValue > 0 ? tick / maxValue : 0
    const y = geometry.plotH - Math.round(geometry.plotH * ratio)
    return `<span class="plot-y-label" style="top:${y}px">${formatNumber(tick)}</span>`
  }).join("")

  const bars = values.map((value, index) => {
    const height = value > 0 ? Math.max(6, Math.round((value / maxValue) * geometry.plotH)) : 0
    const x = index * (barWidth + gap)
    const y = geometry.plotH - height
    const className = value === maxValue && maxValue > 0 ? "plot-bar is-max" : "plot-bar"
    return `<span class="${className}" style="left:${x.toFixed(2)}px;top:${y}px;width:${barWidth}px;height:${height}px"></span>`
  }).join("")

  const xLabels = labels.map((label, index) => {
    const x = index * (barWidth + gap) + barWidth / 2
    return `<span class="plot-x-label" style="left:${x.toFixed(2)}px">${escapeXml(label)}</span>`
  }).join("")

  return `<div class="plot-area" style="left:${geometry.plotX - card.x}px;top:${geometry.plotY - card.y}px;width:${geometry.plotW}px;height:${geometry.plotH}px">${guides}<div class="plot-bars">${bars}</div></div><div class="plot-y" style="left:${geometry.plotX - card.x - 34}px;top:${geometry.plotY - card.y}px;height:${geometry.plotH}px">${yLabels}</div><div class="plot-x" style="left:${geometry.plotX - card.x}px;top:${geometry.plotBottom - card.y + 8}px;width:${geometry.plotW}px">${xLabels}</div>`
}

function styles() {
  return `@font-face{font-family:vivoSans;font-weight:400;font-style:normal;font-display:swap;src:url('https://cdn.jsdelivr.net/gh/Codennnn/static@main/fonts/vivoSans-Regular.woff2') format('woff2')}@font-face{font-family:vivoSans;font-weight:500;font-style:normal;font-display:swap;src:url('https://cdn.jsdelivr.net/gh/Codennnn/static@main/fonts/vivoSans-Medium.woff2') format('woff2')}@font-face{font-family:vivoSans;font-weight:600;font-style:normal;font-display:swap;src:url('https://cdn.jsdelivr.net/gh/Codennnn/static@main/fonts/vivoSans-SemiBold.woff2') format('woff2')}@font-face{font-family:vivoSans;font-weight:700;font-style:normal;font-display:swap;src:url('https://cdn.jsdelivr.net/gh/Codennnn/static@main/fonts/vivoSans-Bold.woff2') format('woff2')}:root{--fg:#334155;--fg-strong:#0f172a;--muted:#64748b;--card-b1:rgba(51,65,85,.13);--card-b2:rgba(51,65,85,.2);--level-0:#ebedf0;--level-1:#6ee7b7;--level-2:#10b981;--level-3:#047857;--level-4:#064e3b;--block-size:10px;--block-gap:2px;--week-width:calc(var(--block-size) + var(--block-gap))}*{box-sizing:border-box}body{margin:0;width:${REPORT_DIMENSIONS.width}px;height:${REPORT_DIMENSIONS.height}px;overflow:hidden;color:var(--fg);font-family:vivoSans,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;background:#f8fafc;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}.canvas{position:relative;width:100%;height:100%}.panel{position:absolute}.static-card{height:100%;border-radius:12px;border:1px solid var(--card-b1);overflow:hidden}.sc-l1{height:100%;border-radius:11px;border:1px solid #fff}.sc-l2{height:100%;border-radius:10px;border:1px solid var(--card-b2)}.sc-l3{height:100%;border-radius:9px;border:1px solid rgba(255,255,255,.5);overflow:hidden}.sc-content{height:100%;overflow:hidden;background:linear-gradient(to bottom,rgba(51,65,85,.04),#fff)}.ico{display:block}.icon-slot{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px}.top-left-wrap{position:relative;overflow:hidden;border-radius:24px;padding:35px;height:100%}.mockup-bg{position:absolute;inset:0;background:#f1f5f9}.mockup-wrap{position:relative;z-index:1;height:100%;overflow:hidden}.mockup{height:100%;border-radius:16px;border:2px double rgba(148,163,184,.42);background:#fff;overflow:hidden}.safari-head{height:52px;padding:0 16px;display:flex;align-items:center;gap:10px;color:#64748b}.lights{display:flex;align-items:center;gap:7px}.light{width:10px;height:10px;border-radius:999px}.light.red{background:rgb(232,106,94)}.light.yellow{background:rgb(241,190,80)}.light.green{background:rgb(97,196,84)}.nav-btns{display:flex;align-items:center;gap:2px;opacity:.8}.url{margin:0 auto;display:flex;align-items:center;gap:8px;height:28px;min-width:302px;border:2px solid color-mix(in srgb, rgba(148,163,184,.4), transparent 50%);border-radius:10px;background:rgba(245,245,245,.5);padding:0 10px;font-size:12px;opacity:.86}.url span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.url .ico{opacity:.8}.safari-actions{display:flex;align-items:center;gap:8px;opacity:.78}.profile-row{padding:8px 24px 0;display:flex;align-items:flex-start;gap:14px}.avatar{width:80px;height:80px;border-radius:999px;overflow:hidden;background:var(--level-0);flex:none}.avatar img{width:100%;height:100%;object-fit:cover}.avatar-fallback{display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:linear-gradient(145deg,var(--level-1),var(--level-2));font-size:32px;font-weight:700;color:var(--fg-strong)}.profile-meta{min-width:0;flex:1}.profile-meta h2{margin:0;font-size:50px;line-height:1.02;letter-spacing:-.01em;color:var(--fg-strong)}.profile-account{margin:6px 0 0;display:flex;align-items:center;gap:6px;font-size:13px;color:#1f2937}.profile-account .mini{display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px}.profile-account .dot{opacity:.5}.profile-bio{margin:6px 0 0;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.profile-total{width:184px;padding-top:2px;text-align:right;font-size:13px}.profile-total p{margin:0}.profile-total .sub{color:var(--muted);margin-top:4px}.profile-total .mark{display:inline-block;width:34px;height:34px;color:#111827;margin-bottom:2px}.heatmap-shell{margin:10px 24px 14px;border:1px solid rgba(148,163,184,.22);border-radius:12px;background:rgba(248,250,252,.85);padding:10px 12px 12px}.heatmap{display:grid;grid-template-areas:'months' 'grid';row-gap:8px}.heat-months{grid-area:months;display:grid;grid-template-columns:calc(var(--week-width)*5) calc(var(--week-width)*4) calc(var(--week-width)*4) calc(var(--week-width)*5) calc(var(--week-width)*4) calc(var(--week-width)*4) calc(var(--week-width)*5) calc(var(--week-width)*4) calc(var(--week-width)*4) calc(var(--week-width)*5) calc(var(--week-width)*4) calc(var(--week-width)*5);font-size:12px;color:var(--muted);opacity:.76}.heat-grid{grid-area:grid;display:grid;grid-template-columns:repeat(53,var(--block-size));grid-template-rows:repeat(7,var(--block-size));gap:var(--block-gap)}.heat-cell{display:block;width:var(--block-size);height:var(--block-size);border-radius:2px}.ai-card{height:100%;display:flex;flex-direction:column}.ai-head{display:flex;align-items:center;gap:10px;padding:14px 18px 0}.ai-head h3{margin:0;font-size:42px;line-height:1.1;color:var(--fg-strong)}.ai-body{padding:10px 18px 14px;display:flex;flex-direction:column;gap:7px;overflow:hidden}.ai-intro{margin:0;font-size:14px;line-height:1.48;color:#475569}.ai-mode{margin:0 0 3px;font-size:13px;color:var(--muted)}.ai-sec{margin-top:2px}.ai-sec h4{margin:0 0 4px;font-size:31px;line-height:1.15;color:#1f2937}.ai-sec p{margin:0;font-size:14px;line-height:1.46;color:#475569}.inline-stat{height:100%;padding:0 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}.inline-stat-left{display:inline-flex;align-items:center;gap:10px;min-width:0;font-size:16px;font-weight:500;color:#1e293b}.inline-stat-left span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.inline-stat-value{font-size:18px;font-weight:700;color:var(--fg-strong);white-space:nowrap}.kpi{height:100%;display:flex;flex-direction:column;padding:14px 16px 12px}.kpi-head{display:flex;align-items:center;gap:10px;font-size:21px;font-weight:600;line-height:1.15;color:var(--fg-strong)}.kpi-main{margin-top:10px;display:flex;align-items:flex-end}.kpi-num{font-size:54px;line-height:1;font-weight:700;color:var(--fg-strong)}.kpi-unit{font-size:14px;color:var(--muted);padding-bottom:8px}.kpi-sub{margin:auto 0 0;font-size:14px;line-height:1.25;color:#475569}.repo-card{height:100%;display:flex;flex-direction:column}.repo-head{padding:14px 16px 10px;display:flex;align-items:center;gap:10px}.repo-head h3{margin:0;font-size:18px;font-weight:700;color:var(--fg-strong)}.repo-tabs{margin-left:auto;display:inline-flex;align-items:center;gap:8px}.repo-tab{padding:5px 10px;border:1px solid rgba(148,163,184,.35);border-radius:10px;background:rgba(248,250,252,.75);font-size:13px;color:var(--muted)}.repo-list{margin:0;padding:0 16px 12px;list-style:none;display:flex;flex-direction:column;gap:8px}.repo-title-row{display:flex;align-items:center;gap:8px}.repo-name{margin:0;min-width:0;flex:1;font-size:17px;font-weight:700;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.repo-star{display:inline-flex;align-items:center;gap:3px;font-size:13px;color:var(--muted)}.repo-meta{margin:2px 0 0;font-size:13px;color:var(--muted)}.repo-desc{margin:2px 0 0;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lang-card{height:100%;display:flex;flex-direction:column}.lang-head{padding:14px 16px 8px;display:flex;align-items:center;gap:10px}.lang-head h3{margin:0;font-size:18px;font-weight:700;color:var(--fg-strong)}.lang-list{margin:0;padding:0 16px 12px;list-style:none}.lang-item{display:grid;grid-template-columns:36px minmax(0,180px) 1fr 56px;align-items:center;gap:8px;margin-bottom:8px}.lang-rank{display:inline-flex;align-items:center;justify-content:center;height:22px;border-radius:8px;background:rgba(15,23,42,.08);font-size:12px;font-weight:700}.lang-name{display:flex;align-items:center;gap:8px;min-width:0;font-size:16px;font-weight:700;color:#1f2937}.lang-name span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lang-icon-wrap,.lang-fallback-only{display:inline-flex;align-items:center;justify-content:center;flex:none}.lang-icon-wrap img{display:block;width:100%;height:100%;filter:brightness(0)}.lang-fallback,.lang-fallback-only{border-radius:3px;background:#e2e8f0;color:#475569;font-weight:600}.lang-track{position:relative;height:8px;border-radius:999px;background:#e2e8f0;overflow:hidden}.lang-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:#1e293b}.lang-percent{text-align:right;font-size:13px;color:var(--muted)}.chart-card{position:relative;height:100%}.chart-head{height:56px;padding:14px 16px 0;display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.chart-title{display:flex;align-items:center;gap:10px;min-width:0}.chart-title h3{margin:0;font-size:18px;font-weight:700;color:var(--fg-strong);white-space:nowrap}.chart-summary{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap}.chart-summary-item{font-size:13px;color:#475569;white-space:nowrap}.chart-summary-item strong{font-weight:600;color:var(--fg-strong)}.chart-badge{display:inline-flex;align-items:center;padding:2px 8px;border:1px solid rgba(148,163,184,.42);border-radius:10px;background:rgba(248,250,252,.9);font-size:12px;color:#334155;white-space:nowrap}.plot-area{position:absolute;overflow:hidden;clip-path:inset(0 round 8px)}.plot-bars{position:absolute;inset:0}.plot-bar{position:absolute;border-radius:6px 6px 0 0;background:#86efac}.plot-bar.is-max{background:#10b981}.plot-guide{position:absolute;left:0;right:0;border-top:1px dashed rgba(148,163,184,.55)}.plot-y{position:absolute;width:32px}.plot-y-label{position:absolute;right:2px;transform:translateY(-50%);font-size:12px;line-height:1;color:var(--muted)}.plot-x{position:absolute;height:22px}.plot-x-label{position:absolute;transform:translateX(-50%);font-size:13px;line-height:1;color:var(--muted);white-space:nowrap}`
}

export function renderReportHtml(model) {
  const { profile, year, stats, issuesCount, topRepos, topLanguages, aiSummary } = model
  const layout = buildReportLayout()

  const maxMonthText = stats.maxContributionsMonth
    ? `${year} ${L.year} ${Number(stats.maxContributionsMonth.slice(5, 7))} ${L.month}`
    : `${year} ${L.year} -- ${L.month}`

  const activeDayText = stats.maxContributionsDate ? formatDateCN(stats.maxContributionsDate) : "--"
  const streakRangeText = formatDateRangeCN(stats.longestStreakStartDate, stats.longestStreakEndDate)
  const gapRangeText = formatDateRangeCN(stats.longestGapStartDate, stats.longestGapEndDate)

  const monthlyValues = ensure(stats.monthlyContributions, 12)
  const weeklyValues = ensure(stats.weekdayContributions, 7)
  const busiestWeekday = WEEKDAY_LABELS[stats.busiestWeekday] || "--"
  const busiestValue = weeklyValues[stats.busiestWeekday] || 0
  const peakMonth = stats.maxContributionsMonth ? `${Number(stats.maxContributionsMonth.slice(5, 7))} ${L.month}` : "--"

  const monthlyPlot = renderChartPlot(layout.chart.left, monthlyValues, MONTH_LABELS)
  const weeklyPlot = renderChartPlot(layout.chart.right, weeklyValues, WEEKDAY_LABELS)

  const topLeftContent = `<div class="top-left-wrap"><span class="mockup-bg"></span><div class="mockup-wrap"><div class="mockup"><div class="safari-head"><div class="lights"><span class="light red"></span><span class="light yellow"></span><span class="light green"></span></div><div class="nav-btns">${svgIcon("chevronLeft", 16)}${svgIcon("chevronRight", 16)}</div><div class="url"><span>${svgIcon("lock", 13)}</span><span>github.com/${escapeXml(profile.login)}</span><span>${svgIcon("rotateCw", 13)}</span></div><div class="safari-actions">${svgIcon("share", 15)}${svgIcon("plus", 15)}${svgIcon("copy", 15)}</div></div><div class="profile-row"><div class="avatar">${profile.avatarUrl ? `<img src="${escapeXml(profile.avatarUrl)}" alt="${escapeXml(profile.login)} avatar"/>` : `<span class="avatar-fallback">${escapeXml(String(profile.login || "Y").slice(0, 1).toUpperCase())}</span>`}</div><div class="profile-meta"><h2>${escapeXml(profile.name || profile.login)}</h2><p class="profile-account"><span class="mini">${svgIcon("atSign", 13)}</span><span>@${escapeXml(profile.login)}</span><span class="dot">${L.dot}</span><span class="mini">${svgIcon("user", 14)}</span><span>${formatNumber(profile.followers)} ${L.followers}</span><span class="dot">${L.dot}</span><span>${formatNumber(profile.following)} ${L.following}</span></p><p class="profile-bio">${escapeXml(truncate(profile.bio || "Building useful software with stable cadence.", 70))}</p></div><div class="profile-total"><span class="mark">${githubIcon(34)}</span><p>${L.total} ${formatNumber(stats.totalContributions)} ${L.contributions}</p><p class="sub">${L.only} ${year} ${L.year}</p></div></div><div class="heatmap-shell">${renderHeatmap(stats)}</div></div></div></div>`

  const monthlyChartCard = `<div class="chart-card"><div class="chart-head"><div class="chart-title"><span class="icon-slot">${svgIcon("calendarRange", 20)}</span><h3>${year} ${L.monthlyTitleSuffix}</h3></div><div class="chart-summary"><span class="chart-summary-item">${L.yearlyTotal}<strong>${formatNumber(stats.totalContributions)}</strong></span><span class="chart-badge">${L.peakMoment}${escapeXml(peakMonth)}</span></div></div>${monthlyPlot}</div>`

  const weeklyChartCard = `<div class="chart-card"><div class="chart-head"><div class="chart-title"><span class="icon-slot">${svgIcon("calendarDays", 20)}</span><h3>${year} ${L.weeklyTitleSuffix}</h3></div><div class="chart-summary"><span class="chart-summary-item">${L.busiestMoment}<strong>${L.weekdayPrefix}${escapeXml(busiestWeekday)}</strong></span><span class="chart-badge">${formatNumber(busiestValue)} ${L.contributions}</span></div></div>${weeklyPlot}</div>`

  const issuesTitle = `${year} ${L.issuesInYearSuffix}`
  const reposTitle = `${year} ${L.reposTitleSuffix}`
  const langsTitle = `${year} ${L.langsTitleSuffix}`

  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeXml(profile.login)} ${year} GitHub Annual Report</title><style>${styles()}</style></head><body><div class="canvas">${staticCard(layout.top.left, topLeftContent)}${staticCard(layout.top.right, renderAi(aiSummary))}${staticCard(layout.stat.cards[0], renderInlineStat("calendarArrowUp", L.activeMonth, maxMonthText))}${staticCard(layout.stat.cards[1], renderInlineStat("scale", L.avgPerDay, formatNumber(stats.averageContributionsPerDay)))}${staticCard(layout.stat.cards[2], renderInlineStat("messageSquareQuote", issuesTitle, formatNumber(issuesCount)))}${staticCard(layout.kpi.cards[0], renderKpi("arrowBigUpDash", L.maxDay, stats.maxContributionsInADay, L.contributions, activeDayText))}${staticCard(layout.kpi.cards[1], renderKpi("calendarDays", L.longestStreak, stats.longestStreak, L.dayUnit, streakRangeText))}${staticCard(layout.kpi.cards[2], renderKpi("calendarMinus2", L.longestGap, stats.longestGap, L.dayUnit, gapRangeText))}${staticCard(layout.mid.left, `<div class="repo-card"><div class="repo-head"><span class="icon-slot">${svgIcon("folderGit2", 20)}</span><h3>${escapeXml(reposTitle)}</h3><div class="repo-tabs"><span class="repo-tab">${L.tabHot}</span><span class="repo-tab">${L.tabNew}</span></div></div><ul class="repo-list">${renderRepos(topRepos)}</ul></div>`)}${staticCard(layout.mid.right, `<div class="lang-card"><div class="lang-head"><span class="icon-slot">${svgIcon("squareCode", 20)}</span><h3>${escapeXml(langsTitle)}</h3></div><ul class="lang-list">${renderLanguages(topLanguages)}</ul></div>`)}${staticCard(layout.chart.left, monthlyChartCard)}${staticCard(layout.chart.right, weeklyChartCard)}</div></body></html>`
}
