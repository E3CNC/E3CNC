<template>
    <panel v-if="klipperReadyForGui" :icon="mdiGamepad" title="Jog" :collapsible="true" card-class="jog-panel">
        <v-container class="pa-2">
            <v-row density="compact" class="mb-3">
                <v-col cols="12">
                    <v-btn
                        size="small"
                        class="d-block w-100"
                        :disabled="['printing'].includes(printer_state)"
                        :loading="loadings.includes('homeAll')"
                        :color="homedAxes.includes('xyz') ? 'primary' : 'warning'"
                        @click="doHome">
                        <v-icon start class="mr-1">{{ mdiHome }}</v-icon>
                        Home All
                    </v-btn>
                </v-col>
                <v-col cols="6">
                    <v-btn
                        size="small"
                        class="d-block w-100"
                        :disabled="['printing'].includes(printer_state)"
                        :loading="loadings.includes('homeXY')"
                        :color="homedAxes.includes('xy') ? 'primary' : 'warning'"
                        @click="doHomeXY">
                        <v-icon start size="small">{{ mdiHome }}</v-icon>
                        Home XY
                    </v-btn>
                </v-col>
                <v-col cols="6">
                    <v-btn
                        size="small"
                        class="d-block w-100"
                        :disabled="['printing'].includes(printer_state)"
                        :loading="loadings.includes('homeZ')"
                        :color="homedAxes.includes('z') ? 'primary' : 'warning'"
                        @click="doHomeZ">
                        <v-icon start size="small">{{ mdiHome }}</v-icon>
                        Home Z
                    </v-btn>
                </v-col>
            </v-row>

            <v-row density="compact" class="mb-3">
                <v-col cols="12">
                    <v-btn
                        size="small"
                        class="d-block w-100"
                        :disabled="['printing'].includes(printer_state) || homedAxes.length === 0"
                        :color="homedAxes.length > 0 ? 'primary' : 'disabled'"
                        variant="outlined"
                        @click="disableSteppers">
                        <v-icon start size="small">{{ mdiCloseCircleOutline }}</v-icon>
                        Disable Steppers
                    </v-btn>
                </v-col>
            </v-row>

            <v-row density="compact" class="mb-3">
                <v-col cols="12" class="d-flex align-center">
                    <span class="text-caption mr-2">Jog Step:</span>
                    <v-btn-toggle v-model="selectedStepIndex" density="compact" size="small" class="flex-grow-1">
                        <v-btn v-for="(step, idx) in jogSteps" :key="idx" :value="idx" size="x-small">
                            <span class="step-num">{{ step < 1 ? step.toFixed(2) : step }}</span>
                            <span class="step-unit">mm</span>
                        </v-btn>
                    </v-btn-toggle>
                </v-col>
            </v-row>

            <v-row density="compact" class="mb-1">
                <v-col cols="6">
                    <v-text-field
                        v-model.number="feedrateXY"
                        label="XY Feed"
                        type="number"
                        :min="feedMin"
                        :max="feedMax"
                        density="compact"
                        variant="outlined"
                        suffix="mm/min"
                        @change="saveFeedrates" />
                </v-col>
                <v-col cols="6">
                    <v-text-field
                        v-model.number="feedrateZ"
                        label="Z Feed"
                        type="number"
                        :min="feedMin"
                        :max="feedMax"
                        density="compact"
                        variant="outlined"
                        suffix="mm/min"
                        @change="saveFeedrates" />
                </v-col>
            </v-row>

            <v-row density="compact" class="mb-3">
                <v-col cols="6">
                    <input
                        :value="feedrateXY"
                        type="range"
                        :min="feedMin"
                        :max="feedMax"
                        :step="feedStep"
                        :disabled="isFeedSliderDisabled"
                        class="feed-slider"
                        @input="feedrateXY = Number($event.target.value)"
                        @change="saveFeedrates" />
                </v-col>
                <v-col cols="6">
                    <input
                        :value="feedrateZ"
                        type="range"
                        :min="feedMin"
                        :max="feedMax"
                        :step="feedStep"
                        :disabled="isFeedSliderDisabled"
                        class="feed-slider"
                        @input="feedrateZ = Number($event.target.value)"
                        @change="saveFeedrates" />
                </v-col>
            </v-row>

            <v-row density="compact" class="mb-3">
                <v-col cols="12">
                    <div class="d-flex align-center mb-1">
                        <span class="text-caption font-weight-bold mr-2">Feedrate Override</span>
                        <v-chip size="x-small" :color="isPrinting ? 'primary' : 'disabled'" variant="tonal">
                            {{ feedOverrideStore }}%
                        </v-chip>
                        <v-spacer />
                        <span class="text-caption text-medium-emphasis">{{ overrideDisplayValue }}%</span>
                    </div>
                    <input
                        :value="overrideDisplayValue"
                        type="range"
                        min="10"
                        max="300"
                        step="5"
                        class="feed-slider"
                        @input="onFeedOverrideInput(Number($event.target.value))" />
                </v-col>
            </v-row>

            <v-row density="compact" class="mb-3">
                <v-col cols="12">
                    <div class="text-center mb-3 w-100">
                        <span class="text-caption font-weight-bold">Precise Jog</span>
                    </div>
                </v-col>
                <v-col cols="12" sm="4">
                    <v-text-field
                        v-model.number="preciseJogX"
                        label="X"
                        type="number"
                        density="compact"
                        variant="outlined"
                        step="0.001" />
                </v-col>
                <v-col cols="12" sm="4">
                    <v-text-field
                        v-model.number="preciseJogY"
                        label="Y"
                        type="number"
                        density="compact"
                        variant="outlined"
                        step="0.001" />
                </v-col>
                <v-col cols="12" sm="4">
                    <v-text-field
                        v-model.number="preciseJogZ"
                        label="Z"
                        type="number"
                        density="compact"
                        variant="outlined"
                        step="0.001" />
                </v-col>
                <v-col cols="12">
                    <v-row density="compact">
                        <v-col cols="4">
                            <v-btn
                                class="d-block w-100"
                                size="small"
                                variant="outlined"
                                :disabled="['printing'].includes(printer_state) || !xyHomed || preciseJogX === 0"
                                @click="jogPrecise('X', preciseJogX)">
                                Jog X
                            </v-btn>
                        </v-col>
                        <v-col cols="4">
                            <v-btn
                                class="d-block w-100"
                                size="small"
                                variant="outlined"
                                :disabled="['printing'].includes(printer_state) || !xyHomed || preciseJogY === 0"
                                @click="jogPrecise('Y', preciseJogY)">
                                Jog Y
                            </v-btn>
                        </v-col>
                        <v-col cols="4">
                            <v-btn
                                class="d-block w-100"
                                size="small"
                                variant="outlined"
                                :disabled="['printing'].includes(printer_state) || !zHomed || preciseJogZ === 0"
                                @click="jogPrecise('Z', preciseJogZ)">
                                Jog Z
                            </v-btn>
                        </v-col>
                    </v-row>
                </v-col>
            </v-row>

            <v-row density="compact" class="mb-2 justify-center">
                <v-col cols="12" md="6" class="d-flex flex-column align-center">
                    <div class="text-center mb-3 w-100">
                        <span class="text-caption font-weight-bold">XY Jog (<span class="step-num">{{ currentStep < 1 ? currentStep.toFixed(2) : currentStep }}</span><span class="step-unit">mm</span>)</span>
                    </div>
                    <div class="jog-panel__xy-pad">
                        <v-btn
                            class="jog-panel__xy-btn"
                            size="large"
                            :disabled="['printing'].includes(printer_state) || !xyHomed"
                            @click="jog('Y', currentStep)">
                            <v-icon>{{ mdiChevronUp }}</v-icon>
                        </v-btn>
                        <v-btn
                            class="jog-panel__xy-btn"
                            size="large"
                            :disabled="['printing'].includes(printer_state) || !xyHomed"
                            @click="jog('X', -currentStep)">
                            <v-icon>{{ mdiChevronLeft }}</v-icon>
                        </v-btn>
                        <v-btn
                            class="jog-panel__xy-btn jog-panel__xy-center"
                            size="large"
                            variant="outlined"
                            :disabled="['printing'].includes(printer_state) || !xyHomed"
                            @click="jogStop">
                            <v-icon>{{ mdiStop }}</v-icon>
                        </v-btn>
                        <v-btn
                            class="jog-panel__xy-btn"
                            size="large"
                            :disabled="['printing'].includes(printer_state) || !xyHomed"
                            @click="jog('X', currentStep)">
                            <v-icon>{{ mdiChevronRight }}</v-icon>
                        </v-btn>
                        <v-btn
                            class="jog-panel__xy-btn"
                            size="large"
                            :disabled="['printing'].includes(printer_state) || !xyHomed"
                            @click="jog('Y', -currentStep)">
                            <v-icon>{{ mdiChevronDown }}</v-icon>
                        </v-btn>
                    </div>
                </v-col>

                <v-col cols="12" md="6" class="d-flex flex-column justify-center">
                    <div class="text-center mb-3">
                        <span class="text-caption font-weight-bold">Z Jog</span>
                    </div>
                    <v-btn
                        class="jog-panel__jog-btn mb-2 d-block w-100"
                        size="large"
                        :disabled="['printing'].includes(printer_state) || !zHomed"
                        @click="jog('Z', currentStep)">
                        <v-icon>{{ mdiChevronUp }}</v-icon>
                        <span class="ml-2"><span class="step-num">{{ currentStep < 1 ? currentStep.toFixed(2) : currentStep }}</span><span class="step-unit">mm</span> up</span>
                    </v-btn>
                    <v-btn
                        class="jog-panel__jog-btn d-block w-100"
                        size="large"
                        :disabled="['printing'].includes(printer_state) || !zHomed"
                        @click="jog('Z', -currentStep)">
                        <v-icon>{{ mdiChevronDown }}</v-icon>
                        <span class="ml-2"><span class="step-num">{{ currentStep < 1 ? currentStep.toFixed(2) : currentStep }}</span><span class="step-unit">mm</span> down</span>
                    </v-btn>
                </v-col>
            </v-row>

            <v-row density="compact" class="my-2">
                <v-col cols="12">
                    <v-btn
                        size="small"
                        class="d-block w-100"
                        :color="keyboardNavEnabled ? 'primary' : ''"
                        :variant="keyboardNavEnabled ? 'elevated' : 'outlined'"
                        @click="toggleKeyboardNav">
                        <v-icon size="small" start>{{ mdiKeyboard }}</v-icon>
                        Keyboard Nav {{ keyboardNavEnabled ? '(ON)' : '(OFF)' }}
                    </v-btn>
                </v-col>
            </v-row>

            <v-divider class="my-3" />
            <v-row density="compact">
                <v-col cols="6">
                    <span class="text-caption text-medium-emphasis">Status:</span>
                    <v-chip
                        size="small"
                        :color="['printing'].includes(printer_state) ? 'warning' : 'primary'"
                        class="mx-2">
                        {{ printer_state }}
                    </v-chip>
                </v-col>
                <v-col cols="6" class="text-right">
                    <span class="text-caption text-medium-emphasis">Homed:</span>
                    <v-chip size="small" :color="allAxesHomed ? 'primary' : 'warning'" class="mx-2">
                        {{ homedAxesDisplay }}
                    </v-chip>
                </v-col>
            </v-row>
        </v-container>
    </panel>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import { useControl } from '@/composables/useControl'
import { useSocket } from '@/composables/useSocket'
import Panel from '@/components/ui/Panel.vue'
import { buildJogScript, isEditableTarget } from '@/components/panels/Cnc/jogKeyboard'
import {
    mdiGamepad,
    mdiHome,
    mdiChevronUp,
    mdiChevronDown,
    mdiChevronLeft,
    mdiChevronRight,
    mdiStop,
    mdiCloseCircleOutline,
    mdiKeyboard,
} from '@mdi/js'
import { updateCncSettings } from '@/store/files/cncApi'
import { useToast } from 'vue-toast-notification'
import type { ActiveToast } from 'vue-toast-notification/types/toast'

const { printer_state, klipperReadyForGui, socketIsConnected } = useBase()
const { homedAxes, doHome, doHomeXY, doHomeZ, doSend } = useControl()

const store = useStore()
const socket = useSocket()
const toast = useToast()

const keyboardNavEnabled = ref(false)
const keyboardNavToast = ref<ActiveToast | null>(null)
const jogSteps = [0.05, 0.1, 1.0, 5.0, 10.0, 25.0, 100.0]
const lastJogTimestamps: Record<string, number> = {}
const jogRateLimitMs = 50

let keyboardJogHandler: ((event: KeyboardEvent) => void) | null = null

const currentStep = computed(() => jogSteps[selectedStepIndex.value])

const selectedStepIndex = computed({
    get: () => store.state.gui.control.selectedCncStepIndex ?? 2,
    set: (value: number) => {
        store.dispatch('gui/saveSetting', { name: 'control.selectedCncStepIndex', value })
    },
})

const homedAxesDisplay = computed(() => {
    if (homedAxes.value === 'xyz') return 'All'
    return homedAxes.value || 'None'
})

const allAxesHomed = computed(
    () => homedAxes.value.includes('x') && homedAxes.value.includes('y') && homedAxes.value.includes('z')
)

const xyHomed = computed(() => homedAxes.value.includes('x') && homedAxes.value.includes('y'))

const zHomed = computed(() => homedAxes.value.includes('z'))

const toolhead = computed(() => store.state.printer.toolhead ?? {})
const feedMax = computed(() => {
    const maxVel = (toolhead.value as Record<string, unknown>)?.max_velocity
    if (typeof maxVel === 'number' && maxVel > 0) {
        return Math.round(maxVel * 60)
    }
    return 1000
})
const feedMin = 0
const feedStep = 50
const isFeedSliderDisabled = computed(() => ['printing'].includes(printer_state.value) || feedMax.value <= feedMin)

const isPrinting = computed(() => ['printing', 'paused'].includes(printer_state.value))

const feedOverrideStore = computed(() => {
    const factor = store.state.printer.gcode_move?.speed_factor ?? 1
    return Math.round(factor * 100)
})

const overrideDisplayValue = ref(feedOverrideStore.value)

watch(feedOverrideStore, (val) => {
    overrideDisplayValue.value = val
})

let feedOverrideTimer: ReturnType<typeof setTimeout> | null = null

function onFeedOverrideInput(val: number) {
    overrideDisplayValue.value = val
    if (feedOverrideTimer !== null) {
        clearTimeout(feedOverrideTimer)
    }
    feedOverrideTimer = setTimeout(() => {
        const capped = Math.max(10, Math.min(300, val))
        doSend(`M220 S${capped}`)
        feedOverrideTimer = null
    }, 1000)
}

const loadings = computed(() => store.state.server.loadings ?? [])

const feedrateXY = computed({
    get: () => store.state.gui.control.cncFeedrateXY ?? 500,
    set: (value: number) => {
        store.dispatch('gui/saveSetting', { name: 'control.cncFeedrateXY', value })
    },
})

const feedrateZ = computed({
    get: () => store.state.gui.control.cncFeedrateZ ?? 100,
    set: (value: number) => {
        store.dispatch('gui/saveSetting', { name: 'control.cncFeedrateZ', value })
    },
})

const preciseJogX = ref(0)
const preciseJogY = ref(0)
const preciseJogZ = ref(0)

function saveFeedrates() {
    void updateCncSettings(store.getters['socket/getUrl'], {
        feedrateXY: feedrateXY.value,
        feedrateZ: feedrateZ.value,
    }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Failed to persist CNC feedrates'
        toast.error(message)
    })
}

function formatStep(step: number): string {
    if (step < 1) return `${step.toFixed(2)}mm`
    return `${step}mm`
}

function jog(axis: string, distance: number) {
    if (!socketIsConnected.value) {
        toast.error('Cannot jog — not connected to printer')
        return
    }

    const key = `${axis}${distance >= 0 ? '+' : '-'}`
    const now = Date.now()
    const last = lastJogTimestamps[key] ?? 0
    if (now - last < jogRateLimitMs) return
    lastJogTimestamps[key] = now

    const feedrate = getAxisFeedrate(axis)
    const script = buildJogScript(axis, distance, feedrate)
    socket.emit('printer.gcode.script', { script })
}

function jogPrecise(axis: string, distance: number) {
    if (distance === 0) return
    jog(axis, distance)
}

function showKeyboardNavToast(step: number) {
    keyboardNavToast.value = toast.warning(
        `KEYBOARD NAVIGATION IS ON, BE CAREFULL! (jog step: ${formatStep(step)})`,
        {
            position: 'bottom',
            duration: 0,
            onDismiss: () => {
                keyboardNavEnabled.value = false
                keyboardNavToast.value = null
            },
        }
    )
}

function toggleKeyboardNav() {
    keyboardNavEnabled.value = !keyboardNavEnabled.value
    if (keyboardNavEnabled.value) {
        showKeyboardNavToast(currentStep.value)
    } else if (keyboardNavToast.value) {
        keyboardNavToast.value.dismiss()
        keyboardNavToast.value = null
    }
}

watch(currentStep, (newStep) => {
    if (keyboardNavEnabled.value && keyboardNavToast.value) {
        keyboardNavToast.value.dismiss()
        showKeyboardNavToast(newStep)
    }
})

function disableSteppers() {
    doSend('M18')
}

function jogStop() {
    doSend('M112')
}

function getAxisFeedrate(axis: string): number {
    if (axis === 'Z') return feedrateZ.value
    return feedrateXY.value
}

function handleKeyboardJog(event: KeyboardEvent) {
    if (!keyboardNavEnabled.value || ['printing'].includes(printer_state.value)) return

    if (isEditableTarget(event.target)) return

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault()
    }

    const step = currentStep.value
    switch (event.key) {
        case 'ArrowUp':
            void jog('Y', step)
            break
        case 'ArrowDown':
            void jog('Y', -step)
            break
        case 'ArrowLeft':
            void jog('X', -step)
            break
        case 'ArrowRight':
            void jog('X', step)
            break
    }
}

onMounted(() => {
    keyboardJogHandler = handleKeyboardJog
    document.addEventListener('keydown', keyboardJogHandler, true)
})

onBeforeUnmount(() => {
    if (keyboardJogHandler) {
        document.removeEventListener('keydown', keyboardJogHandler, true)
    }
})
</script>

<style scoped>
.jog-panel__xy-pad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    max-width: 220px;
    margin: 0 auto;
}

.jog-panel__xy-btn {
    aspect-ratio: 1 / 1;
    min-width: 60px !important;
}

.jog-panel__xy-center {
    grid-column: 2;
    grid-row: 2;
}

.jog-panel__xy-pad .v-btn:nth-child(1) {
    grid-column: 2;
    grid-row: 1;
}

.jog-panel__xy-pad .v-btn:nth-child(2) {
    grid-column: 1;
    grid-row: 2;
}

.jog-panel__xy-pad .v-btn:nth-child(3) {
    grid-column: 2;
    grid-row: 2;
}

.jog-panel__xy-pad .v-btn:nth-child(4) {
    grid-column: 3;
    grid-row: 2;
}

.jog-panel__xy-pad .v-btn:nth-child(5) {
    grid-column: 2;
    grid-row: 3;
}

.jog-panel .v-row {
    margin-left: -4px !important;
    margin-right: -4px !important;
}

.jog-panel .v-col {
    padding: 4px !important;
}

.jog-panel .v-row.mb-3 {
    margin-top: 4px !important;
    margin-bottom: 12px !important;
}

.jog-panel .v-row.mb-3 .v-row {
    margin-left: -4px !important;
    margin-right: -4px !important;
}

.jog-panel .v-row.mb-2 {
    margin-top: 4px !important;
    margin-bottom: 8px !important;
}

.jog-panel .v-row.my-2 {
    margin-top: 8px !important;
    margin-bottom: 8px !important;
}
</style>

<style>
.jog-panel {
    background-color: rgb(var(--v-theme-surface)) !important;
}

.jog-panel .v-btn-toggle .v-btn,
.jog-panel .jog-panel__xy-btn,
.jog-panel .jog-panel__jog-btn {
    background-color: rgb(var(--v-theme-surface)) !important;
    border: 1px solid rgba(var(--v-theme-on-surface), 0.23) !important;
}

.jog-panel .jog-panel__xy-btn:hover,
.jog-panel .jog-panel__jog-btn:hover {
    background-color: rgb(var(--v-theme-primary)) !important;
    color: rgb(var(--v-theme-on-primary)) !important;
    border-color: rgb(var(--v-theme-primary)) !important;
}

.jog-panel .v-btn-toggle .v-btn:not(.v-btn--active) {
    opacity: 0.8 !important;
}

.jog-panel .v-btn-toggle {
    background-color: transparent !important;
    height: 20px !important;
    min-height: 20px !important;
}

.jog-panel .v-input__details {
    display: none !important;
}

.feed-slider {
    width: 100%;
    height: 8px;
    -webkit-appearance: none;
    appearance: none;
    background: rgba(var(--v-theme-on-surface), 0.23);
    border-radius: 4px;
    outline: none;
    cursor: pointer;
}

.feed-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgb(var(--v-theme-primary));
    cursor: pointer;
    border: 3px solid rgb(var(--v-theme-surface));
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.feed-slider::-moz-range-thumb {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgb(var(--v-theme-primary));
    cursor: pointer;
    border: 3px solid rgb(var(--v-theme-surface));
}

.feed-slider:disabled {
    opacity: 0.4;
    cursor: default;
}

.step-unit {
    font-size: 0.75rem;
    opacity: 1;
    font-weight: 600;
    vertical-align: bottom;
}

.step-num {
    font-size: 0.75rem;
    opacity: 1;
    font-weight: 600;
    vertical-align: bottom;
}

.jog-panel .panel-toolbar {
    background-color: rgb(var(--v-theme-surface)) !important;
}
</style>
