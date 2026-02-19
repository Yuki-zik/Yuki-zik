import test from "node:test"
import assert from "node:assert/strict"

import { deriveYearlyStatistics } from "../stats.mjs"

function toIsoDate(date) {
  return date.toISOString().slice(0, 10)
}

function getContributionLevel(count) {
  if (count <= 0) {
    return "NONE"
  }

  if (count <= 2) {
    return "FIRST_QUARTILE"
  }

  if (count <= 4) {
    return "SECOND_QUARTILE"
  }

  if (count <= 7) {
    return "THIRD_QUARTILE"
  }

  return "FOURTH_QUARTILE"
}

function buildCalendar(year, dayCounts = {}) {
  const days = []
  let cursor = new Date(Date.UTC(year, 0, 1))
  const end = new Date(Date.UTC(year, 11, 31))

  while (cursor <= end) {
    const isoDate = toIsoDate(cursor)
    const count = dayCounts[isoDate] ?? 0

    days.push({
      contributionCount: count,
      contributionLevel: getContributionLevel(count),
      date: isoDate,
      weekday: cursor.getUTCDay(),
    })

    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  const weeks = []
  for (let idx = 0; idx < days.length; idx += 7) {
    weeks.push({ contributionDays: days.slice(idx, idx + 7) })
  }

  return { weeks }
}

test("zero contribution year", () => {
  const year = 2025
  const calendar = buildCalendar(year)

  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: "UTC",
    now: new Date("2026-02-01T00:00:00Z"),
  })

  assert.equal(stats.totalContributions, 0)
  assert.equal(stats.averageContributionsPerDay, 0)
  assert.equal(stats.longestStreak, 0)
  assert.equal(stats.longestGap, 365)
  assert.equal(stats.totalDaysConsidered, 365)
})

test("leap year has 366 considered days", () => {
  const year = 2024
  const dayCounts = {}

  let cursor = new Date(Date.UTC(2024, 0, 1))
  const end = new Date(Date.UTC(2024, 11, 31))
  while (cursor <= end) {
    dayCounts[toIsoDate(cursor)] = 1
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  const calendar = buildCalendar(year, dayCounts)

  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: "UTC",
    now: new Date("2026-01-01T00:00:00Z"),
  })

  assert.equal(stats.totalDaysConsidered, 366)
  assert.equal(stats.totalContributions, 366)
  assert.equal(stats.longestStreak, 366)
})

test("longest streak can cross months", () => {
  const year = 2025
  const calendar = buildCalendar(year, {
    "2025-01-30": 1,
    "2025-01-31": 1,
    "2025-02-01": 1,
    "2025-02-02": 1,
    "2025-02-03": 1,
  })

  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: "UTC",
    now: new Date("2026-01-01T00:00:00Z"),
  })

  assert.equal(stats.longestStreak, 5)
  assert.equal(stats.longestStreakStartDate, "2025-01-30")
  assert.equal(stats.longestStreakEndDate, "2025-02-03")
  assert.equal(stats.maxContributionsMonth, "2025-02")
})

test("future days in current year are ignored", () => {
  const year = 2026
  const calendar = buildCalendar(year, {
    "2026-01-01": 1,
    "2026-12-31": 10,
  })

  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: "UTC",
    now: new Date("2026-01-10T00:00:00Z"),
  })

  assert.equal(stats.totalContributions, 1)
  assert.equal(stats.longestGap, 9)
  assert.equal(stats.longestGapStartDate, "2026-01-02")
  assert.equal(stats.longestGapEndDate, "2026-01-10")
  assert.equal(stats.maxContributionsInADay, 1)
  assert.equal(stats.maxContributionsDate, "2026-01-01")
})

test("decimal precision and active days", () => {
  const year = 2025
  const dayCounts = {}
  let cursor = new Date(Date.UTC(year, 0, 1))
  for (let i = 0; i < 100; i++) {
    dayCounts[toIsoDate(cursor)] = 1
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  const calendar = buildCalendar(year, dayCounts)
  const stats = deriveYearlyStatistics(calendar, {
    year,
    timeZone: "UTC",
    now: new Date("2026-01-01T00:00:00Z"),
  })

  assert.equal(stats.totalContributions, 100)
  assert.equal(stats.activeDays, 100)
  assert.equal(stats.averageContributionsPerDay, 0.3)
})
