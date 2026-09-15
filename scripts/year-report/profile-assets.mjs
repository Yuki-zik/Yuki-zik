import { readFile, writeFile } from "node:fs/promises"

const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[char]))

export function renderActivitySummary(snapshot) {
  const s = snapshot.stats
  for (const key of ["totalContributions", "activeDays", "longestStreak"]) {
    if (!Number.isFinite(s?.[key]) || s[key] < 0) throw new Error(`Invalid report metric: ${key}`)
  }
  const date = new Date(snapshot.generatedAt).toISOString().slice(0, 10)
  const label = snapshot.dateRange
    ? `${snapshot.dateRange.start} – ${snapshot.dateRange.end}`
    : "GitHub contribution snapshot"
  const metrics = [["Contributions", s.totalContributions], ["Active days", s.activeDays], ["Longest streak", `${s.longestStreak} days`]]
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="200" viewBox="0 0 420 200" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(snapshot.username)} activity</title>
<desc id="desc">${escapeXml(label)}. Updated ${date} UTC. ${s.totalContributions} contributions; ${s.activeDays} active days; longest streak ${s.longestStreak} days.</desc>
<style>text{font-family:system-ui,-apple-system,Segoe UI,sans-serif;fill:#363636}.heading{fill:#7957d5;font-size:20px;font-weight:600}.muted{fill:#666;font-size:11px}.metric{fill:#7957d5;font-size:23px;font-weight:600}</style>
<rect x="1" y="1" width="418" height="198" rx="8" fill="#fff" stroke="#e4e2e2"/>
<text class="heading" x="22" y="34">Activity summary</text>
<text class="muted" x="22" y="56">${escapeXml(label)}</text>
${metrics.map(([name,value],i) => `<text class="metric" x="${22+i*134}" y="105">${escapeXml(value)}</text><text x="${22+i*134}" y="127" font-size="12">${name}</text>`).join("\n")}
<text class="muted" x="22" y="165">Updated ${date} UTC · API-visible contributions</text>
<text class="muted" x="22" y="183">Generated in this repository; no live widget dependency</text>
</svg>\n`
}

export async function updateReadmeStatus(readmePath, snapshot) {
  const text = await readFile(readmePath, "utf8")
  const start = "<!-- REPORT_STATUS:START -->"
  const end = "<!-- REPORT_STATUS:END -->"
  const from = text.indexOf(start), to = text.indexOf(end)
  if (from < 0 || to < from) throw new Error("README is missing report status markers")
  const range = snapshot.dateRange ? `${snapshot.dateRange.start} → ${snapshot.dateRange.end}` : "see JSON snapshot"
  const status = `\nLast successful refresh: **${snapshot.generatedAt.replace("T", " ").slice(0, 19)} UTC** · Period: **${range}** · AI summary: **${snapshot.aiMode}**.\n`
  await writeFile(readmePath, text.slice(0, from + start.length) + status + text.slice(to), "utf8")
}
