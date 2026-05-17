const NUMBER_FORMATTER = new Intl.NumberFormat("en-US")
const CONTROL_CHAR_REGEX = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g

export const CONTRIBUTION_LEVEL_COLORS = {
  NONE: "#E6EDF3",
  FIRST_QUARTILE: "#9BE9A8",
  SECOND_QUARTILE: "#40C463",
  THIRD_QUARTILE: "#30A14E",
  FOURTH_QUARTILE: "#216E39",
  NULL: "#F3F4F6",
}

function sanitizeText(input) {
  return String(input ?? "").replace(CONTROL_CHAR_REGEX, "")
}

export function escapeXml(input) {
  return sanitizeText(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export const escapeHtml = escapeXml

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

function getDateTimePartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })

  const parts = formatter.formatToParts(date)
  const get = (type) => parts.find((item) => item.type === type)?.value

  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
  }
}

export function getUtcIsoForTimeZoneDateStart(isoDate, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)

  if (!match) {
    throw new Error(`Invalid ISO date: ${isoDate}`)
  }

  const [, yearText, monthText, dayText] = match
  const target = Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText), 0, 0, 0)
  let instant = new Date(target)

  for (let idx = 0; idx < 4; idx += 1) {
    const parts = getDateTimePartsInTimeZone(instant, timeZone)
    const localAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
    const delta = localAsUtc - target

    if (delta === 0) {
      break
    }

    instant = new Date(instant.getTime() - delta)
  }

  return instant.toISOString()
}

export function addDaysToIsoDate(isoDate, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)

  if (!match) {
    throw new Error(`Invalid ISO date: ${isoDate}`)
  }

  const [, yearText, monthText, dayText] = match
  const date = new Date(Date.UTC(Number(yearText), Number(monthText) - 1, Number(dayText)))
  date.setUTCDate(date.getUTCDate() + days)

  return date.toISOString().slice(0, 10)
}

export function getTimeZoneDateRangeIso({ startDate, endDate, timeZone }) {
  const nextEndDate = addDaysToIsoDate(endDate, 1)
  const from = getUtcIsoForTimeZoneDateStart(startDate, timeZone)
  const nextEndStart = getUtcIsoForTimeZoneDateStart(nextEndDate, timeZone)
  const to = new Date(new Date(nextEndStart).getTime() - 1).toISOString()

  return { from, to }
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
  const value = sanitizeText(input)

  if (value.length <= maxLength) {
    return value
  }

  return `${value.slice(0, maxLength - 1)}…`
}

export function wrapLines(input, maxChars, maxLines) {
  const text = sanitizeText(input).replace(/\s+/g, " ").trim()

  if (!text) {
    return [""]
  }

  const hardMaxChars = Math.max(1, maxChars)
  const hardMaxLines = Math.max(1, maxLines)
  const maxWidth = hardMaxChars
  const lines = []

  let current = ""
  let currentWidth = 0
  let consumed = 0

  const tokens = text.includes(" ")
    ? text
      .split(" ")
      .filter(Boolean)
      .map((token, idx, arr) => (idx < arr.length - 1 ? `${token} ` : token))
    : [...text]

  for (const token of tokens) {
    const tokenWidth = estimateTextWidth(token, 1)
    consumed += token.length

    if (currentWidth + tokenWidth <= maxWidth || currentWidth === 0) {
      current += token
      currentWidth += tokenWidth
      continue
    }

    lines.push(current.trimEnd())

    if (lines.length >= hardMaxLines) {
      break
    }

    current = token
    currentWidth = tokenWidth
  }

  if (lines.length < hardMaxLines && current) {
    lines.push(current.trimEnd())
  }

  if (consumed < text.length && lines.length > 0) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = truncate(last, Math.max(1, hardMaxChars - 1))
  }

  return lines.slice(0, hardMaxLines)
}

export function estimateTextWidth(input, fontSize = 16) {
  const text = sanitizeText(input)
  let units = 0

  for (const char of text) {
    if (char === " ") {
      units += 0.33
      continue
    }

    if (/[\u0000-\u00ff]/.test(char)) {
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
