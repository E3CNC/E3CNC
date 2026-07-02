import { ref, watch } from 'vue'
import { useStore } from 'vuex'
import { getCncWcs, selectCncWcs } from '@/store/files/cncApi'

export const offsetNames = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']

const activeWcs = ref('G54')
const wcsOffsets = ref<Record<string, { X: number; Y: number; Z: number }>>({})

export function useCncOffsets() {
    const store = useStore()

    async function refreshWcs() {
        const raw = await getCncWcs(store.getters['socket/getUrl'])
        const data = raw?.result ?? raw
        activeWcs.value = typeof data?.active === 'string' ? data.active : 'G54'

        if (data?.offsets && typeof data.offsets === 'object') {
            const mapped: Record<string, { X: number; Y: number; Z: number }> = {}
            for (const [key, val] of Object.entries(data.offsets)) {
                const v = val as Record<string, number>
                mapped[key] = { X: v.X ?? 0, Y: v.Y ?? 0, Z: v.Z ?? 0 }
            }
            wcsOffsets.value = mapped
        }
    }

    async function setActiveWcs(wcs: string) {
        if (wcs === activeWcs.value) return
        await selectCncWcs(store.getters['socket/getUrl'], { wcs })
        activeWcs.value = wcs
    }

    // Watch for job end: when print_stats transitions to 'standby' after
    // being in 'printing', 'paused', or 'complete', reset WCS to G54.
    // Klipper resets gcode state on job end, effectively reverting to
    // machine coordinates (G53). Sending G54 re-establishes the default WCS
    // so the jog panel doesn't move in machine coordinates.
    watch(
        () => store.state.printer.print_stats?.state,
        (newState, oldState) => {
            const wasPrinting =
                oldState && ['printing', 'paused', 'complete'].includes(oldState)
            const isNowStandby = newState === 'standby' || newState === ''
            if (wasPrinting && isNowStandby && activeWcs.value !== 'G54') {
                selectCncWcs(store.getters['socket/getUrl'], { wcs: 'G54' })
                    .then(() => {
                        activeWcs.value = 'G54'
                    })
                    .catch(() => {
                        // silently ignore — WCS reset is best-effort
                    })
            }
        }
    )

    return {
        offsetNames,
        activeWcs,
        wcsOffsets,
        refreshWcs,
        setActiveWcs,
    }
}
