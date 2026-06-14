import { describe, expect, it, vi, beforeEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { useCncProfile } from '@/composables/useCncProfile'
import { getCncState } from '@/store/files/cncApi'

vi.mock('@/store/files/cncApi', () => ({
    getCncState: vi.fn(),
}))

describe('useCncProfile', () => {
    let store: ReturnType<typeof createStore>

    beforeEach(() => {
        store = createStore({
            state: {
                socket: {
                    isConnected: false,
                    initializationList: [],
                    loadings: [],
                    port: 8080,
                    hostname: 'localhost',
                },
            },
            getters: {
                'socket/getUrl': () => '//localhost:8080',
            },
        })
        vi.mocked(getCncState).mockReset()
    })

    async function mountComposable() {
        let result: any
        const TestComponent = defineComponent({
            setup() {
                result = useCncProfile()
                return () => h('div')
            },
        })

        mount(TestComponent, {
            global: { plugins: [store] },
        })

        await nextTick()
        await Promise.resolve()
        await Promise.resolve()

        return result
    }

    it('loads cnc state from the API and exposes profile flags', async () => {
        vi.mocked(getCncState).mockResolvedValue({
            profile: {
                name: 'E3CNC',
                frontend: {
                    show_machine_coords: true,
                    show_work_coords: false,
                    show_machine_health: true,
                },
                capabilities: {
                    spindle: { enabled: true },
                    coolant: { channels: 2 },
                    probe: { enabled: true },
                    tool_setter: { enabled: false },
                },
                safety: {
                    require_confirm_for_zero_reset: true,
                    require_confirm_for_spindle_start: false,
                    require_homing_before_offsets: true,
                },
            },
        })

        const profile = await mountComposable()
        expect(getCncState).toHaveBeenCalledWith('//localhost:8080')
        expect(profile.machineName.value).toBe('E3CNC')
        expect(profile.spindleEnabled.value).toBe(true)
        expect(profile.coolantEnabled.value).toBe(true)
        expect(profile.coolantChannelCount.value).toBe(2)
        expect(profile.probeEnabled.value).toBe(true)
        expect(profile.toolSetterEnabled.value).toBe(false)
        expect(profile.showMachineCoords.value).toBe(true)
        expect(profile.showWorkCoords.value).toBe(false)
        expect(profile.showMachineHealth.value).toBe(true)
        expect(profile.requireConfirmForZeroReset.value).toBe(true)
        expect(profile.requireConfirmForSpindleStart.value).toBe(false)
        expect(profile.requireHomingBeforeOffsets.value).toBe(true)
    })

})
