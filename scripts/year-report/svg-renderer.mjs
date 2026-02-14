import { REPORT_DIMENSIONS } from "./design-spec.mjs"
import { escapeXml } from "./utils.mjs"

function toBase64(pngBuffer) {
  if (!pngBuffer || pngBuffer.length === 0) {
    throw new Error("PNG buffer is required to build compatibility SVG")
  }

  return Buffer.from(pngBuffer).toString("base64")
}

export function renderYearlyReportSvg({
  pngBuffer,
  width = REPORT_DIMENSIONS.width,
  height = REPORT_DIMENSIONS.height,
  title = "GitHub Annual Report",
  description = "PNG-backed compatibility SVG for GitHub profile README.",
} = {}) {
  const base64 = toBase64(pngBuffer)
  const safeTitle = escapeXml(title)
  const safeDescription = escapeXml(description)

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${safeTitle}</title>
  <desc id="desc">${safeDescription}</desc>
  <image x="0" y="0" width="${width}" height="${height}" href="data:image/png;base64,${base64}" />
</svg>
`
}
