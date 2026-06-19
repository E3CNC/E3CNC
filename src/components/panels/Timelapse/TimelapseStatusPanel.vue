<template>
    <panel :title="$t('Timelapse.Status')" :icon="mdiInformation" card-class="timelapse-status-panel">
        <v-card-text v-if="framesCount">
            <v-row v-if="frameUrl">
                <v-col class="pb-0">
                    <vue-load-image class="d-flex align-center justify-center">
                        <template #image>
                            <img
                                ref="timelapsePreview"
                                :src="frameUrl"
                                style="max-width: 100%; max-height: 200px; cursor: pointer"
                                alt="Timelapse Preview"
                                @load="calcRatio"
                                @click="boolDialogRendersettings = true" />
                        </template>
                        <template #preloader>
                            <v-progress-circular :size="24" class="ma-4" indeterminate />
                        </template>
                        <template #error>
                            <v-icon :size="24" class="ma-4">{{ mdiCloseThick }}</v-icon>
                        </template>
                    </vue-load-image>
                </v-col>
            </v-row>
            <v-row>
                <v-col class="text-medium-emphasis">
                    <settings-row :title="$t('Timelapse.Frames')" :dynamic-slot-width="true">
                        {{ framesCount }}
                    </settings-row>
                    <v-divider class="my-2" />
                    <settings-row :title="$t('Timelapse.EstimatedLength')" :dynamic-slot-width="true">
                        {{ estimatedVideoLength }}
                    </settings-row>
                    <v-divider class="my-2" />
                    <settings-row :title="$t('Timelapse.Enabled')" :dynamic-slot-width="true">
                        <v-switch v-model="enabled" hide-details class="mt-0" @change="toggleEnabled"></v-switch>
                    </settings-row>
                    <v-divider class="my-2" />
                    <settings-row :title="$t('Timelapse.Autorender')" :dynamic-slot-width="true">
                        <v-switch v-model="autorender" hide-details class="mt-0" @change="toggleAutorender"></v-switch>
                    </settings-row>
                    <v-divider v-if="!disableRenderButton" class="my-2" />
                    <settings-row
                        v-if="!disableRenderButton"
                        :title="$t('Timelapse.Render')"
                        :dynamic-slot-width="true">
                        <v-btn size="x-small" @click="saveFrames">
                            {{ $t('Timelapse.SaveFrames') }}
                        </v-btn>
                    </settings-row>
                </v-col>
            </v-row>
        </v-card-text>
        <v-card-text v-else>
            <v-row>
                <v-col class="text-center">
                    <span class="text-medium-emphasis">{{ $t('Timelapse.NoTimelapseData') }}</span>
                </v-col>
            </v-row>
        </v-card-text>
        <timelapse-renderingsettings-dialog v-model="boolDialogRendersettings" />
    </panel>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import { useSocket } from '@/composables/useSocket'
import { useBase } from '@/composables/useBase'
import { useTimelapse } from '@/composables/useTimelapse'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import Panel from '@/components/ui/Panel.vue'
import { mdiInformation, mdiCloseThick } from '@mdi/js'
import TimelapseRenderingsettingsDialog from '@/components/dialogs/TimelapseRenderingsettingsDialog.vue'

const { framesCount, estimatedVideoLength } = useTimelapse()
const { apiUrl } = useBase()
const store = useStore()
const socket = useSocket()

const boolDialogRendersettings = ref(false)
const scale = ref(1)
const timelapsePreview = ref<HTMLImageElement | null>(null)

const frameUrl = computed(() => {
    const frame = store.state.server.timelapse?.lastFrame?.file ?? null
    if (frame) {
        return apiUrl.value + '/server/files/timelapse_frames/' + frame
    }
    return null
})

const enabled = computed(() => store.state.server.timelapse?.settings?.enabled ?? false)

function toggleEnabled(newVal: boolean) {
    socket.emit('machine.timelapse.post_settings', { enabled: newVal }, { action: 'server/timelapse/initSettings' })
}

const autorender = computed(() => store.state.server.timelapse?.settings?.autorender ?? false)

function toggleAutorender(newVal: boolean) {
    socket.emit('machine.timelapse.post_settings', { autorender: newVal }, { action: 'server/timelapse/initSettings' })
}

const disableRenderButton = computed(() => (store.state.server.timelapse?.rendering.status ?? '') === 'running')

function saveFrames() {
    socket.emit('machine.timelapse.saveframes', {}, { loading: 'timelapse_saveframes' })
}

function calcRatio() {
    const img = timelapsePreview.value
    if (!img) return
    scale.value = img.naturalHeight / img.naturalWidth
    if (scale.value > 1) {
        scale.value = img.naturalWidth / img.naturalHeight
    }
}
</script>
