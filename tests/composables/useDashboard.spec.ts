import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { useDashboard } from '@/composables/useDashboard'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        apiUrl: computed(() => '//localhost:8080'),
        hostUrl: computed(() => 'http://localhost/'),
        hostPort: computed(() => 8080),
        klippyIsConnected: computed(() => true),
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

describe('useDashboard', () => {
    let store: any

    beforeEach(() => {
        store = createStore({
            state: {
                gui: {
                    macros: { entries: [] },
                },
            },
            getters: {
                'gui/macros/getAllMacrogroups': () => [{ id: '1', name: 'Macros 1' }],
                'gui/webcams/getWebcams': () => [{ name: 'cam1' }],
            },
        })
    })

    function mountComposable() {
        let result: any
        const TestComponent = defineComponent({
            setup() {
                result = useDashboard()
                return () => h('div')
            },
        })

        mount(TestComponent, {
            global: { plugins: [store] },
        })

        return result
    }

    it('returns names and icons for panels', () => {
        const dashboard = mountComposable()
        expect(dashboard.macrogroups.value).toEqual([{ id: '1', name: 'Macros 1' }])
        expect(dashboard.webcams.value).toEqual([{ name: 'cam1' }])
        expect(dashboard.getPanelName('macrogroup_1')).toBe('Macros 1')
        expect(dashboard.getPanelName('cnc-status')).toBe('CNC Status')
        expect(dashboard.getPanelName('toolhead-control')).toBe('Panels.ToolheadControlPanel.Headline')
        expect(dashboard.convertPanelnameToIcon('webcam')).toBeTruthy()
        expect(dashboard.convertPanelnameToIcon('unknown')).toBeTruthy()
    })
})
