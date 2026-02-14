import test from "node:test"
import assert from "node:assert/strict"

import {
  REPORT_DIMENSIONS,
  buildReportLayout,
  flattenLayoutRects,
  getChartGeometry,
  rectsOverlap,
} from "../design-spec.mjs"

test("layout cards should not overlap", () => {
  const layout = buildReportLayout()
  const rects = flattenLayoutRects(layout)

  for (let i = 0; i < rects.length; i += 1) {
    for (let j = i + 1; j < rects.length; j += 1) {
      assert.equal(
        rectsOverlap(rects[i], rects[j], 0),
        false,
        `${rects[i].id} overlaps ${rects[j].id}`,
      )
    }
  }
})

test("layout cards should stay in canvas bounds", () => {
  const rects = flattenLayoutRects(buildReportLayout())

  for (const rect of rects) {
    assert.ok(rect.x >= 0, `${rect.id} has negative x`)
    assert.ok(rect.y >= 0, `${rect.id} has negative y`)
    assert.ok(rect.x + rect.w <= REPORT_DIMENSIONS.width, `${rect.id} exceeds canvas width`)
    assert.ok(rect.y + rect.h <= REPORT_DIMENSIONS.height, `${rect.id} exceeds canvas height`)
  }
})

test("chart geometry should keep plot area and axis inside card", () => {
  const layout = buildReportLayout()
  const cards = [layout.chart.left, layout.chart.right]

  for (const card of cards) {
    const chart = getChartGeometry(card)

    assert.ok(chart.plotX >= card.x, `${card.id} plotX should be inside card`)
    assert.ok(chart.plotY >= card.y, `${card.id} plotY should be inside card`)
    assert.ok(chart.plotBottom <= card.y + card.h, `${card.id} plotBottom exceeds card`)
    assert.ok(chart.axisY <= card.y + card.h, `${card.id} axis exceeds card`)
  }
})
