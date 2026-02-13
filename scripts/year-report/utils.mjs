const NUMBER_FORMATTER = new Intl.NumberFormat("en-US")

export const CONTRIBUTION_LEVEL_COLORS = {
  NONE: "#E6EDF3",
  FIRST_QUARTILE: "#9BE9A8",
  SECOND_QUARTILE: "#40C463",
  THIRD_QUARTILE: "#30A14E",
  FOURTH_QUARTILE: "#216E39",
  NULL: "#F3F4F6",
}

export function escapeXml(input) {
  if (input === null || input === undefined) {
    return ""
  }

  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function formatNumber(value) {
  if (!Number.isFinite(value)) {
    return "0"
  }

  return NUMBER_FORMATTER.format(value)
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

export function toPercent(value, digits = 1) {
  if (!Number.isFinite(value) || value <= 0) {
    return "0.0%"
  }

  return `${(value * 100).toFixed(digits)}%`
}

export function getDatePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })

  const parts = formatter.formatToParts(date)
  const get = (type) => parts.find((item) => item.type === type)?.value

  const year = Number(get("year"))
  const month = Number(get("month"))
  const day = Number(get("day"))

  return {
    year,
    month,
    day,
    isoDate: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  }
}

export function getTodayIsoInTimeZone(timeZone, now = new Date()) {
  return getDatePartsInTimeZone(now, timeZone).isoDate
}

export function monthLabel(monthIndex) {
  return `${monthIndex + 1}月`
}

export function formatDateCN(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return "--"
  }

  const [, month, day] = isoDate.split("-")

  return `${Number(month)} 月 ${Number(day)} 日`
}

export function formatDateRangeCN(startDate, endDate) {
  if (!startDate || !endDate) {
    return "--"
  }

  return `${formatDateCN(startDate)} - ${formatDateCN(endDate)}`
}

export function truncate(input, maxLength) {
  const value = String(input ?? "")

  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1)}…`
}

export function wrapLines(input, maxChars, maxLines) {
  const text = String(input ?? "").replace(/\s+/g, " ").trim()

  if (!text) {
    return [""]
  }

  const hardMaxChars = Math.max(1, maxChars)
  const hardMaxLines = Math.max(1, maxLines)
  const lines = []
  let cursor = 0

  while (cursor < text.length && lines.length < hardMaxLines) {
    const remaining = text.slice(cursor)

    if (remaining.length <= hardMaxChars) {
      lines.push(remaining)
      cursor = text.length
      break
    }

    let cut = hardMaxChars
    const lastSpace = remaining.slice(0, hardMaxChars + 1).lastIndexOf(" ")

    if (lastSpace >= Math.floor(hardMaxChars * 0.5)) {
      cut = lastSpace
    }

    lines.push(remaining.slice(0, cut).trim())
    cursor += cut

    while (text[cursor] === " ") {
      cursor += 1
    }
  }

  if (cursor < text.length && lines.length > 0) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = truncate(last, Math.max(1, hardMaxChars - 1))
  }

  return lines
}

export function estimateTextWidth(input, fontSize = 16) {
  const text = String(input ?? "")
  let units = 0

  for (const char of text) {
    if (/[ -~]/.test(char)) {
      units += 0.56
      continue
    }

    units += 1
  }

  return units * fontSize
}

export function parseCliArgs(argv) {
  const args = {
    year: null,
    dryRun: false,
    noAi: false,
  }

  for (let idx = 0; idx < argv.length; idx += 1) {
    const token = argv[idx]

    if (token === "--year") {
      const value = argv[idx + 1]

      if (!value || !/^\d{4}$/.test(value)) {
        throw new Error("--year must be a 4-digit year")
      }

      args.year = Number(value)
      idx += 1
      continue
    }

    if (token === "--dry-run") {
      args.dryRun = true
      continue
    }

    if (token === "--no-ai") {
      args.noAi = true
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  return args
}
