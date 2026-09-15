import { deflateSync } from "node:zlib"
import { randomUUID } from "node:crypto"
import { dirname, join } from "node:path"
import { writeFile, readFile, rename, rm } from "node:fs/promises"
import { REPORT_DIMENSIONS } from "./design-spec.mjs"

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function pngChunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([size, name, data, crc])
}
// Test fixtures only. The production renderer never publishes a solid fallback.
export function createSolidPngBuffer({ width = REPORT_DIMENSIONS.width, height = REPORT_DIMENSIONS.height, color = { r: 240, g: 244, b: 250, a: 255 } } = {}) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6
  const rowSize = 1 + width * 4, raw = Buffer.alloc(rowSize * height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * rowSize + 1 + x * 4
    raw[p] = color.r; raw[p + 1] = color.g; raw[p + 2] = color.b; raw[p + 3] = color.a
  }
  return Buffer.concat([SIGNATURE, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(raw)), pngChunk("IEND", Buffer.alloc(0))])
}
export async function writeFallbackPng(outputPath, dimensions = REPORT_DIMENSIONS) {
  const buffer = createSolidPngBuffer({ ...dimensions, color: { r: 243, g: 246, b: 251, a: 255 } })
  await writeFile(outputPath, buffer)
  return buffer
}
async function loadPlaywrightChromium() {
  try { return (await import("playwright")).chromium }
  catch { return (await import("playwright-core")).chromium }
}
export async function renderReportPng({ html, outputPath, dimensions = REPORT_DIMENSIONS, timeoutMs = 30_000, loadChromium = loadPlaywrightChromium } = {}) {
  if (!html || !outputPath) throw new Error("HTML and outputPath are required")
  const temporaryPath = join(dirname(outputPath), `.report-${randomUUID()}.png`)
  let browser
  try {
    const chromium = await loadChromium()
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({ viewport: { width: dimensions.width, height: dimensions.height }, deviceScaleFactor: dimensions.deviceScaleFactor })
    page.setDefaultTimeout(timeoutMs)
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: timeoutMs })
    await page.evaluate(async () => {
      await Promise.race([
        Promise.all([document.fonts.ready, ...Array.from(document.images, img => img.decode().catch(() => {}))]),
        new Promise(resolve => setTimeout(resolve, 5000)),
      ])
      if ((document.body?.innerText || "").trim().length < 20) throw new Error("Report body is empty")
    })
    await page.screenshot({ type: "png", path: temporaryPath, animations: "disabled", timeout: timeoutMs, clip: { x: 0, y: 0, width: dimensions.width, height: dimensions.height } })
    const png = await readFile(temporaryPath)
    const scale = dimensions.deviceScaleFactor || 1
    if (png.length < 33 || !png.subarray(0, 8).equals(SIGNATURE) || png.readUInt32BE(16) !== dimensions.width * scale || png.readUInt32BE(20) !== dimensions.height * scale) {
      throw new Error("PNG dimensions or signature failed validation")
    }
    await browser.close()
    browser = null
    await rename(temporaryPath, outputPath)
    return { mode: "playwright", ok: true, reason: null }
  } catch (error) {
    throw new Error("Report rendering failed; the previous image was preserved", { cause: error })
  } finally {
    if (browser) await browser.close().catch(() => {})
    await rm(temporaryPath, { force: true })
  }
}
