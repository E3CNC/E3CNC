import { ref, watch } from 'vue'
import { useStore } from 'vuex'
import { getCncWcs, selectCncWcs } from '@/store/files/cncApi'

export const offsetNames = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']

const activeWcs = ref('G54')
const wcsOffsets = ref<Record<string, { X: number; Y: number; Z: number }>>({})

// Saved WCS before the job started — restored on job end instead of always
// defaulting to G54. This allows users working in e.g. G56 to stay in G56.
let savedWcs: string | null = null

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

    // Watch for job start → save the active WCS so we can restore it later.
    // Watch for job end → restore to the saved WCS (or G54 if none saved).
    // Klipper resets gcode state on job end, effectively reverting to
    // machine coordinates (G53). Restoring the saved WCS brings the jogs
    // back to the work coordinate system the user was using.
    watch(
        () => store.state.printer.print_stats?.state,
        (newState, oldState) => {
            // Job started: save current WCS
            if (newState === 'printing' && (!oldState || oldState === 'standby' || oldState === '')) {
                savedWcs = activeWcs.value
                return
            }

            // Job ended: restore saved WCS
            const wasPrinting = oldState && ['printing', 'paused', 'complete'].includes(oldState)
            const isNowStandby = newState === 'standby' || newState === ''
            const restoreTo = savedWcs ?? 'G54'

            if (wasPrinting && isNowStandby && activeWcs.value !== restoreTo) {
                selectCncWcs(store.getters['socket/getUrl'], { wcs: restoreTo })
                    .then(() => {
                        activeWcs.value = restoreTo
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
