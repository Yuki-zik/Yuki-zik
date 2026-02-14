export const REPORT_DIMENSIONS = Object.freeze({
  width: 1400,
  height: 1240,
  deviceScaleFactor: 2,
})

export const REPORT_TOKENS = Object.freeze({
  margin: 24,
  gap: 16,
  radius: 14,
  topHeight: 380,
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

function buildGrid() {
  const contentWidth = REPORT_DIMENSIONS.width - REPORT_TOKENS.margin * 2
  const columns = 12
  const columnWidth = (contentWidth - REPORT_TOKENS.gap * (columns - 1)) / columns

  function x(colStart) {
    return Math.round(
      REPORT_TOKENS.margin + (colStart - 1) * (columnWidth + REPORT_TOKENS.gap),
    )
  }

  function w(colSpan) {
    return Math.round(
      colSpan * columnWidth + (colSpan - 1) * REPORT_TOKENS.gap,
    )
  }

  return { x, w }
}

export function buildReportLayout() {
  const t = REPORT_TOKENS
  const grid = buildGrid()
  const topY = t.margin
  const statY = topY + t.topHeight + t.gap
  const kpiY = statY + t.statHeight + t.gap
  const midY = kpiY + t.kpiHeight + t.gap
  const chartY = midY + t.midHeight + t.gap

  const layout = {
    canvas: { ...REPORT_DIMENSIONS },
    top: {
      left: sectionRect("top-left", grid.x(1), topY, grid.w(7), t.topHeight),
      right: sectionRect("top-right", grid.x(8), topY, grid.w(5), t.topHeight),
    },
    stat: {
      cards: [
        sectionRect("stat-0", grid.x(1), statY, grid.w(4), t.statHeight),
        sectionRect("stat-1", grid.x(5), statY, grid.w(4), t.statHeight),
        sectionRect("stat-2", grid.x(9), statY, grid.w(4), t.statHeight),
      ],
    },
    kpi: {
      cards: [
        sectionRect("kpi-0", grid.x(1), kpiY, grid.w(4), t.kpiHeight),
        sectionRect("kpi-1", grid.x(5), kpiY, grid.w(4), t.kpiHeight),
        sectionRect("kpi-2", grid.x(9), kpiY, grid.w(4), t.kpiHeight),
      ],
    },
    mid: {
      left: sectionRect("mid-left", grid.x(1), midY, grid.w(5), t.midHeight),
      right: sectionRect("mid-right", grid.x(6), midY, grid.w(7), t.midHeight),
    },
    chart: {
      left: sectionRect("chart-left", grid.x(1), chartY, grid.w(6), t.chartHeight),
      right: sectionRect("chart-right", grid.x(7), chartY, grid.w(6), t.chartHeight),
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
