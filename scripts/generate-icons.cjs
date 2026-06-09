/*
 * Syncs the app icon: copies the source RLA_icon.png (512x512) into
 * build/icon.png, which electron-builder uses to auto-generate the platform
 * .ico (Windows) and .icns (macOS) at package time.
 *
 * Run after changing the source image: node scripts/generate-icons.cjs
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SRC = path.join(ROOT, 'RLA_icon.png')
const OUT = path.join(ROOT, 'build', 'icon.png')

if (!fs.existsSync(SRC)) {
  console.error(`Source icon not found: ${SRC}`)
  process.exit(1)
}

// Sanity-check it's a >=256px PNG (electron-builder's minimum for conversion).
const buf = fs.readFileSync(SRC)
const isPng = buf.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
const width = isPng ? buf.readUInt32BE(16) : 0
const height = isPng ? buf.readUInt32BE(20) : 0
if (!isPng || width < 256 || height < 256) {
  console.error(`RLA_icon.png must be a PNG of at least 256x256 (got ${width}x${height}).`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.copyFileSync(SRC, OUT)
console.log(`Synced build/icon.png from RLA_icon.png (${width}x${height}).`)
