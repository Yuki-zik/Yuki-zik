import { deflateSync } from "node:zlib"
import { writeFile } from "node:fs/promises"

import { REPORT_DIMENSIONS } from "./design-spec.mjs"

let crcTable = null

function getCrcTable() {
  if (crcTable) {
    return crcTable
  }

  crcTable = new Uint32Array(256)

  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    crcTable[n] = c >>> 0
  }

  return crcTable
}

function crc32(buffer) {
  const table = getCrcTable()
  let crc = 0xffffffff

  for (let i = 0; i < buffer.length; i += 1) {
    const index = (crc ^ buffer[i]) & 0xff
    crc = table[index] ^ (crc >>> 8)
  }

  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii")
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32BE(data.length, 0)

  const crcBuffer = Buffer.alloc(4)
  const crc = crc32(Buffer.concat([typeBuffer, data]))
  crcBuffer.writeUInt32BE(crc, 0)

  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer])
}

export function createSolidPngBuffer({
  width = REPORT_DIMENSIONS.width,
  height = REPORT_DIMENSIONS.height,
  color = { r: 240, g: 244, b: 250, a: 255 },
} = {}) {
  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47,
    0x0d, 0x0a, 0x1a, 0x0a,
  ])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0 // compression method
  ihdr[11] = 0 // filter method
  ihdr[12] = 0 // interlace

  const rowSize = 1 + width * 4
  const raw = Buffer.alloc(rowSize * height)

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * rowSize
    raw[rowStart] = 0 // no filter

    for (let x = 0; x < width; x += 1) {
      const pixelStart = rowStart + 1 + x * 4
      raw[pixelStart] = color.r
      raw[pixelStart + 1] = color.g
      raw[pixelStart + 2] = color.b
      raw[pixelStart + 3] = color.a
    }
  }

  const idatData = deflateSync(raw, { level: 9 })
  const chunks = [
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idatData),
    pngChunk("IEND", Buffer.alloc(0)),
  ]

  return Buffer.concat([pngSignature, ...chunks])
}

export async function writeFallbackPng(outputPath, dimensions = REPORT_DIMENSIONS) {
  const buffer = createSolidPngBuffer({
    width: dimensions.width,
    height: dimensions.height,
    color: { r: 243, g: 246, b: 251, a: 255 },
  })

  await writeFile(outputPath, buffer)
  return buffer
}

async function loadPlaywrightChromium() {
  try {
    const playwright = await import("playwright")
    return playwright.chromium
  }
  catch {
    const playwrightCore = await import("playwright-core")
    return playwrightCore.chromium
  }
}

export async function renderReportPng({
  html,
  outputPath,
  dimensions = REPORT_DIMENSIONS,
  timeoutMs = 30_000,
} = {}) {
  try {
    const chromium = await loadPlaywrightChromium()
    const browser = await chromium.launch({ headless: true })

    try {
      const page = await browser.newPage({
        viewport: {
          width: dimensions.width,
          height: dimensions.height,
        },
        deviceScaleFactor: dimensions.deviceScaleFactor,
      })

      await page.setContent(html, { waitUntil: "networkidle", timeout: timeoutMs })
      await page.evaluate(async () => {
        await document.fonts.ready
      })

      await page.screenshot({
        type: "png",
        path: outputPath,
        clip: {
          x: 0,
          y: 0,
          width: dimensions.width,
          height: dimensions.height,
        },
      })
    }
    finally {
      await browser.close()
    }

    return {
      mode: "playwright",
      ok: true,
      reason: null,
    }
  }
  catch (error) {
    await writeFallbackPng(outputPath, dimensions)

    return {
      mode: "fallback",
      ok: false,
      reason: error instanceof Error ? error.message : "Unknown Playwright error",
    }
  }
}
