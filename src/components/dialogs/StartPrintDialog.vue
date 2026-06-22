<template>
    <v-dialog
        v-model="showDialog"
        :max-width="400"
        content-class="overflow-x-hidden"
        @click:outside="closeDialog"
        @keydown.esc="closeDialog">
        <v-card class="start-print-dialog-card">
            <start-print-dialog-thumbnail :file="file" :current-path="currentPath" />
            <v-card-title class="text-h5">{{ $t('Dialogs.StartPrint.Headline') }}</v-card-title>
            <v-card-text class="pb-0">
                <p class="body-2 mb-4">
                    {{ question }}
                </p>
                <v-select
                    v-model="startWcsMode"
                    :items="wcsModeItems"
                    item-title="title"
                    item-value="value"
                    :label="$t('Dialogs.StartPrint.WcsMode')"
                    density="compact"
                    variant="outlined"
                    hide-details
                    class="mb-3" />
                <v-select
                    v-if="startWcsMode === 'slot'"
                    v-model="selectedWcsSlot"
                    :items="wcsSlotItems"
                    item-title="title"
                    item-value="value"
                    :label="$t('Dialogs.StartPrint.GcodeWcsSlot')"
                    density="compact"
                    variant="outlined"
                    hide-details />
            </v-card-text>
            <v-divider v-if="showDivider" class="my-0" />
            <v-card-actions>
                <v-spacer />
                <v-btn variant="text" :disabled="startingPrint" @click="closeDialog">{{ $t('Buttons.Cancel') }}</v-btn>
                <v-btn
                    color="primary"
                    :loading="startingPrint"
                    :disabled="printerIsPrinting || !klipperReadyForGui"
                    @click="startPrint(file.filename)">
                    {{ $t('Dialogs.StartPrint.Print') }}
                </v-btn>
            </v-card-actions>
        </v-card>
    </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'vue-toast-notification'
import { useSocket } from '@/composables/useSocket'
import { useBase } from '@/composables/useBase'
import { useCncOffsets, offsetNames } from '@/composables/useCncOffsets'
import type { FileStateGcodefile } from '@/store/files/types'

const { t } = useI18n()
const toast = useToast()
const socket = useSocket()
const { klipperReadyForGui, printerIsPrinting, moonrakerComponents } = useBase()
const { activeWcs, wcsOffsets, refreshWcs, setActiveWcs } = useCncOffsets()

const props = defineProps({
    modelValue: { type: Boolean },
    currentPath: { type: String, default: '' },
    file: { type: Object as () => FileStateGcodefile, required: true },
})
const emit = defineEmits(['update:modelValue'])

const showDialog = computed({
    get: () => props.modelValue,
    set: (val) => emit('update:modelValue', val),
})

const existsTimelapse = computed(() => moonrakerComponents.value.includes('timelapse'))
const startWcsMode = ref<'current' | 'slot'>('slot')
const selectedWcsSlot = ref('G54')
const startingPrint = ref(false)

const showDivider = computed(() => existsTimelapse.value)

const question = computed(() =>
    t('Dialogs.StartPrint.ChooseWcsToUse', { filename: props.file?.filename ?? 'unknown' })
)

const currentWcsLabel = computed(() => {
    const offset = wcsOffsets.value[activeWcs.value] ?? { X: 0, Y: 0, Z: 0 }
    return `${activeWcs.value} · X ${offset.X} · Y ${offset.Y} · Z ${offset.Z}`
})

const wcsModeItems = computed(() => [
    {
        title: t('Dialogs.StartPrint.UseCurrentWcs', { wcs: currentWcsLabel.value }).toString(),
        value: 'current',
    },
    {
        title: t('Dialogs.StartPrint.UseGcodeWcsSlot').toString(),
        value: 'slot',
    },
])

const wcsSlotItems = computed(() =>
    offsetNames.map((name) => {
        const offset = wcsOffsets.value[name] ?? { X: 0, Y: 0, Z: 0 }
        return {
            title: `${name} · X ${offset.X} · Y ${offset.Y} · Z ${offset.Z}`,
            value: name,
        }
    })
)

watch(
    () => props.modelValue,
    async (open) => {
        if (!open) return

        try {
            await refreshWcs()
            selectedWcsSlot.value = activeWcs.value || 'G54'
            startWcsMode.value = 'slot'
        } catch (error) {
            window.console.error(error)
        }
    },
    { immediate: true }
)

async function startPrint(filename = '') {
    filename = (props.currentPath + '/' + filename).substring(1)

    try {
        startingPrint.value = true
        if (startWcsMode.value === 'slot') await setActiveWcs(selectedWcsSlot.value)
        closeDialog()
        socket.emit('printer.print.start', { filename: filename }, { action: 'switchToDashboard' })
    } catch (error) {
        window.console.error(error)
        toast.error(t('Dialogs.StartPrint.WcsSwitchFailed').toString())
    } finally {
        startingPrint.value = false
    }
}

function closeDialog() {
    showDialog.value = false
}
</script>

<style scoped>
.start-print-dialog-card {
    box-shadow: var(--v-shadow-24);
}
</style>
