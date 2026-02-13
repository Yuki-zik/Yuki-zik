import {
  CONTRIBUTION_LEVEL_COLORS,
  escapeXml,
  formatDateCN,
  formatDateRangeCN,
  formatNumber,
  monthLabel,
  toPercent,
  truncate,
} from "./utils.mjs"

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

function renderHeatmap(heatmapWeeks) {
  const startX = 78
  const startY = 238
  const cell = 10
  const gap = 3

  const chunks = []

  heatmapWeeks.forEach((week, widx) => {
    week.days.forEach((day, didx) => {
      const x = startX + widx * (cell + gap)
      const y = startY + didx * (cell + gap)

      if (x > 744) {
        return
      }

      const color = CONTRIBUTION_LEVEL_COLORS[day.level] ?? CONTRIBUTION_LEVEL_COLORS.NONE
      chunks.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${color}"/>`)
    })
  })

  return chunks.join("")
}

function findMonthFirstWeekIndex(heatmapWeeks, year, month) {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`

  for (let weekIndex = 0; weekIndex < heatmapWeeks.length; weekIndex += 1) {
    const week = heatmapWeeks[weekIndex]
    const hasMonth = week.days.some((day) => day.date?.startsWith(monthPrefix))

    if (hasMonth) {
      return weekIndex
    }
  }

  return null
}

function renderMonthLabels(heatmapWeeks, year) {
  const startX = 78
  const step = 13

  const chunks = []

  for (let month = 1; month <= 12; month += 1) {
    const weekIndex = findMonthFirstWeekIndex(heatmapWeeks, year, month)

    if (weekIndex === null) {
      continue
    }

    const x = startX + weekIndex * step

    if (x > 740) {
      continue
    }

    chunks.push(`<text x="${x}" y="220" class="small">${month}月</text>`)
  }

  return chunks.join("")
}

function renderRepoRows(topRepos) {
  const rows = topRepos.slice(0, 3)
  const startY = 735
  const rowGap = 92

  return rows
    .map((repo, idx) => {
      const y = startY + idx * rowGap
      const desc = truncate(repo.description || "暂无仓库描述", 34)

      return `
        <text x="44" y="${y}" class="h3">${escapeXml(repo.nameWithOwner)}</text>
        <text x="44" y="${y + 27}" class="small">Stars ${formatNumber(repo.stars)} · Fork ${formatNumber(repo.forks)} · Commits ${formatNumber(repo.commits)}</text>
        <text x="44" y="${y + 55}" class="p">${escapeXml(desc)}</text>
      `
    })
    .join("")
}

function renderLanguageRows(topLanguages) {
  const baseY = 734
  const rowGap = 38
  const barX = 760
  const barWidth = 576

  return topLanguages
    .slice(0, 5)
    .map((item, idx) => {
      const y = baseY + idx * rowGap
      const width = Math.max(8, Math.round(barWidth * item.ratio))

      return `
        <text x="620" y="${y}" class="h3">#${idx + 1} ${escapeXml(item.language)}</text>
        <rect x="${barX}" y="${y - 18}" width="${barWidth}" height="10" rx="5" fill="#E6EDF5"/>
        <rect x="${barX}" y="${y - 18}" width="${width}" height="10" rx="5" fill="#1F2937"/>
        <text x="1340" y="${y}" class="small" text-anchor="end">${toPercent(item.ratio, 1)}</text>
      `
    })
    .join("")
}

function renderMonthlyBars(monthlyContributions) {
  const maxValue = Math.max(...monthlyContributions, 1)
  const baselineY = 960
  const maxHeight = 118
  const startX = 70
  const barWidth = 30
  const gap = 13

  return monthlyContributions
    .map((value, idx) => {
      const height = value > 0 ? Math.max(6, Math.round((value / maxValue) * maxHeight)) : 0
      const x = startX + idx * (barWidth + gap)
      const y = baselineY - height
      const fill = value === maxValue ? "url(#bar)" : "#6EE7B7"

      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="6" fill="${fill}"/>
        <text x="${x + barWidth / 2}" y="976" class="small" text-anchor="middle">${idx + 1}月</text>
      `
    })
    .join("")
}

function renderWeeklyBars(weekdayContributions) {
  const maxValue = Math.max(...weekdayContributions, 1)
  const baselineY = 960
  const maxHeight = 118
  const startX = 770
  const barWidth = 64
  const gap = 16

  return weekdayContributions
    .map((value, idx) => {
      const height = value > 0 ? Math.max(8, Math.round((value / maxValue) * maxHeight)) : 0
      const x = startX + idx * (barWidth + gap)
      const y = baselineY - height
      const fill = value === maxValue ? "url(#bar)" : "#6EE7B7"

      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${height}" rx="6" fill="${fill}"/>
        <text x="${x + barWidth / 2}" y="976" class="small" text-anchor="middle">${WEEKDAY_LABELS[idx]}</text>
      `
    })
    .join("")
}

function renderAiSections(sections) {
  const limited = sections.slice(0, 3)

  return limited
    .map((section, idx) => {
      const titleY = 214 + idx * 82
      const bodyY = 248 + idx * 82

      return `
        <text x="840" y="${titleY}" class="h3">${escapeXml(section.heading)}</text>
        <text x="840" y="${bodyY}" class="small">${escapeXml(truncate(section.content, 74))}</text>
      `
    })
    .join("")
}

function initialsFromLogin(login) {
  if (!login) {
    return "Y"
  }

  return String(login).slice(0, 1).toUpperCase()
}

export function renderYearlyReportSvg(data) {
  const {
    profile,
    year,
    stats,
    issuesCount,
    topRepos,
    topLanguages,
    aiSummary,
  } = data

  const maxMonthText =
    stats.maxContributionsMonth !== null
      ? `${year} 年 ${Number(stats.maxContributionsMonth.slice(5, 7))} 月`
      : `${year} 年 -- 月`

  const mostActiveDayText = stats.maxContributionsDate
    ? formatDateCN(stats.maxContributionsDate)
    : "--"

  const longestStreakRangeText = formatDateRangeCN(
    stats.longestStreakStartDate,
    stats.longestStreakEndDate,
  )

  const longestGapRangeText = formatDateRangeCN(
    stats.longestGapStartDate,
    stats.longestGapEndDate,
  )

  const weekdayPeak = WEEKDAY_LABELS[stats.busiestWeekday] ?? "--"
  const weekdayPeakValue = stats.weekdayContributions[stats.busiestWeekday] ?? 0

  const heatmap = renderHeatmap(stats.heatmapWeeks)
  const monthLabels = renderMonthLabels(stats.heatmapWeeks, year)
  const repoRows = renderRepoRows(topRepos)
  const languageRows = renderLanguageRows(topLanguages)
  const monthlyBars = renderMonthlyBars(stats.monthlyContributions)
  const weeklyBars = renderWeeklyBars(stats.weekdayContributions)
  const aiSections = renderAiSections(aiSummary.sections)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1400" height="980" viewBox="0 0 1400 980" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1400" y2="980" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F6F7FB"/>
      <stop offset="1" stop-color="#EEF1F6"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#34D399"/>
      <stop offset="1" stop-color="#10B981"/>
    </linearGradient>
    <style>
      .title { font: 700 30px 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; fill: #1F2937; }
      .h2 { font: 700 24px 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; fill: #243244; }
      .h3 { font: 700 18px 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; fill: #344256; }
      .p { font: 500 16px 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; fill: #4B5563; }
      .small { font: 500 14px 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; fill: #6B7280; }
      .num { font: 700 44px 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; fill: #111827; }
      .card { fill: #FFFFFF; stroke: #D9E1EB; stroke-width: 2; }
      .badge { fill: #F7FAFC; stroke: #DFE7F2; stroke-width: 1.5; }
      .line { stroke: #E5ECF4; stroke-width: 1; stroke-dasharray: 5 5; }
    </style>
  </defs>

  <rect width="1400" height="980" fill="url(#bg)"/>

  <rect x="24" y="24" width="780" height="360" rx="18" class="card"/>
  <rect x="820" y="24" width="556" height="360" rx="18" class="card"/>

  <rect x="24" y="404" width="440" height="58" rx="14" class="card"/>
  <rect x="480" y="404" width="440" height="58" rx="14" class="card"/>
  <rect x="936" y="404" width="440" height="58" rx="14" class="card"/>

  <rect x="24" y="478" width="440" height="140" rx="14" class="card"/>
  <rect x="480" y="478" width="440" height="140" rx="14" class="card"/>
  <rect x="936" y="478" width="440" height="140" rx="14" class="card"/>

  <rect x="24" y="638" width="560" height="260" rx="14" class="card"/>
  <rect x="600" y="638" width="776" height="260" rx="14" class="card"/>

  <rect x="24" y="914" width="676" height="56" rx="14" class="card"/>
  <rect x="716" y="914" width="660" height="56" rx="14" class="card"/>

  <circle cx="94" cy="112" r="36" fill="#D1FAE5" stroke="#10B981"/>
  <text x="94" y="120" text-anchor="middle" class="h2">${escapeXml(initialsFromLogin(profile.login))}</text>

  <text x="148" y="94" class="title">${escapeXml(profile.name || profile.login)}</text>
  <text x="148" y="128" class="p">@${escapeXml(profile.login)} · ${formatNumber(profile.followers)} 关注者 · ${formatNumber(profile.following)} 关注中</text>
  <text x="148" y="164" class="small">${escapeXml(truncate(profile.bio || "Building useful software with stable cadence.", 58))}</text>

  <text x="742" y="206" class="h3" text-anchor="end">共 ${formatNumber(stats.totalContributions)} 次贡献</text>
  <text x="742" y="234" class="small" text-anchor="end">仅 ${year} 年</text>

  <rect x="58" y="190" width="700" height="170" rx="12" fill="#F8FAFD" stroke="#E3EAF4"/>
  ${monthLabels}
  ${heatmap}

  <text x="840" y="84" class="h2">AI 年度总结</text>
  <text x="840" y="124" class="p">${escapeXml(truncate(aiSummary.intro, 78))}</text>
  <text x="840" y="158" class="small">模式：${aiSummary.mode === "ai" ? "AI 生成" : "规则降级"}</text>
  ${aiSections}

  <text x="44" y="442" class="h3">这一年的高光月份</text>
  <text x="402" y="442" class="h3" text-anchor="end">${escapeXml(maxMonthText)}</text>

  <text x="500" y="442" class="h3">日均贡献</text>
  <text x="900" y="442" class="h3" text-anchor="end">${formatNumber(stats.averageContributionsPerDay)}</text>

  <text x="956" y="442" class="h3">${year} 年碰过的 Issues</text>
  <text x="1356" y="442" class="h3" text-anchor="end">${formatNumber(issuesCount)}</text>

  <text x="44" y="520" class="h3">你最活跃的一天</text>
  <text x="44" y="578" class="num">${formatNumber(stats.maxContributionsInADay)}</text>
  <text x="132" y="578" class="p">次贡献</text>
  <text x="44" y="608" class="p">${escapeXml(mostActiveDayText)}</text>

  <text x="500" y="520" class="h3">最长连续打卡</text>
  <text x="500" y="578" class="num">${formatNumber(stats.longestStreak)}</text>
  <text x="592" y="578" class="p">天</text>
  <text x="500" y="608" class="p">${escapeXml(longestStreakRangeText)}</text>

  <text x="956" y="520" class="h3">休息最久的一段时间</text>
  <text x="956" y="578" class="num">${formatNumber(stats.longestGap)}</text>
  <text x="1018" y="578" class="p">天</text>
  <text x="956" y="608" class="p">${escapeXml(longestGapRangeText)}</text>

  <text x="44" y="680" class="h2">${year} 年你在折腾的仓库</text>
  <rect x="402" y="654" width="80" height="34" rx="10" class="badge"/>
  <text x="442" y="677" class="small" text-anchor="middle">最出圈的</text>
  <rect x="490" y="654" width="80" height="34" rx="10" class="badge"/>
  <text x="530" y="677" class="small" text-anchor="middle">新开的</text>
  ${repoRows}

  <text x="620" y="680" class="h2">${year} 年你最常用的语言</text>
  ${languageRows}

  <text x="44" y="948" class="h3">${year} 一年的起伏轨迹</text>
  <text x="680" y="948" class="small" text-anchor="end">总贡献 ${formatNumber(stats.totalContributions)}</text>
  <line x1="44" y1="960" x2="660" y2="960" class="line"/>
  ${monthlyBars}

  <text x="736" y="948" class="h3">${year} 你一周里的节奏</text>
  <text x="1360" y="948" class="small" text-anchor="end">最忙：星期${weekdayPeak}（${formatNumber(weekdayPeakValue)} 次贡献）</text>
  <line x1="736" y1="960" x2="1344" y2="960" class="line"/>
  ${weeklyBars}
</svg>`
}
