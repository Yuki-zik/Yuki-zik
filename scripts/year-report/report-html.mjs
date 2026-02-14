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
import {
  REPORT_DIMENSIONS,
  buildReportLayout,
  getChartGeometry,
} from "./design-spec.mjs"

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]

function initialsFromLogin(login) {
  if (!login) {
    return "Y"
  }

  return String(login).slice(0, 1).toUpperCase()
}

function ensureMonthly(values) {
  const output = Array.from({ length: 12 }, () => 0)

  values?.slice(0, 12).forEach((value, idx) => {
    output[idx] = Number.isFinite(value) ? value : 0
  })

  return output
}

function ensureWeekly(values) {
  const output = Array.from({ length: 7 }, () => 0)

  values?.slice(0, 7).forEach((value, idx) => {
    output[idx] = Number.isFinite(value) ? value : 0
  })

  return output
}

function findMonthFirstWeekIndex(weeks, year, month) {
  const prefix = `${year}-${String(month).padStart(2, "0")}-`

  for (let i = 0; i < weeks.length; i += 1) {
    const week = weeks[i]
    if (week.days.some((day) => day.date?.startsWith(prefix))) {
      return i
    }
  }

  return null
}

function renderHeatmap(stats, year) {
  const weeks = (stats.heatmapWeeks ?? []).slice(0, 53)
  const cells = []

  weeks.forEach((week, weekIndex) => {
    week.days.slice(0, 7).forEach((day, dayIndex) => {
      const levelKey = day.level && String(day.level).toUpperCase()
      const color = CONTRIBUTION_LEVEL_COLORS[levelKey] ?? CONTRIBUTION_LEVEL_COLORS.NONE

      cells.push(
        `<span class="heat-cell" style="grid-column:${weekIndex + 1};grid-row:${dayIndex + 1};background:${color};"></span>`,
      )
    })
  })

  const labels = []
  for (let month = 1; month <= 12; month += 1) {
    const weekIndex = findMonthFirstWeekIndex(weeks, year, month)
    if (weekIndex === null) {
      continue
    }

    labels.push(
      `<span class="month-label" style="left:${weekIndex * 13}px">${month}月</span>`,
    )
  }

  return `
    <div class="heatmap-wrap">
      <div class="months">${labels.join("")}</div>
      <div class="heatmap-grid">${cells.join("")}</div>
    </div>
  `
}

function renderAiSummary(aiSummary) {
  const sections = Array.isArray(aiSummary?.sections) ? aiSummary.sections.slice(0, 3) : []
  const introLines = wrapLines(aiSummary?.intro ?? "", 32, 2)
  const modeLabel = aiSummary?.mode === "ai" ? "AI 生成" : "规则降级"

  const sectionHtml = sections.map((section) => {
    const bodyLines = wrapLines(section?.content ?? "", 32, 2)
    const heading = escapeXml(section?.heading ?? "分析")
    const body = bodyLines
      .map((line) => `<p class="ai-line">${escapeXml(line)}</p>`)
      .join("")

    return `
      <div class="ai-section">
        <h4>${heading}</h4>
        ${body}
      </div>
    `
  }).join("")

  return `
    <h3 class="ai-title">AI 年度总结</h3>
    <div class="ai-intro">
      ${introLines.map((line) => `<p>${escapeXml(line)}</p>`).join("")}
    </div>
    <p class="ai-mode">模式：${modeLabel}</p>
    ${sectionHtml}
  `
}

function renderRepoRows(repos) {
  return repos.slice(0, 3).map((repo) => {
    const name = escapeXml(repo.nameWithOwner || "暂无仓库数据")
    const desc = escapeXml(truncate(repo.description || "暂无仓库描述", 30))

    return `
      <li class="repo-item">
        <p class="repo-name">${name}</p>
        <p class="repo-meta">Stars ${formatNumber(repo.stars)} · Fork ${formatNumber(repo.forks)} · Commits ${formatNumber(repo.commits)}</p>
        <p class="repo-desc">${desc}</p>
      </li>
    `
  }).join("")
}

function renderLanguageRows(topLanguages) {
  return topLanguages.slice(0, 5).map((item, idx) => {
    const ratio = Math.max(0, Math.min(1, item.ratio ?? 0))

    return `
      <li class="lang-item">
        <p class="lang-label">#${idx + 1} ${escapeXml(item.language || "N/A")}</p>
        <div class="lang-bar-track">
          <span class="lang-bar-fill" style="width:${Math.max(2, Math.round(ratio * 100))}%"></span>
        </div>
        <p class="lang-percent">${toPercent(ratio, 1)}</p>
      </li>
    `
  }).join("")
}

function renderLargeStatValue(value, unit) {
  const numberText = formatNumber(value)
  const numberWidth = estimateTextWidth(numberText, 44)
  const unitOffset = Math.round(numberWidth + 18)

  return `
    <div class="kpi-value-wrap">
      <span class="kpi-value">${numberText}</span>
      <span class="kpi-unit" style="margin-left:${Math.max(10, unitOffset - numberWidth)}px">${escapeXml(unit)}</span>
    </div>
  `
}

function renderMonthlyBars(card, stats) {
  const geometry = getChartGeometry(card)
  const monthly = ensureMonthly(stats.monthlyContributions)
  const maxValue = Math.max(...monthly, 1)
  const barWidth = 36
  const gap = (geometry.plotW - barWidth * 12) / 11

  const bars = monthly.map((value, idx) => {
    const height = value > 0 ? Math.max(6, Math.round((value / maxValue) * geometry.plotH)) : 0
    const x = idx * (barWidth + gap)
    const y = geometry.plotH - height
    const isMax = value === maxValue && maxValue > 0

    return `<span class="bar ${isMax ? "max" : ""}" style="left:${x.toFixed(2)}px;top:${y}px;width:${barWidth}px;height:${height}px"></span>`
  }).join("")

  const labels = monthly.map((_, idx) => {
    const x = idx * (barWidth + gap) + (barWidth / 2)
    return `<span class="axis-label" style="left:${x.toFixed(2)}px">${idx + 1}月</span>`
  }).join("")

  const guide = [0.25, 0.5, 0.75].map((ratio) => {
    const y = Math.round(geometry.plotH * ratio)
    return `<span class="plot-guide" style="top:${y}px"></span>`
  }).join("")

  return {
    summary: `总贡献 ${formatNumber(stats.totalContributions)}`,
    plot: `
      <div class="plot-area" style="left:${geometry.plotX - card.x}px;top:${geometry.plotY - card.y}px;width:${geometry.plotW}px;height:${geometry.plotH}px">
        ${guide}
        ${bars}
      </div>
      <div class="axis-row" style="left:${geometry.plotX - card.x}px;top:${geometry.plotBottom - card.y + 4}px;width:${geometry.plotW}px">
        ${labels}
      </div>
    `,
  }
}

function renderWeeklyBars(card, stats) {
  const geometry = getChartGeometry(card)
  const weekly = ensureWeekly(stats.weekdayContributions)
  const maxValue = Math.max(...weekly, 1)
  const barWidth = 70
  const gap = (geometry.plotW - barWidth * 7) / 6

  const bars = weekly.map((value, idx) => {
    const height = value > 0 ? Math.max(8, Math.round((value / maxValue) * geometry.plotH)) : 0
    const x = idx * (barWidth + gap)
    const y = geometry.plotH - height
    const isMax = value === maxValue && maxValue > 0

    return `<span class="bar ${isMax ? "max" : ""}" style="left:${x.toFixed(2)}px;top:${y}px;width:${barWidth}px;height:${height}px"></span>`
  }).join("")

  const labels = weekly.map((_, idx) => {
    const x = idx * (barWidth + gap) + (barWidth / 2)
    return `<span class="axis-label" style="left:${x.toFixed(2)}px">${WEEKDAY_LABELS[idx]}</span>`
  }).join("")

  const guide = [0.25, 0.5, 0.75].map((ratio) => {
    const y = Math.round(geometry.plotH * ratio)
    return `<span class="plot-guide" style="top:${y}px"></span>`
  }).join("")

  const peakDay = WEEKDAY_LABELS[stats.busiestWeekday] ?? "--"
  const peakValue = weekly[stats.busiestWeekday] ?? 0

  return {
    summary: `最忙：星期${peakDay}（${formatNumber(peakValue)} 次贡献）`,
    plot: `
      <div class="plot-area" style="left:${geometry.plotX - card.x}px;top:${geometry.plotY - card.y}px;width:${geometry.plotW}px;height:${geometry.plotH}px">
        ${guide}
        ${bars}
      </div>
      <div class="axis-row" style="left:${geometry.plotX - card.x}px;top:${geometry.plotBottom - card.y + 4}px;width:${geometry.plotW}px">
        ${labels}
      </div>
    `,
  }
}

export function renderReportHtml(reportModel) {
  const { profile, year, stats, issuesCount, topRepos, topLanguages, aiSummary } = reportModel
  const layout = buildReportLayout()

  const maxMonthText = stats.maxContributionsMonth
    ? `${year} 年 ${Number(stats.maxContributionsMonth.slice(5, 7))} 月`
    : `${year} 年 -- 月`
  const mostActiveDayText = stats.maxContributionsDate ? formatDateCN(stats.maxContributionsDate) : "--"
  const longestStreakRangeText = formatDateRangeCN(stats.longestStreakStartDate, stats.longestStreakEndDate)
  const longestGapRangeText = formatDateRangeCN(stats.longestGapStartDate, stats.longestGapEndDate)

  const monthly = renderMonthlyBars(layout.chart.left, stats)
  const weekly = renderWeeklyBars(layout.chart.right, stats)

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeXml(profile.login)} ${year} 年报</title>
    <style>
      @font-face {
        font-family: 'Noto Sans SC';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.0.23/files/noto-sans-sc-chinese-simplified-400-normal.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Noto Sans SC';
        font-style: normal;
        font-weight: 500;
        font-display: swap;
        src: url('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.0.23/files/noto-sans-sc-chinese-simplified-500-normal.woff2') format('woff2');
      }
      @font-face {
        font-family: 'Noto Sans SC';
        font-style: normal;
        font-weight: 700;
        font-display: swap;
        src: url('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.0.23/files/noto-sans-sc-chinese-simplified-700-normal.woff2') format('woff2');
      }
      :root {
        color-scheme: light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        width: ${REPORT_DIMENSIONS.width}px;
        height: ${REPORT_DIMENSIONS.height}px;
        overflow: hidden;
        background: linear-gradient(180deg, #f6f8fb 0%, #eef2f6 100%);
        color: #243244;
        font-family: 'Noto Sans SC', 'Segoe UI', 'Microsoft YaHei', sans-serif;
      }
      .canvas {
        position: relative;
        width: 100%;
        height: 100%;
      }
      .card {
        position: absolute;
        border-radius: 14px;
        border: 1px solid rgba(90, 110, 140, 0.22);
        box-shadow:
          inset 0 0 0 1px rgba(255, 255, 255, 0.95),
          inset 0 0 0 2px rgba(211, 221, 235, 0.9);
        background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(249,252,255,.92));
        overflow: hidden;
      }
      .title {
        margin: 0;
        font-size: 38px;
        line-height: 1.06;
        font-weight: 700;
        color: #111827;
      }
      .section-title {
        margin: 0;
        font-size: 24px;
        line-height: 1.15;
        font-weight: 700;
        color: #10213b;
      }
      .text-p {
        margin: 0;
        font-size: 16px;
        line-height: 1.45;
        font-weight: 500;
        color: #48556a;
      }
      .text-sm {
        margin: 0;
        font-size: 14px;
        line-height: 1.4;
        font-weight: 500;
        color: #5e6a7c;
      }
      .profile {
        padding: 20px 22px;
      }
      .safari {
        position: relative;
        height: 48px;
        margin-bottom: 16px;
        border-radius: 14px;
        border: 1px solid rgba(140, 156, 180, 0.25);
        background: rgba(248, 251, 255, 0.85);
        display: flex;
        align-items: center;
        padding: 0 16px;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        margin-right: 7px;
      }
      .addr {
        margin-left: 14px;
        margin-right: 14px;
        flex: 1;
        border-radius: 10px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 1px solid rgba(128,145,170,.25);
        color: #657186;
        font-size: 16px;
      }
      .profile-head {
        display: flex;
        align-items: flex-start;
      }
      .avatar {
        width: 78px;
        height: 78px;
        border-radius: 999px;
        border: 2px solid #8bd4b0;
        background: #d2f6e3;
        overflow: hidden;
        flex: none;
      }
      .avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .avatar-fallback {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 36px;
        font-weight: 700;
        color: #1f2c42;
      }
      .profile-meta {
        margin-left: 16px;
        min-width: 0;
        flex: 1;
      }
      .name {
        margin: 0;
        font-size: 52px;
        line-height: 1.1;
        font-weight: 700;
        color: #131f35;
      }
      .profile-actions {
        width: 210px;
        text-align: right;
      }
      .contrib-main {
        margin: 90px 0 0;
        font-size: 30px;
        line-height: 1.15;
        font-weight: 700;
      }
      .contrib-sub {
        margin: 8px 0 0;
        font-size: 14px;
        color: #68758b;
      }
      .heatmap-wrap {
        margin-top: 14px;
        border-radius: 12px;
        border: 1px solid rgba(151,168,194,.28);
        background: #f8fbfe;
        padding: 10px 12px 12px;
      }
      .months {
        position: relative;
        height: 24px;
      }
      .month-label {
        position: absolute;
        top: 0;
        font-size: 14px;
        color: #6f7b8f;
        transform: translateX(-2px);
      }
      .heatmap-grid {
        display: grid;
        grid-template-columns: repeat(53, 10px);
        grid-template-rows: repeat(7, 10px);
        gap: 3px;
      }
      .heat-cell {
        display: block;
        border-radius: 2px;
      }
      .ai-card {
        padding: 20px 20px 16px;
      }
      .ai-title {
        margin: 0 0 10px;
        font-size: 24px;
        line-height: 1.2;
        font-weight: 700;
      }
      .ai-intro p {
        margin: 0;
        font-size: 16px;
        line-height: 1.45;
        color: #405169;
      }
      .ai-mode {
        margin: 8px 0 10px;
        font-size: 14px;
        color: #6a758a;
      }
      .ai-section {
        margin-bottom: 10px;
      }
      .ai-section h4 {
        margin: 0 0 2px;
        font-size: 18px;
        line-height: 1.3;
        color: #1f2f48;
      }
      .ai-line {
        margin: 0;
        font-size: 14px;
        line-height: 1.45;
        color: #4a576a;
      }
      .stat-row {
        height: 100%;
        padding: 0 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .stat-row .label {
        font-size: 18px;
        line-height: 1;
        font-weight: 700;
        color: #1c2f49;
      }
      .stat-row .value {
        font-size: 18px;
        line-height: 1;
        font-weight: 700;
        color: #1b2a41;
      }
      .kpi {
        padding: 16px 20px 14px;
        display: flex;
        flex-direction: column;
      }
      .kpi h4 {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
        font-weight: 700;
        color: #162845;
      }
      .kpi-value-wrap {
        margin-top: 8px;
        display: flex;
        align-items: baseline;
      }
      .kpi-value {
        font-size: 44px;
        line-height: 1;
        font-weight: 700;
        color: #101b2f;
      }
      .kpi-unit {
        font-size: 16px;
        color: #445469;
      }
      .kpi-date {
        margin-top: auto;
        font-size: 14px;
        line-height: 1.2;
        color: #33455f;
      }
      .repo-card {
        padding: 16px 20px;
      }
      .repo-head {
        display: flex;
        align-items: center;
      }
      .repo-head h3 {
        margin: 0;
        font-size: 18px;
        line-height: 1.15;
        font-weight: 700;
        color: #132846;
      }
      .badge {
        margin-left: 8px;
        border-radius: 10px;
        border: 1px solid rgba(170,183,206,.55);
        background: rgba(245, 249, 255, .9);
        padding: 5px 10px;
        font-size: 14px;
        color: #5b6778;
      }
      .repo-list {
        margin: 14px 0 0;
        padding: 0;
        list-style: none;
      }
      .repo-item {
        margin-bottom: 8px;
      }
      .repo-name {
        margin: 0;
        font-size: 18px;
        line-height: 1.2;
        color: #1b2e4b;
        font-weight: 700;
      }
      .repo-meta {
        margin: 2px 0 0;
        font-size: 14px;
        color: #5f6c7e;
      }
      .repo-desc {
        margin: 2px 0 0;
        font-size: 14px;
        color: #5b6877;
      }
      .lang-card {
        padding: 16px 20px;
      }
      .lang-card h3 {
        margin: 0;
        font-size: 18px;
        line-height: 1.15;
        font-weight: 700;
        color: #152a48;
      }
      .lang-list {
        margin: 14px 0 0;
        padding: 0;
        list-style: none;
      }
      .lang-item {
        display: grid;
        grid-template-columns: 150px 1fr 72px;
        align-items: center;
        column-gap: 12px;
        margin-bottom: 6px;
      }
      .lang-label {
        margin: 0;
        font-size: 16px;
        color: #1f2f4b;
        font-weight: 700;
      }
      .lang-bar-track {
        position: relative;
        width: 100%;
        height: 10px;
        border-radius: 999px;
        background: #dfe7f2;
      }
      .lang-bar-fill {
        display: block;
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        border-radius: 999px;
        background: #1f2f45;
      }
      .lang-percent {
        margin: 0;
        font-size: 14px;
        text-align: right;
        color: #586576;
      }
      .chart-card {
        padding: 0;
      }
      .chart-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 20px 0;
      }
      .chart-head h3 {
        margin: 0;
        font-size: 18px;
        line-height: 1.18;
        font-weight: 700;
        color: #152847;
      }
      .chart-summary {
        margin-left: 12px;
        font-size: 14px;
        color: #4f5e75;
        white-space: nowrap;
      }
      .plot-area {
        position: absolute;
        overflow: hidden;
      }
      .plot-guide {
        position: absolute;
        left: 0;
        right: 0;
        height: 0;
        border-top: 1px dashed #d8e1ee;
      }
      .bar {
        position: absolute;
        border-radius: 6px 6px 0 0;
        background: #7fddb7;
      }
      .bar.max {
        background: linear-gradient(180deg, #34d399, #10b981);
      }
      .axis-row {
        position: absolute;
        height: 28px;
      }
      .axis-label {
        position: absolute;
        top: 0;
        transform: translateX(-50%);
        font-size: 14px;
        color: #5f6c7d;
        white-space: nowrap;
      }
    </style>
  </head>
  <body>
    <div class="canvas">
      <section class="card profile" style="left:${layout.top.left.x}px;top:${layout.top.left.y}px;width:${layout.top.left.w}px;height:${layout.top.left.h}px">
        <div class="safari">
          <span class="dot" style="background:#ee6959"></span>
          <span class="dot" style="background:#f1be50"></span>
          <span class="dot" style="background:#63c454"></span>
          <div class="addr">github.com/${escapeXml(profile.login)}</div>
        </div>
        <div class="profile-head">
          <div class="avatar">
            ${profile.avatarUrl
              ? `<img src="${escapeXml(profile.avatarUrl)}" alt="${escapeXml(profile.login)} avatar" />`
              : `<div class="avatar-fallback">${escapeXml(initialsFromLogin(profile.login))}</div>`}
          </div>
          <div class="profile-meta">
            <h2 class="name">${escapeXml(profile.name || profile.login)}</h2>
            <p class="text-p">@${escapeXml(profile.login)} · ${formatNumber(profile.followers)} 关注者 · ${formatNumber(profile.following)} 关注中</p>
            <p class="text-sm">${escapeXml(truncate(profile.bio || "Building useful software with stable cadence.", 56))}</p>
          </div>
          <div class="profile-actions">
            <p class="contrib-main">共 ${formatNumber(stats.totalContributions)} 次贡献</p>
            <p class="contrib-sub">仅 ${year} 年</p>
          </div>
        </div>
        ${renderHeatmap(stats, year)}
      </section>

      <section class="card ai-card" style="left:${layout.top.right.x}px;top:${layout.top.right.y}px;width:${layout.top.right.w}px;height:${layout.top.right.h}px">
        ${renderAiSummary(aiSummary)}
      </section>

      <section class="card" style="left:${layout.stat.cards[0].x}px;top:${layout.stat.cards[0].y}px;width:${layout.stat.cards[0].w}px;height:${layout.stat.cards[0].h}px">
        <div class="stat-row"><span class="label">这一年的高光月份</span><span class="value">${escapeXml(maxMonthText)}</span></div>
      </section>
      <section class="card" style="left:${layout.stat.cards[1].x}px;top:${layout.stat.cards[1].y}px;width:${layout.stat.cards[1].w}px;height:${layout.stat.cards[1].h}px">
        <div class="stat-row"><span class="label">日均贡献</span><span class="value">${formatNumber(stats.averageContributionsPerDay)}</span></div>
      </section>
      <section class="card" style="left:${layout.stat.cards[2].x}px;top:${layout.stat.cards[2].y}px;width:${layout.stat.cards[2].w}px;height:${layout.stat.cards[2].h}px">
        <div class="stat-row"><span class="label">${year} 年碰过的 Issues</span><span class="value">${formatNumber(issuesCount)}</span></div>
      </section>

      <section class="card kpi" style="left:${layout.kpi.cards[0].x}px;top:${layout.kpi.cards[0].y}px;width:${layout.kpi.cards[0].w}px;height:${layout.kpi.cards[0].h}px">
        <h4>你最活跃的一天</h4>
        ${renderLargeStatValue(stats.maxContributionsInADay, "次贡献")}
        <p class="kpi-date">${escapeXml(mostActiveDayText)}</p>
      </section>
      <section class="card kpi" style="left:${layout.kpi.cards[1].x}px;top:${layout.kpi.cards[1].y}px;width:${layout.kpi.cards[1].w}px;height:${layout.kpi.cards[1].h}px">
        <h4>最长连续打卡</h4>
        ${renderLargeStatValue(stats.longestStreak, "天")}
        <p class="kpi-date">${escapeXml(longestStreakRangeText)}</p>
      </section>
      <section class="card kpi" style="left:${layout.kpi.cards[2].x}px;top:${layout.kpi.cards[2].y}px;width:${layout.kpi.cards[2].w}px;height:${layout.kpi.cards[2].h}px">
        <h4>休息最久的一段时间</h4>
        ${renderLargeStatValue(stats.longestGap, "天")}
        <p class="kpi-date">${escapeXml(longestGapRangeText)}</p>
      </section>

      <section class="card repo-card" style="left:${layout.mid.left.x}px;top:${layout.mid.left.y}px;width:${layout.mid.left.w}px;height:${layout.mid.left.h}px">
        <div class="repo-head">
          <h3>${year} 年你在折腾的仓库</h3>
          <span class="badge">最出圈的</span>
          <span class="badge">新开的</span>
        </div>
        <ul class="repo-list">${renderRepoRows(topRepos)}</ul>
      </section>

      <section class="card lang-card" style="left:${layout.mid.right.x}px;top:${layout.mid.right.y}px;width:${layout.mid.right.w}px;height:${layout.mid.right.h}px">
        <h3>${year} 年你最常用的语言</h3>
        <ul class="lang-list">${renderLanguageRows(topLanguages)}</ul>
      </section>

      <section class="card chart-card" style="left:${layout.chart.left.x}px;top:${layout.chart.left.y}px;width:${layout.chart.left.w}px;height:${layout.chart.left.h}px">
        <div class="chart-head">
          <h3>${year} 一年的起伏轨迹</h3>
          <p class="chart-summary">${escapeXml(monthly.summary)}</p>
        </div>
        ${monthly.plot}
      </section>

      <section class="card chart-card" style="left:${layout.chart.right.x}px;top:${layout.chart.right.y}px;width:${layout.chart.right.w}px;height:${layout.chart.right.h}px">
        <div class="chart-head">
          <h3>${year} 你一周里的节奏</h3>
          <p class="chart-summary">${escapeXml(weekly.summary)}</p>
        </div>
        ${weekly.plot}
      </section>
    </div>
  </body>
</html>`
}
