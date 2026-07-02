import { computed, onMounted, ref } from 'vue'
import { useStore } from 'vuex'
import { getCncState } from '@/store/files/cncApi'

const cncState = ref<Record<string, unknown> | null>(null)
const cncStateLoading = ref(false)
let cncStateRequestId = 0

function asObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

async function refreshCncState(apiUrl: string) {
    const requestId = ++cncStateRequestId
    cncStateLoading.value = true

    try {
        const state = await getCncState(apiUrl)
        if (requestId !== cncStateRequestId) return
        cncState.value = asObject(state)
    } catch (error) {
        if (requestId !== cncStateRequestId) return
        throw error
    } finally {
        if (requestId === cncStateRequestId) {
            cncStateLoading.value = false
        }
    }
}

export function useCncProfile() {
    const store = useStore()

    const profile = computed(() => asObject(cncState.value?.profile))
    const frontend = computed(() => asObject(profile.value.frontend))
    const capabilities = computed(() => asObject(profile.value.capabilities))
    const safety = computed(() => asObject(profile.value.safety))

    const machineName = computed(() => String(profile.value.name ?? ''))
    const spindleEnabled = computed(() => (capabilities.value as any)?.spindle?.enabled !== false)
    const coolantChannelCount = computed(() => Number((capabilities.value as any)?.coolant?.channels ?? 0))
    const coolantEnabled = computed(() => coolantChannelCount.value > 0)
    const probeEnabled = computed(() => (capabilities.value as any)?.probe?.enabled === true)
    const toolSetterEnabled = computed(() => (capabilities.value as any)?.tool_setter?.enabled === true)

    const showMachineCoords = computed(() => frontend.value.show_machine_coords !== false)
    const showWorkCoords = computed(() => frontend.value.show_work_coords !== false)
    const showMachineHealth = computed(() => frontend.value.show_machine_health !== false)

    const requireConfirmForZeroReset = computed(() => safety.value.require_confirm_for_zero_reset !== false)
    const requireConfirmForSpindleStart = computed(() => safety.value.require_confirm_for_spindle_start !== false)
    const requireHomingBeforeOffsets = computed(() => safety.value.require_homing_before_offsets !== false)

    const reverseYPreview = computed(() => frontend.value.reverse_y_preview === true)

    async function load() {
        const apiUrl = store.getters['socket/getUrl']
        if (!apiUrl) return
        await refreshCncState(apiUrl)
    }

    onMounted(() => {
        if (!cncState.value) {
            void load().catch(() => { /* ignore */ })
        }
    })

    // Retry loading when the socket URL becomes available (initially empty on mount)
    watch(
        () => store.getters['socket/getUrl'],
        (url) => {
            if (url && url !== '//:80/' && !cncState.value) {
                void load().catch(() => { /* ignore — retried on next watch trigger if needed */ })
            }
        }
    )

    return {
        cncState,
        cncStateLoading,
        profile,
        frontend,
        capabilities,
        safety,
        machineName,
        spindleEnabled,
        coolantChannelCount,
        coolantEnabled,
        probeEnabled,
        toolSetterEnabled,
        showMachineCoords,
        showWorkCoords,
        showMachineHealth,
        requireConfirmForZeroReset,
        requireConfirmForSpindleStart,
        requireHomingBeforeOffsets,
        reverseYPreview,
        load,
    }
}
