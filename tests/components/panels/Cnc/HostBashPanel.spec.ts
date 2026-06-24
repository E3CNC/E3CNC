import { describe, it, expect, vi } from 'vitest'

// HostBashPanel uses xterm.js Terminal (canvas rendering, DOM manipulation),
// ResizeObserver, and FitAddon — all of which are incompatible with happy-dom.
// We verify the module is importable and has expected structure.
// The component's bash execution logic is covered by cncApi tests.

it('HostBashPanel module can be imported', async () => {
    const mod = await import('@/components/panels/Cnc/HostBashPanel.vue')
    expect(mod.default).toBeDefined()
})
