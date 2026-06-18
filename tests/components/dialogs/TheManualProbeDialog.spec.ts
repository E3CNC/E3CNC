import { describe, it, expect, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: vi.fn() }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ klipperReadyForGui: { value: true }, printer_state: { value: 'ready' } }),
}))

vi.mock('vuex', () => ({
    useStore: () => ({
        state: {
            printer: { toolhead: { position: [0, 0, 0] }, probe: {} },
            gui: { general: {}, uiSettings: { boolManualProbeDialog: true } },
        },
        dispatch: vi.fn(),
        getters: {},
    }),
}))

import TheManualProbeDialog from '@/components/dialogs/TheManualProbeDialog.vue'

describe('TheManualProbeDialog.vue', () => {
    it('renders without crashing', () => {
        const wrapper = shallowMount(TheManualProbeDialog, {
            props: { modelValue: true },
        })
        expect(wrapper.exists()).toBe(true)
    })
})
