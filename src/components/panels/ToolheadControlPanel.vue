<template>
    <panel
        v-if="klipperReadyForGui"
        :icon="mdiGamepad"
        :title="$t('Panels.ToolheadControlPanel.Headline')"
        :collapsible="true"
        card-class="toolhead-control-panel">
        <template #buttons>
            <v-menu v-if="showButtons" left offset-y :close-on-content-click="false" class="pa-0">
                <template #activator="{ props }">
 <v-btn :icon="mdiDotsVertical" rounded="0" v-bind="props" :disabled="['printing'].includes(printer_state)"/>
                </template>
                <v-list density="compact">
                    <v-list-item v-if="controlStyle !== 'bars' && actionButton !== 'm84'">
 <v-btn size="small" style="width: 100%" @click="doSend('M84')">
                            <v-icon start size="small">{{ mdiEngineOff }}</v-icon>
                            {{ $t('Settings.ControlTab.MotorsOff', { isDefault: '' }) }}
                        </v-btn>
                    </v-list-item>
                    <v-list-item v-if="controlStyle !== 'bars' && existsQGL && actionButton !== 'qgl'">
 <v-btn size="small" style="width: 100%" @click="doQGL">Quad Gantry Level</v-btn>
                    </v-list-item>
                    <v-list-item v-if="existsDeltaCalibrate">
 <v-btn size="small" style="width: 100%" @click="doSend('DELTA_CALIBRATE')">DELTA CALIBRATE</v-btn>
                    </v-list-item>
                </v-list>
            </v-menu>
            <toolhead-panel-settings />
        </template>
        <move-to-control />
        <v-container v-if="axisControlVisible">
            <component :is="`${controlStyle}-control`" />
        </v-container>
        <v-divider v-if="showSpeedFactor" />
        <v-container v-if="showSpeedFactor">
            <tool-slider
                :label="$t('Panels.ToolheadControlPanel.SpeedFactor')"
                :icon="mdiSpeedometer"
                :target="speedFactor"
                :min="1"
                :max="200"
                :multi="100"
                :step="5"
                :dynamic-range="true"
                :has-input-field="true"
                command="M220"
                attribute-name="S" />
        </v-container>
    </panel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import { useControl } from '@/composables/useControl'
import BarsControl from '@/components/panels/ToolheadControls/BarsControl.vue'
import CircleControl from '@/components/panels/ToolheadControls/CircleControl.vue'
import CrossControl from '@/components/panels/ToolheadControls/CrossControl.vue'
import MoveToControl from '@/components/panels/ToolheadControls/MoveToControl.vue'
import Panel from '@/components/ui/Panel.vue'
import ToolSlider from '@/components/inputs/ToolSlider.vue'
import { mdiDotsVertical, mdiEngineOff, mdiGamepad, mdiSpeedometer } from '@mdi/js'

const { klipperReadyForGui, printer_state } = useBase()
const { doSend, doQGL, existsQGL, existsDeltaCalibrate } = useControl()

const store = useStore()

const controlStyle = computed(() =>
    store.state.gui.control.style ?? 'bars'
)

const actionButton = computed(() =>
    store.state.gui.control.actionButton ?? store.getters['gui/getDefaultControlActionButton']
)

const speedFactor = computed(() =>
    store.state.printer?.gcode_move?.speed_factor ?? 1
)

const isPrinting = computed(() =>
    ['printing'].includes(printer_state.value)
)

const axisControlVisible = computed(() => {
    if (!showControl.value) return false
    return !(isPrinting.value && (store.state.gui.control.hideDuringPrint ?? false))
})

const showButtons = computed(() => {
    if (controlStyle.value !== 'bars' && existsQGL.value) return true
    return existsDeltaCalibrate.value
})

const showControl = computed(() =>
    store.state.gui.view.toolhead.showControl ?? true
)

const showSpeedFactor = computed(() =>
    store.state.gui.view.toolhead.showSpeedFactor ?? true
)
</script>
