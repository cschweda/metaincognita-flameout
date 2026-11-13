// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { inlineScriptHashes, buildPolicy } from './write-csp.mjs'

const sha = (body: string) => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`

describe('write-csp', () => {
  it('hashes every executable inline script, byte for byte', () => {
    const html = `<head><script>window.a=1</script></head>
      <body><script type="module">\n  go()\n</script></body>`
    expect(inlineScriptHashes(html)).toEqual([sha('window.a=1'), sha('\n  go()\n')])
  })

  it('skips external scripts and data blocks — CSP never evaluates those', () => {
    const html = `<script type="module" src="/_nuxt/x.js" crossorigin></script>
      <script type="application/json" id="__NUXT_DATA__">[1,2]</script>
      <script type="application/ld+json">{}</script>`
    expect(inlineScriptHashes(html)).toEqual([])
  })

  it('builds a script-src with hashes and no unsafe-inline', () => {
    const policy = buildPolicy([sha('x')])
    const scriptSrc = policy.split('; ').find(d => d.startsWith('script-src'))!
    expect(scriptSrc).toBe(`script-src 'self' ${sha('x')}`)
    expect(scriptSrc).not.toContain('unsafe-inline')
    expect(policy).toContain(`object-src 'none'`)
    expect(policy).toContain(`base-uri 'self'`)
  })
})
