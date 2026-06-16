import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useResponsive } from '@/composables/useResponsive'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref, nextTick } from 'vue'

vi.mock('vuetify', () => ({
    useDisplay: () => ({
        mobile: ref(false),
        smAndUp: ref(true),
        lgAndUp: ref(false),
        xl: ref(false),
    }),
}))

function mountComposable(breakpoints?: Record<string, (cr: DOMRect) => boolean>) {
    const store = createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [], port: 80, hostname: 'localhost' },
            server: { klippy_connected: true, klippy_state: 'ready', components: [], registered_directories: [], config: { config: {} } },
            printer: { app_name: 'Klipper', print_stats: { state: 'standby' }, idle_timeout: { state: 'Idle' } },
            gui: { general: { timeFormat: '24hours', dateFormat: 'yyyy-mm-dd' }, uiSettings: { powerDeviceName: null } },
            instancesDB: 'moonraker',
        },
        getters: {
            'socket/getUrl': () => 'ws://localhost:80/websocket',
            'socket/getHostUrl': () => 'http://localhost:80',
            'server/power/getDevices': () => [],
            'gui/getHours12Format': () => false,
        } as any,
    })

    let result: any
    const TestComponent = {
        template: '<div ref="targetRef"></div>',
        setup() {
            result = useResponsive(breakpoints)
            return { targetRef: result.targetRef }
        },
    }
    const wrapper = mount(TestComponent, { global: { plugins: [store] } })
    return { result, wrapper }
}

function mountComposableNoRef(breakpoints?: Record<string, (cr: DOMRect) => boolean>) {
    const store = createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [], port: 80, hostname: 'localhost' },
            server: { klippy_connected: true, klippy_state: 'ready', components: [], registered_directories: [], config: { config: {} } },
            printer: { app_name: 'Klipper', print_stats: { state: 'standby' }, idle_timeout: { state: 'Idle' } },
            gui: { general: { timeFormat: '24hours', dateFormat: 'yyyy-mm-dd' }, uiSettings: { powerDeviceName: null } },
            instancesDB: 'moonraker',
        },
        getters: {
            'socket/getUrl': () => 'ws://localhost:80/websocket',
            'socket/getHostUrl': () => 'http://localhost:80',
            'server/power/getDevices': () => [],
            'gui/getHours12Format': () => false,
        } as any,
    })

    let result: any
    const TestComponent = {
        template: '<div></div>',
        setup() {
            result = useResponsive(breakpoints)
            return {}
        },
    }
    const wrapper = mount(TestComponent, { global: { plugins: [store] } })
    return { result, wrapper }
}

function getResizeObserverCallback(): (entries: ResizeObserverEntry[]) => void {
    const mockConstructor = ResizeObserver as unknown as ReturnType<typeof vi.fn>
    const calls = mockConstructor.mock.calls
    if (calls.length === 0) return null as any
    return calls[calls.length - 1][0]
}

function makeResizeEntry(rect: Partial<DOMRectReadOnly>): ResizeObserverEntry {
    return {
        contentRect: {
            x: 0,
            y: 0,
            width: rect.width ?? 0,
            height: rect.height ?? 0,
            top: 0,
            right: rect.width ?? 0,
            bottom: rect.height ?? 0,
            left: 0,
            toJSON: () => {},
        },
        target: document.createElement('div'),
        borderBoxSize: [],
        contentBoxSize: [],
        devicePixelContentBoxSize: [],
    } as unknown as ResizeObserverEntry
}

describe('useResponsive', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.stubGlobal('ResizeObserver', vi.fn((cb: Function) => {
            const instance = { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }
            ;(instance as any)._callback = cb
            return instance
        }))
    })

    it('spreads useBase properties', () => {
        const { result } = mountComposable()
        expect(result).toHaveProperty('socketIsConnected')
        expect(result).toHaveProperty('guiIsReady')
    })

    it('returns el reactive with is object', () => {
        const { result } = mountComposable()
        expect(result.el).toBeDefined()
        expect(result.el.is).toEqual({})
    })

    it('returns targetRef ref', () => {
        const { result } = mountComposable()
        expect(result.targetRef).toBeDefined()
    })

    it('does not create ResizeObserver when no breakpoints', () => {
        mountComposableNoRef()
        // onMounted runs, but code only creates observer if breakpoints is truthy
        expect(ResizeObserver).not.toHaveBeenCalled()
    })

    it('creates ResizeObserver when breakpoints are provided', async () => {
        const breakpoints = {
            wide: (cr: DOMRect) => cr.width >= 400,
        }
        mountComposable(breakpoints)
        // ResizeObserver is created inside nextTick
        vi.runAllTimers()
        await nextTick()
        expect(ResizeObserver).toHaveBeenCalled()
    })

    it('evaluates breakpoints and sets el.is when ResizeObserver fires', async () => {
        const breakpoints = {
            wide: (cr: DOMRect) => cr.width >= 400,
            tall: (cr: DOMRect) => cr.height >= 300,
        }
        const { result } = mountComposable(breakpoints)

        // Wait for nextTick since observer is created in onMounted -> nextTick
        vi.runAllTimers()
        await nextTick()

        const callback = getResizeObserverCallback()
        expect(callback).toBeDefined()

        // Fire resize with dimensions that should set both
        // throttle leading edge fires immediately
        callback([makeResizeEntry({ width: 500, height: 200 })])
        expect(result.el.is.wide).toBe(true)
        expect(result.el.is.tall).toBe(false)

        // Advance past throttle wait so trailing edge fires
        vi.advanceTimersByTime(100)

        // Fire resize with dimensions that change — this gets queued for trailing
        callback([makeResizeEntry({ width: 300, height: 350 })])
        // The throttled trailing call fires after wait
        vi.advanceTimersByTime(100)

        expect(result.el.is.wide).toBe(false)
        expect(result.el.is.tall).toBe(true)
    })

    it('skips evaluation when contentRect has zero width and height', async () => {
        const breakpoints = {
            wide: vi.fn((cr: DOMRect) => cr.width >= 400),
        }
        const { result } = mountComposable(breakpoints)

        vi.runAllTimers()
        await nextTick()

        const callback = getResizeObserverCallback()
        expect(callback).toBeDefined()

        // Fire with zero dimensions — should early-return (leading edge fires immediately)
        callback([makeResizeEntry({ width: 0, height: 0 })])
        expect(breakpoints.wide).not.toHaveBeenCalled()
        expect(result.el.is.wide).toBeUndefined()

        // Advance past throttle window so next leading edge fires
        vi.advanceTimersByTime(100)

        // Subsequent call with non-zero dimensions should work
        callback([makeResizeEntry({ width: 500, height: 100 })])
        // Advance again so trailing edge (if any) also fires
        vi.advanceTimersByTime(100)

        expect(breakpoints.wide).toHaveBeenCalledTimes(1)
        expect(result.el.is.wide).toBe(true)
    })

    it('handles resize correctly even when only one dimension is zero', async () => {
        const breakpoints = {
            wide: vi.fn((cr: DOMRect) => cr.width >= 400),
        }
        mountComposable(breakpoints)

        vi.runAllTimers()
        await nextTick()

        const callback = getResizeObserverCallback()
        expect(callback).toBeDefined()

        // Only width is zero, height is non-zero — should NOT be skipped
        callback([makeResizeEntry({ width: 0, height: 100 })])
        vi.advanceTimersByTime(100)

        // Only height is zero, width is non-zero — should NOT be skipped
        callback([makeResizeEntry({ width: 400, height: 0 })])
        vi.advanceTimersByTime(100)

        expect(breakpoints.wide).toHaveBeenCalledTimes(2)
    })

    it('calls observer.unobserve on unmount when targetRef has a value', async () => {
        const breakpoints = {
            wide: (cr: DOMRect) => cr.width >= 400,
        }
        const { result, wrapper } = mountComposable(breakpoints)

        vi.runAllTimers()
        await nextTick()

        // Get the mock observer instance
        const mockConstructor = ResizeObserver as unknown as ReturnType<typeof vi.fn>
        const observerInstance = mockConstructor.mock.results[0].value

        wrapper.unmount()

        expect(observerInstance.unobserve).toHaveBeenCalled()
    })

    it('does not error on unmount when targetRef is null', async () => {
        const breakpoints = {
            wide: (cr: DOMRect) => cr.width >= 400,
        }
        const { wrapper } = mountComposableNoRef(breakpoints)

        vi.runAllTimers()
        await nextTick()

        expect(() => wrapper.unmount()).not.toThrow()
    })

    it('does not error on unmount when observer is undefined', async () => {
        const { wrapper } = mountComposableNoRef()

        expect(() => wrapper.unmount()).not.toThrow()
    })
})
