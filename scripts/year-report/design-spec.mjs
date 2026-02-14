export const REPORT_DIMENSIONS = Object.freeze({
  width: 1400,
  height: 1220,
  deviceScaleFactor: 2,
})

export const REPORT_TOKENS = Object.freeze({
  margin: 24,
  gap: 16,
  radius: 14,
  topHeight: 360,
  statHeight: 58,
  kpiHeight: 140,
  midHeight: 300,
  chartHeight: 250,
  chartHeaderHeight: 56,
  chartPlotHeight: 140,
  chartAxisHeight: 32,
})

function sectionRect(id, x, y, w, h) {
  return { id, x, y, w, h }
}

export function buildReportLayout() {
  const t = REPORT_TOKENS
  const topY = t.margin
  const statY = topY + t.topHeight + t.gap
  const kpiY = statY + t.statHeight + t.gap
  const midY = kpiY + t.kpiHeight + t.gap
  const chartY = midY + t.midHeight + t.gap

  const layout = {
    canvas: { ...REPORT_DIMENSIONS },
    top: {
      left: sectionRect("top-left", t.margin, topY, 804, t.topHeight),
      right: sectionRect("top-right", 844, topY, 532, t.topHeight),
    },
    stat: {
      cards: [
        sectionRect("stat-0", 24, statY, 440, t.statHeight),
        sectionRect("stat-1", 480, statY, 440, t.statHeight),
        sectionRect("stat-2", 936, statY, 440, t.statHeight),
      ],
    },
    kpi: {
      cards: [
        sectionRect("kpi-0", 24, kpiY, 440, t.kpiHeight),
        sectionRect("kpi-1", 480, kpiY, 440, t.kpiHeight),
        sectionRect("kpi-2", 936, kpiY, 440, t.kpiHeight),
      ],
    },
    mid: {
      left: sectionRect("mid-left", 24, midY, 580, t.midHeight),
      right: sectionRect("mid-right", 620, midY, 756, t.midHeight),
    },
    chart: {
      left: sectionRect("chart-left", 24, chartY, 668, t.chartHeight),
      right: sectionRect("chart-right", 708, chartY, 668, t.chartHeight),
    },
  }

  return layout
}

export function flattenLayoutRects(layout = buildReportLayout()) {
  return [
    layout.top.left,
    layout.top.right,
    ...layout.stat.cards,
    ...layout.kpi.cards,
    layout.mid.left,
    layout.mid.right,
    layout.chart.left,
    layout.chart.right,
  ]
}

export function getChartGeometry(card) {
  const t = REPORT_TOKENS
  const plotX = card.x + 24
  const plotY = card.y + t.chartHeaderHeight + 12
  const plotW = card.w - 48
  const plotH = t.chartPlotHeight
  const axisY = plotY + plotH + t.chartAxisHeight - 6

  return {
    headerX: card.x + 20,
    headerY: card.y + 36,
    plotX,
    plotY,
    plotW,
    plotH,
    plotBottom: plotY + plotH,
    axisY,
  }
}

export function rectsOverlap(a, b, spacing = 0) {
  const ax2 = a.x + a.w + spacing
  const ay2 = a.y + a.h + spacing
  const bx2 = b.x + b.w + spacing
  const by2 = b.y + b.h + spacing

  if (ax2 <= b.x || bx2 <= a.x) {
    return false
  }

  if (ay2 <= b.y || by2 <= a.y) {
    return false
  }

  return true
}
