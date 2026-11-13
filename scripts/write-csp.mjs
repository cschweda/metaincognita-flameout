// Writes the Content-Security-Policy into dist/_headers after `nuxt build`.
//
// Why a script and not a line in netlify.toml: the policy allows inline
// scripts by sha256 instead of 'unsafe-inline', and the hashes are only
// knowable once the HTML exists. Nuxt emits a handful of inline scripts (the
// color-mode bootstrap, `window.__NUXT__` config, the /game splash) and the
// config one embeds a fresh build id on every build.
//
// If a page ever gains an inline script this misses, the browser refuses to
// run it and says so in the console — so the script fails loudly instead when
// it finds nothing to hash, rather than shipping a policy that blocks the app.
//
// style-src keeps 'unsafe-inline': Vue's `:style` bindings and the canvas
// splash set inline style attributes, which hashes cannot cover.
import { readFileSync, readdirSync, appendFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIST = join(fileURLToPath(new URL('..', import.meta.url)), 'dist')
const HEADERS = join(DIST, '_headers')

function htmlFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return htmlFiles(path)
    return entry.name.endsWith('.html') ? [path] : []
  })
}

// Inline = no src attribute. Data blocks (application/json, the Nuxt payload)
// are never executed, so CSP does not apply to them.
const INLINE_SCRIPT = /<script(?![^>]*\ssrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi
const DATA_BLOCK = /type\s*=\s*["']?(application\/(ld\+)?json|importmap|speculationrules)/i

export function inlineScriptHashes(html) {
  const hashes = []
  for (const [, attrs, body] of html.matchAll(INLINE_SCRIPT)) {
    if (DATA_BLOCK.test(attrs) || body === '') continue
    hashes.push(`'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`)
  }
  return hashes
}

export function buildPolicy(hashes) {
  return [
    `default-src 'self'`,
    `script-src 'self' ${hashes.join(' ')}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `media-src 'self'`,
    `font-src 'self' data:`,
    `connect-src 'self'`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`
  ].join('; ')
}

function main() {
  if (!existsSync(DIST)) throw new Error('dist/ is missing — run `nuxt build` first')

  const files = htmlFiles(DIST)
  const hashes = [...new Set(files.flatMap(file => inlineScriptHashes(readFileSync(file, 'utf8'))))].sort()
  if (files.length === 0 || hashes.length === 0) {
    throw new Error(`Found ${files.length} HTML files and ${hashes.length} inline scripts in dist/ — refusing to write a CSP that would block the app`)
  }

  const existing = existsSync(HEADERS) ? readFileSync(HEADERS, 'utf8') : ''
  if (existing.includes('Content-Security-Policy')) {
    throw new Error('dist/_headers already has a Content-Security-Policy — build from a clean dist/')
  }

  appendFileSync(HEADERS, `${existing.endsWith('\n') || existing === '' ? '' : '\n'}/*\n  Content-Security-Policy: ${buildPolicy(hashes)}\n`)
  console.log(`✔ CSP written to dist/_headers (${hashes.length} inline script hashes from ${files.length} pages)`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
