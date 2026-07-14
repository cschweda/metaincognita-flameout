// @vitest-environment node
// This one reads the repo off disk rather than mounting anything, so it wants
// the plain Node environment, not the suite's default DOM.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// Why this file exists
// -------------------
// Production serves under `connect-src 'self'` (netlify.toml). Any icon that
// isn't baked into the client bundle is fetched from api.iconify.design at
// runtime, the CSP blocks the request, and the icon renders as *nothing* —
// silently, with only a console warning. It cannot be caught by a green build,
// a passing unit suite, or `nuxt preview` (which doesn't apply _headers).
//
// That is how three modals shipped with an invisible close button: `lucide:x`
// is Nuxt UI's default `ui.icons.close`, it lives in node_modules, and it
// appears in none of our own templates — so the scanner never saw it.
//
// These tests re-derive, from the real sources, every icon the app can render,
// and fail if one of them would miss the bundle.

const ROOT = fileURLToPath(new URL('.', import.meta.url))
const SRC = join(ROOT, 'app')
const UI_COMPONENTS = join(ROOT, 'node_modules/@nuxt/ui/dist/runtime/components')

// @nuxt/icon only scans files matching these globs, and never node_modules.
// Anything referenced outside them has to be pinned by hand.
const SCANNED_EXTENSIONS = ['.vue', '.jsx', '.tsx', '.md', '.mdc', '.mdx', '.yml', '.yaml']

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

const sourceFiles = walk(SRC)
const nuxtConfig = readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8')

// The collections actually installed — the only ones an icon name can come from.
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const collections = Object.keys(pkg.dependencies)
  .filter(dep => dep.startsWith('@iconify-json/'))
  .map(dep => dep.slice('@iconify-json/'.length))
  // Longest first, so `simple-icons` can't be shadowed by a shorter prefix.
  .sort((a, b) => b.length - a.length)

// Mirrors @nuxt/icon's own detection regex: matches `i-lucide-x` and `lucide:x`.
const iconRE = new RegExp(`\\b(?:i-)?(${collections.join('|')})[:-]([a-z0-9-]+)\\b`, 'g')

function iconsIn(source: string): string[] {
  return [...source.matchAll(iconRE)].map(([, prefix, name]) => `${prefix}:${name}`)
}

/** Every first capture group in `source`, undefined-free for TypeScript's sake. */
function captures(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)]
    .map(([, capture]) => capture)
    .filter(capture => capture !== undefined)
}

/**
 * The hand-maintained `icons: [...]` list in nuxt.config.ts — quoted entries
 * only, and comments stripped before we go looking for them.
 *
 * Reading the block as raw text would let a mere mention of an icon in a
 * comment count as a pin, and that block is mostly comment. (Stripping first
 * also keeps an apostrophe in the prose from swallowing the quote that opens
 * the next real entry.)
 */
const pinnedBlock = (nuxtConfig.match(/icons:\s*\[([\s\S]*?)\]/)?.[1] ?? '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '')

const pinned = new Set(
  [...pinnedBlock.matchAll(/'([^']*)'|"([^"]*)"/g)]
    .flatMap(([, single, double]) => iconsIn(single ?? double ?? ''))
)

/** What the scanner finds on its own, by its real rules. */
const scanned = new Set(
  sourceFiles
    .filter(file => SCANNED_EXTENSIONS.includes(extname(file)))
    .flatMap(file => iconsIn(readFileSync(file, 'utf8')))
)

const bundled = new Set([...pinned, ...scanned])

describe('icon client bundle', () => {
  it('has scanning on, which is what the rest of these tests assume', () => {
    expect(nuxtConfig).toMatch(/scan:\s*true/)
    // Without a collection to match, the detection regex below matches nothing
    // and every assertion in this file passes vacuously.
    expect(collections).toContain('lucide')
  })

  it('pins every icon named in .ts — the scan globs cover no .ts at all', () => {
    // GAME_MODES lives in app/types/flameout.ts and reaches a template only
    // through `:name="mode.icon"`, so nothing the scanner reads ever spells it.
    const inTypeScript = new Set(
      sourceFiles
        .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
        .flatMap(file => iconsIn(readFileSync(file, 'utf8')))
    )

    expect(inTypeScript.size).toBeGreaterThan(0) // guard: the sweep found something
    for (const icon of inTypeScript) {
      expect(pinned, `${icon} is named in .ts, which @nuxt/icon never scans`).toContain(icon)
    }
  })

  it('pins every default icon Nuxt UI renders on our behalf', () => {
    // The bug this file was written for. Nuxt UI components render icons from
    // their own app.config defaults, from inside node_modules — which the
    // scanner is explicitly configured to skip. Nothing in our source names
    // them, so only an explicit pin can save them.
    const defaults = nuxtUiDefaultIcons()

    expect(defaults.size).toBeGreaterThan(0) // guard: the walk found something
    for (const icon of defaults) {
      expect(
        pinned,
        `${icon} is a Nuxt UI default rendered from node_modules — the scanner cannot see it, so it must be pinned`
      ).toContain(icon)
    }
  })

  it('leaves no icon named anywhere under app/ outside the bundle', () => {
    // Tautological for the file types the scanner reads, and the whole point
    // for the ones it doesn't: .ts, .html, .css, .json — anything a future
    // icon reference might land in.
    for (const file of sourceFiles) {
      for (const icon of iconsIn(readFileSync(file, 'utf8'))) {
        expect(
          bundled,
          `${icon} is named in ${relative(ROOT, file)} but never reaches the client bundle`
        ).toContain(icon)
      }
    }
  })
})

/**
 * Every icon Nuxt UI can render into this app without us naming it.
 *
 * Walks out from the `<U…>` components our templates use, through the ones
 * those components render internally (UApp mounts the toaster; UModal builds
 * its close button out of a UButton), collecting the `ui.icons.*` keys each
 * one reads. Resolves them against the merged app config Nuxt generates, so
 * an override in app.config.ts would be followed rather than missed.
 */
function nuxtUiDefaultIcons(): Set<string> {
  const iconKeyRE = /appConfig\.ui\.icons\.(\w+)/g
  const componentRE = /<U([A-Z][A-Za-z]*)/g

  // Leading/trailing/loading icons are resolved in a composable, not in the
  // component file — UButton and UInput get their spinner this way.
  const composable = readFileSync(
    join(ROOT, 'node_modules/@nuxt/ui/dist/runtime/composables/useComponentIcons.js'),
    'utf8'
  )
  const composableKeys = captures(composable, iconKeyRE)

  const queue = sourceFiles
    .filter(file => file.endsWith('.vue'))
    .flatMap(file => captures(readFileSync(file, 'utf8'), componentRE))

  const seen = new Set<string>()
  const keys = new Set<string>()

  while (queue.length) {
    const component = queue.shift()!
    if (seen.has(component)) continue
    seen.add(component)

    const file = join(UI_COMPONENTS, `${component}.vue`)
    if (!existsSync(file)) continue
    const source = readFileSync(file, 'utf8')

    for (const key of captures(source, iconKeyRE)) keys.add(key)
    if (source.includes('useComponentIcons')) composableKeys.forEach(key => keys.add(key))

    // …and whatever this component renders in turn.
    queue.push(...captures(source, componentRE))
  }

  // Guard against a silent pass if Nuxt UI ever reshuffles these internals:
  // the close button is the whole reason this test exists.
  expect(seen, 'UModal should be reachable from our templates').toContain('Modal')
  expect(keys, 'the close button on UModal reads ui.icons.close').toContain('close')

  // `i-lucide-x` as Nuxt UI writes it, `lucide:x` as the bundle lists it —
  // iconsIn() already knows how to cross that gap, and knows our collections.
  const map = mergedIconMap()
  return new Set([...keys].flatMap(key => iconsIn(map[key] ?? '')))
}

/** `ui.icons` as the app actually runs with it, straight from Nuxt's build. */
function mergedIconMap(): Record<string, string> {
  const generated = join(ROOT, '.nuxt/app.config.mjs')
  if (!existsSync(generated)) {
    throw new Error('.nuxt/app.config.mjs is missing — run `pnpm nuxt prepare` first')
  }
  const block = readFileSync(generated, 'utf8').match(/"icons":\s*\{([^}]*)\}/)?.[1] ?? ''
  return Object.fromEntries(
    [...block.matchAll(/"(\w+)":\s*"([^"]+)"/g)].map(([, key, icon]) => [key, icon])
  )
}
