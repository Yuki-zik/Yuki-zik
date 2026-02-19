import { getDatePartsInTimeZone, getTodayIsoInTimeZone } from "./utils.mjs"

function isSameYear(dateString, year) {
  return typeof dateString === "string" && dateString.startsWith(`${year}-`)
}

function shouldIncludeDay(day, { year, currentYear, todayIso, dateRange }) {
  if (dateRange) {
    return day.date >= dateRange.start && day.date <= dateRange.end
  }

  if (!isSameYear(day.date, year)) {
    return false
  }

  if (year !== currentYear) {
    return true
  }

  return day.date <= todayIso
}

export function buildHeatmapWeeks(calendar, options) {
  const { year, timeZone, now = new Date(), dateRange } = options
  const { year: currentYear } = getDatePartsInTimeZone(now, timeZone)
  const todayIso = getTodayIsoInTimeZone(timeZone, now)

  const weeks = calendar?.weeks ?? []

  return weeks.map((week) => {
    const days = week.contributionDays ?? week.days ?? []

    return {
      days: days.map((day) => {
        const included = shouldIncludeDay(day, { year, currentYear, todayIso, dateRange })

        return {
          date: day.date,
          count: included ? day.contributionCount ?? day.count ?? 0 : 0,
          level: included ? day.contributionLevel ?? day.level ?? "NONE" : "NULL",
          weekday: day.weekday,
          included,
        }
      }),
    }
  })
}

export function deriveYearlyStatistics(calendar, options) {
  const { year, timeZone, now = new Date(), dateRange } = options
  const heatmapWeeks = buildHeatmapWeeks(calendar, { year, timeZone, now, dateRange })

  let totalContributions = 0
  let totalDaysConsidered = 0
  let activeDays = 0

  let longestStreak = 0
  let currentStreak = 0
  let currentStreakStartDate = null
  let longestStreakStartDate = null
  let longestStreakEndDate = null

  let longestGap = 0
  let currentGap = 0
  let currentGapStartDate = null
  let longestGapStartDate = null
  let longestGapEndDate = null

  let maxContributionsInADay = 0
  let maxContributionsDate = null

  const monthlyContributions = Array.from({ length: 12 }, () => 0)
  const weekdayContributions = Array.from({ length: 7 }, () => 0)

  for (const week of heatmapWeeks) {
    for (const day of week.days) {
      if (!day.included) {
        continue
      }

      totalDaysConsidered += 1

      const count = day.count
      const hasContribution = count > 0

      totalContributions += count
      if (hasContribution) {
        activeDays += 1
      }
      weekdayContributions[day.weekday] += count

      const monthIndex = Number(day.date.slice(5, 7)) - 1
      if (monthIndex >= 0 && monthIndex < 12) {
        monthlyContributions[monthIndex] += count
      }

      if (hasContribution && count > maxContributionsInADay) {
        maxContributionsInADay = count
        maxContributionsDate = day.date
      }

      if (hasContribution) {
        if (currentStreak === 0) {
          currentStreakStartDate = day.date
        }

        currentStreak += 1

        if (currentStreak > longestStreak) {
          longestStreak = currentStreak
          longestStreakStartDate = currentStreakStartDate
          longestStreakEndDate = day.date
        }

        currentGap = 0
        currentGapStartDate = null
      }
      else {
        if (currentGap === 0) {
          currentGapStartDate = day.date
        }

        currentGap += 1

        if (currentGap > longestGap) {
          longestGap = currentGap
          longestGapStartDate = currentGapStartDate
          longestGapEndDate = day.date
        }

        currentStreak = 0
        currentStreakStartDate = null
      }
    }
  }

  let maxContributionsMonth = null
  let maxMonthlyContributions = 0

  monthlyContributions.forEach((value, index) => {
    if (value > maxMonthlyContributions) {
      maxMonthlyContributions = value
      maxContributionsMonth = `${year}-${String(index + 1).padStart(2, "0")}`
    }
  })

  const averageContributionsPerDay =
    totalDaysConsidered > 0
      ? Math.round((totalContributions / totalDaysConsidered) * 10) / 10
      : 0

  let busiestWeekday = 0
  let busiestWeekdayValue = -1

  weekdayContributions.forEach((value, weekday) => {
    if (value > busiestWeekdayValue) {
      busiestWeekdayValue = value
      busiestWeekday = weekday
    }
  })

  return {
    totalContributions,
    totalDaysConsidered,
    activeDays,
    averageContributionsPerDay,
    maxContributionsInADay,
    maxContributionsDate,
    longestStreak,
    longestStreakStartDate,
    longestStreakEndDate,
    longestGap,
    longestGapStartDate,
    longestGapEndDate,
    maxContributionsMonth,
    maxMonthlyContributions,
    monthlyContributions,
    weekdayContributions,
    busiestWeekday,
    heatmapWeeks,
  }
}

export function deriveTopRepositories(commitContributionsByRepository, limit = 3) {
  const rows = Array.isArray(commitContributionsByRepository)
    ? commitContributionsByRepository
    : []

  const repos = rows
    .map((item) => {
      const repo = item.repository

      if (!repo) {
        return null
      }

      return {
        nameWithOwner: repo.nameWithOwner,
        url: repo.url,
        description: repo.description ?? "",
        stars: repo.stargazerCount ?? 0,
        forks: repo.forkCount ?? 0,
        commits: item.contributions?.totalCount ?? 0,
      }
    })
    .filter(Boolean)

  repos.sort((a, b) => {
    if (b.commits !== a.commits) {
      return b.commits - a.commits
    }

    if (b.stars !== a.stars) {
      return b.stars - a.stars
    }

    return a.nameWithOwner.localeCompare(b.nameWithOwner)
  })

  return repos.slice(0, limit)
}

export function deriveTopLanguages(commitContributionsByRepository, limit = 5) {
  const rows = Array.isArray(commitContributionsByRepository)
    ? commitContributionsByRepository
    : []

  const languageBytes = new Map()
  let totalBytes = 0

  for (const row of rows) {
    const edges = row.repository?.languages?.edges

    if (!Array.isArray(edges)) {
      continue
    }

    for (const edge of edges) {
      const language = edge?.node?.name
      const size = edge?.size ?? 0

      if (!language || size <= 0) {
        continue
      }

      const existing = languageBytes.get(language) ?? 0
      languageBytes.set(language, existing + size)
      totalBytes += size
    }
  }

  const items = Array.from(languageBytes.entries()).map(([language, bytes]) => {
    return {
      language,
      bytes,
      ratio: totalBytes > 0 ? bytes / totalBytes : 0,
    }
  })

  items.sort((a, b) => {
    if (b.bytes !== a.bytes) {
      return b.bytes - a.bytes
    }

    return a.language.localeCompare(b.language)
  })

  return items.slice(0, limit)
}
