<template>
    <panel v-if="klipperReadyForGui" :icon="mdiCrosshairsGps" title="DRO" :collapsible="true" card-class="dro-panel">
        <v-container class="py-2">
            <div class="dro-panel__meta">
                <v-chip size="small" label variant="outlined" class="mr-2">{{ coordinateModeLabel }}</v-chip>
                <v-chip size="small" label variant="outlined" class="mr-2">Vel {{ liveVelocity }}</v-chip>
                <v-chip size="small" label variant="outlined" :color="allAxesHomed ? 'primary' : 'warning'">
                    {{ allAxesHomed ? 'Homed' : 'Not Homed' }}
                </v-chip>
            </div>

            <div class="dro-panel__axis-grid">
                <section v-for="axis in axes" :key="axis.id" class="dro-panel__axis-card">
                    <div class="dro-panel__axis-header">
                        <span class="dro-panel__axis-name">{{ axis.id }}</span>
                        <v-chip size="x-small" :color="axis.homed ? 'primary' : 'warning'">
                            {{ axis.homed ? 'HOMED' : 'OPEN' }}
                        </v-chip>
                    </div>
                    <div v-if="showMachineCoords" class="dro-panel__axis-section">
                        <span class="dro-panel__label">Machine</span>
                        <span class="dro-panel__value">{{ axis.machine }}</span>
                    </div>
                    <div class="dro-panel__axis-section">
                        <span class="dro-panel__label">Work</span>
                        <span class="dro-panel__value">{{ axis.work }}</span>
                    </div>
                    <div class="dro-panel__axis-section">
                        <span class="dro-panel__label">Offset</span>
                        <span class="dro-panel__offset">{{ axis.offset }}</span>
                    </div>
                    <div class="dro-panel__limit-row">
                        <span class="dro-panel__limit">Min {{ axis.min }}</span>
                        <span class="dro-panel__limit">Max {{ axis.max }}</span>
                    </div>
                </section>
            </div>

            <div class="dro-panel__homed">
                <v-chip size="small" :color="xAxisHomed ? 'primary' : 'warning'" class="mr-2">
                    X {{ xAxisHomed ? 'OK' : '--' }}
                </v-chip>
                <v-chip size="small" :color="yAxisHomed ? 'primary' : 'warning'" class="mr-2">
                    Y {{ yAxisHomed ? 'OK' : '--' }}
                </v-chip>
                <v-chip size="small" :color="zAxisHomed ? 'primary' : 'warning'">
                    Z {{ zAxisHomed ? 'OK' : '--' }}
                </v-chip>
            </div>
        </v-container>
    </panel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import { useControl } from '@/composables/useControl'
import { useCncProfile } from '@/composables/useCncProfile'
import Panel from '@/components/ui/Panel.vue'
import { mdiCrosshairsGps } from '@mdi/js'

const { klipperReadyForGui } = useBase()
const { absolute_coordinates, xAxisHomed, yAxisHomed, zAxisHomed } = useControl()
const { showMachineCoords } = useCncProfile()

const store = useStore()

const machinePosition = computed(() => {
    const p = store.state.printer?.motion_report?.live_position ?? [0, 0, 0, 0]
    return { x: p[0] ?? 0, y: p[1] ?? 0, z: p[2] ?? 0 }
})

const workPosition = computed(() => {
    const p = store.state.printer?.gcode_move?.gcode_position ?? [0, 0, 0, 0]
    return { x: p[0] ?? 0, y: p[1] ?? 0, z: p[2] ?? 0 }
})

const workOffset = computed(() => ({
    x: machinePosition.value.x - workPosition.value.x,
    y: machinePosition.value.y - workPosition.value.y,
    z: machinePosition.value.z - workPosition.value.z,
}))

const axisMinimum = computed(() => {
    const p = store.state.printer?.toolhead?.axis_minimum ?? [0, 0, 0, 0]
    return { x: p[0] ?? 0, y: p[1] ?? 0, z: p[2] ?? 0 }
})

const axisMaximum = computed(() => {
    const p = store.state.printer?.toolhead?.axis_maximum ?? [0, 0, 0, 0]
    return { x: p[0] ?? 0, y: p[1] ?? 0, z: p[2] ?? 0 }
})

const coordinateModeLabel = computed(() => (absolute_coordinates.value ? 'Absolute (G90)' : 'Relative (G91)'))

const liveVelocity = computed(() => {
    const v = store.state.printer?.motion_report?.live_velocity ?? 0
    return `${Number(v).toFixed(2)} mm/s`
})

const allAxesHomed = computed(() => xAxisHomed.value && yAxisHomed.value && zAxisHomed.value)

function formatAxis(value: number) {
    return parseFloat(Number(value ?? 0).toFixed(2)).toString()
}

const machineX = computed(() => formatAxis(machinePosition.value.x))
const machineY = computed(() => formatAxis(machinePosition.value.y))
const machineZ = computed(() => formatAxis(machinePosition.value.z))

const workX = computed(() => formatAxis(workPosition.value.x))
const workY = computed(() => formatAxis(workPosition.value.y))
const workZ = computed(() => formatAxis(workPosition.value.z))

const axes = computed(() => [
    {
        id: 'X',
        homed: xAxisHomed.value,
        machine: machineX.value,
        work: workX.value,
        offset: formatSigned(workOffset.value.x),
        min: formatAxis(axisMinimum.value.x),
        max: formatAxis(axisMaximum.value.x),
    },
    {
        id: 'Y',
        homed: yAxisHomed.value,
        machine: machineY.value,
        work: workY.value,
        offset: formatSigned(workOffset.value.y),
        min: formatAxis(axisMinimum.value.y),
        max: formatAxis(axisMaximum.value.y),
    },
    {
        id: 'Z',
        homed: zAxisHomed.value,
        machine: machineZ.value,
        work: workZ.value,
        offset: formatSigned(workOffset.value.z),
        min: formatAxis(axisMinimum.value.z),
        max: formatAxis(axisMaximum.value.z),
    },
])

function formatSigned(value: number) {
    const output = parseFloat(Number(value ?? 0).toFixed(2)).toString()
    return value > 0 ? `+${output}` : output
}
</script>

<style scoped>
.dro-panel__meta,
.dro-panel__homed {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
}

.dro-panel__axis-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.65rem;
    margin: 0.75rem 0 1rem;
    align-items: start;
}

.dro-panel__axis-card {
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    border-radius: 0.5rem;
    padding: 0.6rem 0.75rem;
    background: rgba(var(--v-theme-on-surface), 0.02);
}

.dro-panel__axis-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.6rem;
}

.dro-panel__axis-name {
    font-size: 0.95rem;
    font-weight: 800;
}

.dro-panel__axis-section {
    display: grid;
    gap: 0.2rem;
    margin-bottom: 0.55rem;
}

.dro-panel__label {
    font-size: 0.68rem;
    text-transform: uppercase;
    opacity: 0.68;
}

.dro-panel__value {
    font-size: 1.25rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
}

.dro-panel__offset {
    font-size: 0.92rem;
    font-variant-numeric: tabular-nums;
    opacity: 0.9;
}

.dro-panel__limit-row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding-top: 0.25rem;
    margin-top: 0.2rem;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.dro-panel__limit {
    font-size: 0.72rem;
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
}

@media (max-width: 580px) {
    .dro-panel__axis-grid {
        grid-template-columns: 1fr;
        gap: 0.65rem;
    }
}
</style>
