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

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

const LAYOUT = {
  width: 1400,
  height: 1220,
  margin: 24,
  gap: 16,
  radius: 14,
  topHeight: 360,
  statHeight: 58,
  kpiHeight: 140,
  midHeight: 300,
  chartHeight: 250,
  innerWidth: 1352,
}

function getSections() {
  const topY = LAYOUT.margin
  const statY = topY + LAYOUT.topHeight + LAYOUT.gap
  const kpiY = statY + LAYOUT.statHeight + LAYOUT.gap
  const midY = kpiY + LAYOUT.kpiHeight + LAYOUT.gap
  const chartY = midY + LAYOUT.midHeight + LAYOUT.gap

  return {
    top: {
      y: topY,
      left: { x: LAYOUT.margin, y: topY, w: 804, h: LAYOUT.topHeight },
      right: { x: 844, y: topY, w: 532, h: LAYOUT.topHeight },
    },
    stat: {
      y: statY,
      cards: [
        { x: 24, y: statY, w: 440, h: LAYOUT.statHeight },
        { x: 480, y: statY, w: 440, h: LAYOUT.statHeight },
        { x: 936, y: statY, w: 440, h: LAYOUT.statHeight },
      ],
    },
    kpi: {
      y: kpiY,
      cards: [
        { x: 24, y: kpiY, w: 440, h: LAYOUT.kpiHeight },
        { x: 480, y: kpiY, w: 440, h: LAYOUT.kpiHeight },
        { x: 936, y: kpiY, w: 440, h: LAYOUT.kpiHeight },
      ],
    },
    mid: {
      y: midY,
      left: { x: 24, y: midY, w: 580, h: LAYOUT.midHeight },
      right: { x: 620, y: midY, w: 756, h: LAYOUT.midHeight },
    },
    chart: {
      y: chartY,
      left: { x: 24, y: chartY, w: 668, h: LAYOUT.chartHeight },
      right: { x: 708, y: chartY, w: 668, h: LAYOUT.chartHeight },
    },
  }
}

function initialsFromLogin(login) {
  if (!login) {
    return "Y"
  }

  return String(login).slice(0, 1).toUpperCase()
}

function findMonthFirstWeekIndex(heatmapWeeks, year, month) {
  const monthPrefix = `${year}-${String(month).padStart(2, "0")}-`

  for (let weekIndex = 0; weekIndex < heatmapWeeks.length; weekIndex += 1) {
    const week = heatmapWeeks[weekIndex]

    if (week.days.some((day) => day.date?.startsWith(monthPrefix))) {
      return weekIndex
    }
  }

  return null
}

function renderHeatmapBlock(stats, card, year) {
  const monthY = card.y + 196
  const heatmapX = card.x + 36
  const heatmapY = card.y + 212
  const cell = 10
  const gap = 3
  const weekStep = cell + gap

  const monthLabels = []
  for (let month = 1; month <= 12; month += 1) {
    const weekIndex = findMonthFirstWeekIndex(stats.heatmapWeeks, year, month)
    if (weekIndex === null) {
      continue
    }

    const x = heatmapX + weekIndex * weekStep
    if (x > card.x + card.w - 40) {
      continue
    }

    monthLabels.push(`<text x="${x}" y="${monthY}" class="small">${month}月</text>`)
  }

  const cells = []
  stats.heatmapWeeks.forEach((week, widx) => {
    week.days.forEach((day, didx) => {
      const x = heatmapX + widx * weekStep
      const y = heatmapY + didx * weekStep

      if (x > card.x + card.w - 36) {
        return
      }

      const color = CONTRIBUTION_LEVEL_COLORS[day.level] ?? CONTRIBUTION_LEVEL_COLORS.NONE
      cells.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${color}"/>`)
    })
  })

  return {
    monthLabels: monthLabels.join(""),
    cells: cells.join(""),
    frame: `<rect x="${card.x + 34}" y="${card.y + 168}" width="${card.w - 68}" height="166" rx="12" fill="#F8FAFD" stroke="#E3EAF4"/>`,
  }
}

function renderAiCardText(aiSummary, card) {
  const contentX = card.x + 20
  const lineHeight = 28
  const maxY = card.y + card.h - 24
  const chunks = []

  chunks.push(`<text x="${contentX}" y="${card.y + 62}" class="h2">AI 年度总结</text>`)

  let cursorY = card.y + 100

  const introLines = wrapLines(aiSummary.intro, 32, 2)
  introLines.forEach((line) => {
    chunks.push(`<text x="${contentX}" y="${cursorY}" class="p">${escapeXml(line)}</text>`)
    cursorY += lineHeight
  })

  chunks.push(`<text x="${contentX}" y="${cursorY + 2}" class="small">模式：${aiSummary.mode === "ai" ? "AI 生成" : "规则降级"}</text>`)
  cursorY += 32

  for (const section of aiSummary.sections.slice(0, 3)) {
    const bodyLines = wrapLines(section.content, 32, 2)
    const requiredHeight = lineHeight + bodyLines.length * lineHeight + 14

    if (cursorY + requiredHeight > maxY) {
      break
    }

    chunks.push(`<text x="${contentX}" y="${cursorY + 12}" class="h3">${escapeXml(section.heading)}</text>`)
    cursorY += lineHeight

    bodyLines.forEach((line) => {
      chunks.push(`<text x="${contentX}" y="${cursorY + 6}" class="small">${escapeXml(line)}</text>`)
      cursorY += lineHeight
    })

    cursorY += 10
  }

  return chunks.join("")
}

function renderRepoRows(topRepos, card) {
  const rows = topRepos.slice(0, 3)
  const rowTop = card.y + 96
  const rowGap = 86

  return rows
    .map((repo, idx) => {
      const y = rowTop + idx * rowGap
      const desc = truncate(repo.description || "暂无仓库描述", 24)

      return `
        <text x="${card.x + 20}" y="${y}" class="h3">${escapeXml(repo.nameWithOwner)}</text>
        <text x="${card.x + 20}" y="${y + 28}" class="small">Stars ${formatNumber(repo.stars)} · Fork ${formatNumber(repo.forks)} · Commits ${formatNumber(repo.commits)}</text>
        <text x="${card.x + 20}" y="${y + 56}" class="p">${escapeXml(desc)}</text>
      `
    })
    .join("")
}

function renderLanguageRows(topLanguages, card) {
  const baseY = card.y + 96
  const rowGap = 44
  const barX = card.x + 190
  const barWidth = card.w - 230

  return topLanguages
    .slice(0, 5)
    .map((item, idx) => {
      const y = baseY + idx * rowGap
      const width = Math.max(8, Math.round(barWidth * item.ratio))

      return `
        <text x="${card.x + 20}" y="${y}" class="h3">#${idx + 1} ${escapeXml(item.language)}</text>
        <rect x="${barX}" y="${y - 18}" width="${barWidth}" height="10" rx="5" fill="#E6EDF5"/>
        <rect x="${barX}" y="${y - 18}" width="${width}" height="10" rx="5" fill="#1F2937"/>
        <text x="${card.x + card.w - 20}" y="${y}" class="small" text-anchor="end">${toPercent(item.ratio, 1)}</text>
      `
    })
    .join("")
}

function renderLargeNumberWithUnit({ x, y, value, unit }) {
  const numberText = formatNumber(value)
  const numberWidth = estimateTextWidth(numberText, 44)
  const unitX = Math.round(x + numberWidth + 18)

  return `
    <text x="${x}" y="${y}" class="num">${numberText}</text>
    <text x="${unitX}" y="${y}" class="p">${escapeXml(unit)}</text>
  `
}

function buildChartGeometry(card) {
  const headerTop = card.y + 34
  const plotTop = card.y + 68
  const plotHeight = 140
  const plotBottom = plotTop + plotHeight
  const axisY = card.y + card.h - 16
  const plotX = card.x + 24
  const plotW = card.w - 48

  return {
    headerTop,
    plotTop,
    plotHeight,
    plotBottom,
    axisY,
    plotX,
    plotW,
  }
}

function renderMonthlyChart(card, stats, year) {
  const g = buildChartGeometry(card)
  const maxValue = Math.max(...stats.monthlyContributions, 1)
  const barW = 36
  const gap = (g.plotW - barW * 12) / 11
  const id = "monthlyPlotClip"

  const bars = []
  const labels = []

  stats.monthlyContributions.forEach((value, idx) => {
    const height = value > 0 ? Math.max(6, Math.round((value / maxValue) * g.plotHeight)) : 0
    const x = g.plotX + idx * (barW + gap)
    const y = g.plotBottom - height
    const fill = value === maxValue ? "url(#bar)" : "#6EE7B7"

    bars.push(`<rect x="${x.toFixed(2)}" y="${y}" width="${barW}" height="${height}" rx="6" fill="${fill}"/>`)
    labels.push(`<text x="${(x + barW / 2).toFixed(2)}" y="${g.axisY}" class="small" text-anchor="middle">${idx + 1}月</text>`)
  })

  const grids = [0.25, 0.5, 0.75].map((ratio) => {
    const y = g.plotBottom - Math.round(g.plotHeight * ratio)
    return `<line x1="${g.plotX}" y1="${y}" x2="${g.plotX + g.plotW}" y2="${y}" class="line"/>`
  }).join("")

  return {
    clipDef: `<clipPath id="${id}"><rect x="${g.plotX}" y="${g.plotTop}" width="${g.plotW}" height="${g.plotHeight}" rx="6"/></clipPath>`,
    content: `
      ${grids}
      <g clip-path="url(#${id})">${bars.join("")}</g>
      ${labels.join("")}
    `,
    summary: `<text x="${card.x + card.w - 20}" y="${card.y + 34}" class="small" text-anchor="end">总贡献 ${formatNumber(stats.totalContributions)}</text>`,
  }
}

function renderWeeklyChart(card, stats, year) {
  const g = buildChartGeometry(card)
  const maxValue = Math.max(...stats.weekdayContributions, 1)
  const barW = 70
  const gap = (g.plotW - barW * 7) / 6
  const id = "weeklyPlotClip"

  const bars = []
  const labels = []

  stats.weekdayContributions.forEach((value, idx) => {
    const height = value > 0 ? Math.max(8, Math.round((value / maxValue) * g.plotHeight)) : 0
    const x = g.plotX + idx * (barW + gap)
    const y = g.plotBottom - height
    const fill = value === maxValue ? "url(#bar)" : "#6EE7B7"

    bars.push(`<rect x="${x.toFixed(2)}" y="${y}" width="${barW}" height="${height}" rx="6" fill="${fill}"/>`)
    labels.push(`<text x="${(x + barW / 2).toFixed(2)}" y="${g.axisY}" class="small" text-anchor="middle">${WEEKDAY_LABELS[idx]}</text>`)
  })

  const grids = [0.25, 0.5, 0.75].map((ratio) => {
    const y = g.plotBottom - Math.round(g.plotHeight * ratio)
    return `<line x1="${g.plotX}" y1="${y}" x2="${g.plotX + g.plotW}" y2="${y}" class="line"/>`
  }).join("")

  const peakDay = WEEKDAY_LABELS[stats.busiestWeekday] ?? "--"
  const peakValue = stats.weekdayContributions[stats.busiestWeekday] ?? 0

  return {
    clipDef: `<clipPath id="${id}"><rect x="${g.plotX}" y="${g.plotTop}" width="${g.plotW}" height="${g.plotHeight}" rx="6"/></clipPath>`,
    content: `
      ${grids}
      <g clip-path="url(#${id})">${bars.join("")}</g>
      ${labels.join("")}
    `,
    summary: `<text x="${card.x + card.w - 20}" y="${card.y + 34}" class="small" text-anchor="end">最忙：星期${peakDay}（${formatNumber(peakValue)} 次贡献）</text>`,
  }
}

export function renderYearlyReportSvg(data) {
  const { profile, year, stats, issuesCount, topRepos, topLanguages, aiSummary } = data
  const sections = getSections()

  const maxMonthText =
    stats.maxContributionsMonth !== null
      ? `${year} 年 ${Number(stats.maxContributionsMonth.slice(5, 7))} 月`
      : `${year} 年 -- 月`

  const mostActiveDayText = stats.maxContributionsDate ? formatDateCN(stats.maxContributionsDate) : "--"
  const longestStreakRangeText = formatDateRangeCN(stats.longestStreakStartDate, stats.longestStreakEndDate)
  const longestGapRangeText = formatDateRangeCN(stats.longestGapStartDate, stats.longestGapEndDate)

  const heatmap = renderHeatmapBlock(stats, sections.top.left, year)
  const aiText = renderAiCardText(aiSummary, sections.top.right)
  const repoRows = renderRepoRows(topRepos, sections.mid.left)
  const languageRows = renderLanguageRows(topLanguages, sections.mid.right)

  const monthlyChart = renderMonthlyChart(sections.chart.left, stats, year)
  const weeklyChart = renderWeeklyChart(sections.chart.right, stats, year)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${LAYOUT.width}" height="${LAYOUT.height}" viewBox="0 0 ${LAYOUT.width} ${LAYOUT.height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${LAYOUT.width}" y2="${LAYOUT.height}" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F6F7FB"/>
      <stop offset="1" stop-color="#EEF1F6"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#34D399"/>
      <stop offset="1" stop-color="#10B981"/>
    </linearGradient>
    ${monthlyChart.clipDef}
    ${weeklyChart.clipDef}
    <style>
      .title { font: 700 38px 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif; fill: #1F2937; }
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

  <rect width="${LAYOUT.width}" height="${LAYOUT.height}" fill="url(#bg)"/>

  <rect x="${sections.top.left.x}" y="${sections.top.left.y}" width="${sections.top.left.w}" height="${sections.top.left.h}" rx="18" class="card"/>
  <rect x="${sections.top.right.x}" y="${sections.top.right.y}" width="${sections.top.right.w}" height="${sections.top.right.h}" rx="18" class="card"/>

  <rect x="${sections.stat.cards[0].x}" y="${sections.stat.cards[0].y}" width="${sections.stat.cards[0].w}" height="${sections.stat.cards[0].h}" rx="${LAYOUT.radius}" class="card"/>
  <rect x="${sections.stat.cards[1].x}" y="${sections.stat.cards[1].y}" width="${sections.stat.cards[1].w}" height="${sections.stat.cards[1].h}" rx="${LAYOUT.radius}" class="card"/>
  <rect x="${sections.stat.cards[2].x}" y="${sections.stat.cards[2].y}" width="${sections.stat.cards[2].w}" height="${sections.stat.cards[2].h}" rx="${LAYOUT.radius}" class="card"/>

  <rect x="${sections.kpi.cards[0].x}" y="${sections.kpi.cards[0].y}" width="${sections.kpi.cards[0].w}" height="${sections.kpi.cards[0].h}" rx="${LAYOUT.radius}" class="card"/>
  <rect x="${sections.kpi.cards[1].x}" y="${sections.kpi.cards[1].y}" width="${sections.kpi.cards[1].w}" height="${sections.kpi.cards[1].h}" rx="${LAYOUT.radius}" class="card"/>
  <rect x="${sections.kpi.cards[2].x}" y="${sections.kpi.cards[2].y}" width="${sections.kpi.cards[2].w}" height="${sections.kpi.cards[2].h}" rx="${LAYOUT.radius}" class="card"/>

  <rect x="${sections.mid.left.x}" y="${sections.mid.left.y}" width="${sections.mid.left.w}" height="${sections.mid.left.h}" rx="${LAYOUT.radius}" class="card"/>
  <rect x="${sections.mid.right.x}" y="${sections.mid.right.y}" width="${sections.mid.right.w}" height="${sections.mid.right.h}" rx="${LAYOUT.radius}" class="card"/>

  <rect x="${sections.chart.left.x}" y="${sections.chart.left.y}" width="${sections.chart.left.w}" height="${sections.chart.left.h}" rx="${LAYOUT.radius}" class="card"/>
  <rect x="${sections.chart.right.x}" y="${sections.chart.right.y}" width="${sections.chart.right.w}" height="${sections.chart.right.h}" rx="${LAYOUT.radius}" class="card"/>

  <circle cx="${sections.top.left.x + 72}" cy="${sections.top.left.y + 88}" r="36" fill="#D1FAE5" stroke="#10B981"/>
  <text x="${sections.top.left.x + 72}" y="${sections.top.left.y + 96}" text-anchor="middle" class="h2">${escapeXml(initialsFromLogin(profile.login))}</text>

  <text x="${sections.top.left.x + 128}" y="${sections.top.left.y + 94}" class="title">${escapeXml(profile.name || profile.login)}</text>
  <text x="${sections.top.left.x + 128}" y="${sections.top.left.y + 128}" class="p">@${escapeXml(profile.login)} · ${formatNumber(profile.followers)} 关注者 · ${formatNumber(profile.following)} 关注中</text>
  <text x="${sections.top.left.x + 128}" y="${sections.top.left.y + 164}" class="small">${escapeXml(truncate(profile.bio || "Building useful software with stable cadence.", 58))}</text>

  <text x="${sections.top.left.x + sections.top.left.w - 24}" y="${sections.top.left.y + 206}" class="h3" text-anchor="end">共 ${formatNumber(stats.totalContributions)} 次贡献</text>
  <text x="${sections.top.left.x + sections.top.left.w - 24}" y="${sections.top.left.y + 234}" class="small" text-anchor="end">仅 ${year} 年</text>

  ${heatmap.frame}
  ${heatmap.monthLabels}
  ${heatmap.cells}

  ${aiText}

  <text x="${sections.stat.cards[0].x + 20}" y="${sections.stat.cards[0].y + 38}" class="h3">这一年的高光月份</text>
  <text x="${sections.stat.cards[0].x + sections.stat.cards[0].w - 20}" y="${sections.stat.cards[0].y + 38}" class="h3" text-anchor="end">${escapeXml(maxMonthText)}</text>

  <text x="${sections.stat.cards[1].x + 20}" y="${sections.stat.cards[1].y + 38}" class="h3">日均贡献</text>
  <text x="${sections.stat.cards[1].x + sections.stat.cards[1].w - 20}" y="${sections.stat.cards[1].y + 38}" class="h3" text-anchor="end">${formatNumber(stats.averageContributionsPerDay)}</text>

  <text x="${sections.stat.cards[2].x + 20}" y="${sections.stat.cards[2].y + 38}" class="h3">${year} 年碰过的 Issues</text>
  <text x="${sections.stat.cards[2].x + sections.stat.cards[2].w - 20}" y="${sections.stat.cards[2].y + 38}" class="h3" text-anchor="end">${formatNumber(issuesCount)}</text>

  <text x="${sections.kpi.cards[0].x + 20}" y="${sections.kpi.cards[0].y + 42}" class="h3">你最活跃的一天</text>
  ${renderLargeNumberWithUnit({ x: sections.kpi.cards[0].x + 20, y: sections.kpi.cards[0].y + 98, value: stats.maxContributionsInADay, unit: "次贡献" })}
  <text x="${sections.kpi.cards[0].x + 20}" y="${sections.kpi.cards[0].y + 130}" class="p">${escapeXml(mostActiveDayText)}</text>

  <text x="${sections.kpi.cards[1].x + 20}" y="${sections.kpi.cards[1].y + 42}" class="h3">最长连续打卡</text>
  ${renderLargeNumberWithUnit({ x: sections.kpi.cards[1].x + 20, y: sections.kpi.cards[1].y + 98, value: stats.longestStreak, unit: "天" })}
  <text x="${sections.kpi.cards[1].x + 20}" y="${sections.kpi.cards[1].y + 130}" class="p">${escapeXml(longestStreakRangeText)}</text>

  <text x="${sections.kpi.cards[2].x + 20}" y="${sections.kpi.cards[2].y + 42}" class="h3">休息最久的一段时间</text>
  ${renderLargeNumberWithUnit({ x: sections.kpi.cards[2].x + 20, y: sections.kpi.cards[2].y + 98, value: stats.longestGap, unit: "天" })}
  <text x="${sections.kpi.cards[2].x + 20}" y="${sections.kpi.cards[2].y + 130}" class="p">${escapeXml(longestGapRangeText)}</text>

  <text x="${sections.mid.left.x + 20}" y="${sections.mid.left.y + 46}" class="h2">${year} 年你在折腾的仓库</text>
  <rect x="${sections.mid.left.x + sections.mid.left.w - 160}" y="${sections.mid.left.y + 16}" width="70" height="34" rx="10" class="badge"/>
  <text x="${sections.mid.left.x + sections.mid.left.w - 125}" y="${sections.mid.left.y + 39}" class="small" text-anchor="middle">最出圈的</text>
  <rect x="${sections.mid.left.x + sections.mid.left.w - 82}" y="${sections.mid.left.y + 16}" width="70" height="34" rx="10" class="badge"/>
  <text x="${sections.mid.left.x + sections.mid.left.w - 47}" y="${sections.mid.left.y + 39}" class="small" text-anchor="middle">新开的</text>
  ${repoRows}

  <text x="${sections.mid.right.x + 20}" y="${sections.mid.right.y + 46}" class="h2">${year} 年你最常用的语言</text>
  ${languageRows}

  <text x="${sections.chart.left.x + 20}" y="${sections.chart.left.y + 34}" class="h2">${year} 一年的起伏轨迹</text>
  ${monthlyChart.summary}
  ${monthlyChart.content}

  <text x="${sections.chart.right.x + 20}" y="${sections.chart.right.y + 34}" class="h2">${year} 你一周里的节奏</text>
  ${weeklyChart.summary}
  ${weeklyChart.content}
</svg>`
}
