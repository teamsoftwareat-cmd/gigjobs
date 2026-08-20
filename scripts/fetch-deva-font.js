import https from 'https'
import fs from 'fs'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = path.resolve(__dirname, '..', 'public', 'fonts')
const outPath = path.join(outDir, 'NotoSansDevanagari-Regular.ttf')
const url = 'https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansDevanagari/NotoSansDevanagari-Regular.ttf'

async function ensureDir(path) {
  return fs.promises.mkdir(path, { recursive: true })
}

async function download() {
  try {
    await ensureDir(outDir)
    console.log('Downloading Devanagari font to', outPath)
    const file = fs.createWriteStream(outPath)
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        console.error('Failed to download font, status:', res.statusCode)
        process.exit(1)
      }
      res.pipe(file)
      file.on('finish', () => {
        file.close()
        console.log('Font downloaded successfully')
      })
    }).on('error', (err) => {
      fs.unlink(outPath, () => {})
      console.error('Download error:', err.message)
      process.exit(1)
    })
  } catch (e) {
    console.error('Error:', e)
    process.exit(1)
  }
}

download()
