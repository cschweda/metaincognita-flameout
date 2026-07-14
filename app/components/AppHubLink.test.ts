import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { computed, defineComponent, h, ref } from 'vue'
import AppHubLink from './AppHubLink.vue'
import DefaultLayout from '~/layouts/default.vue'

const HUB_HREF = 'https://metaincognita.com'
const WORDMARK = 'METAINCOGNITA'

// Every route the app has. The hub exit is contractually on all of them —
// including the index, where the app's own Back button is deliberately absent.
const ROUTES = ['/', '/game', '/history', '/analysis', '/learn']

// Renders only while open, so "did the leave-confirm fire?" becomes a DOM
// question. The real UModal is a Nuxt UI component we don't need here.
const UModalStub = defineComponent({
  props: { open: { type: Boolean, default: false } },
  setup(props) {
    return () => (props.open ? h('div', { 'data-test': 'leave-confirm' }) : null)
  }
})

// The layout leans on Nuxt's auto-imports, which only exist inside the Nuxt
// build. Vitest compiles the SFC raw, so those names are plain globals at
// runtime — stub them there. The store is parked mid-session so the session
// indicator (the hub exit's only competition for bar space) is rendered too.
function mountLayoutAt(path: string) {
  vi.stubGlobal('computed', computed)
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('useRoute', () => ({ path }))
  vi.stubGlobal('useRouter', () => ({ back: vi.fn(), push: vi.fn() }))
  vi.stubGlobal('useFlameoutEngine', () => ({ cleanup: vi.fn() }))
  vi.stubGlobal('useFlameoutStore', () => ({
    isPlaying: true,
    saveToLocalStorage: vi.fn(),
    setPhase: vi.fn()
  }))

  return mount(DefaultLayout, {
    global: {
      // AppHubLink is registered for real, not stubbed — it is the thing under test.
      components: { AppHubLink },
      stubs: { UIcon: true, UButton: true, NuxtLink: true, UModal: UModalStub }
    }
  })
}

function mountHubLink() {
  return mount(AppHubLink, { global: { stubs: { UIcon: true } } })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AppHubLink — the door out of the suite', () => {
  it('is a real anchor to the hub, not a router link', () => {
    const link = mountHubLink()

    // A router push would keep us inside the SPA. This has to leave it.
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe(HUB_HREF)
  })

  it('carries no target — an exit, not a side trip', () => {
    // target="_blank" would leave the simulator running in the tab behind it.
    expect(mountHubLink().attributes('target')).toBeUndefined()
  })

  it('accessible name contains the visible wordmark verbatim (WCAG 2.5.3)', () => {
    const link = mountHubLink()

    const visible = link.get('span').text() // what a sighted user reads
    const accessibleName = link.attributes('aria-label') // what a screen reader says

    expect(visible).toBe(WORDMARK)
    // "Meta Incognita — ..." reads fine and fails Label in Name on the space.
    expect(accessibleName).toContain(visible)
  })
})

describe('the hub exit is in the top bar of every route', () => {
  it.each(ROUTES)('renders on %s, ungated', (path) => {
    const link = mountLayoutAt(path).get(`a[href="${HUB_HREF}"]`)

    expect(link.element.tagName).toBe('A')
    expect(link.attributes('target')).toBeUndefined()
    expect(link.attributes('aria-label')).toContain(link.get('span').text())
  })

  it('is still there on the index, where the app gates its own Back button away', () => {
    const layout = mountLayoutAt('/')

    expect(layout.find('[data-test="hub-link"]').exists()).toBe(true)
    // Back really is gated here (v-if="!isSetup"). That is the point: the hub
    // exit does not ride that condition, or any other.
    expect(layout.findAll('button').some(b => b.text().includes('Back'))).toBe(false)
  })
})

describe('the hub exit never confirms, and leaves Back alone', () => {
  it('Back on a live round still opens the leave-confirm', async () => {
    const layout = mountLayoutAt('/game')

    const back = layout.findAll('button').find(b => b.text().includes('Back'))
    await back!.trigger('click')

    // The existing affordance destroys a session, so it keeps its confirm.
    expect(layout.find('[data-test="leave-confirm"]').exists()).toBe(true)
  })

  it('the hub exit opens no confirm at all', async () => {
    const layout = mountLayoutAt('/game')

    // Keep happy-dom from acting on the anchor's default action and navigating.
    const swallow = (e: Event) => e.preventDefault()
    window.addEventListener('click', swallow, { capture: true })
    await layout.get('[data-test="hub-link"]').trigger('click')
    window.removeEventListener('click', swallow, { capture: true })

    // It destroys nothing, and a player must always be able to leave.
    expect(layout.find('[data-test="leave-confirm"]').exists()).toBe(false)
  })
})
