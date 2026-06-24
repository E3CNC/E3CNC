<template>
    <panel
        v-if="klipperReadyForGui && showWorkCoords"
        :icon="mdiGrid"
        title="WCS"
        :collapsible="true"
        :toolbar-color="activeWcsToolbarColor"
        toolbar-class="wcs-panel__toolbar"
        card-class="wcs-panel">
        <template #buttons>
            <v-btn
                variant="text"
                size="small"
                :color="snapToGrid ? 'primary' : undefined"
                @click="snapToGrid = !snapToGrid">
                <v-icon>{{ mdiMagnet }}</v-icon>
            </v-btn>
            <v-menu offset-y>
                <template #activator="{ props }">
                    <v-btn variant="text" size="small" v-bind="props">
                        {{ gridStep }}mm
                        <v-icon end>{{ mdiChevronDown }}</v-icon>
                    </v-btn>
                </template>
                <v-list dense>
                    <v-list-item
                        v-for="step in gridStepOptions"
                        :key="step"
                        :active="step === gridStep"
                        @click="gridStep = step">
                        <v-list-item-title>{{ step }}mm</v-list-item-title>
                    </v-list-item>
                </v-list>
            </v-menu>
        </template>
        <div class="offset-preview-container">
            <div class="offset-preview-layout">
                <div class="offset-preview-layout__preview" :style="previewCursorStyle">
                    <svg
                        ref="svgEl"
                        :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
                        class="offset-preview-svg"
                        preserveAspectRatio="xMidYMid meet"
                        xmlns="http://www.w3.org/2000/svg"
                        @mousemove="onSvgMouseMove"
                        @mouseleave="onSvgMouseLeave"
                        @click="onSvgClick">
                        <!-- Machine bounds background -->
                        <rect
                            :x="padding"
                            :y="padding"
                            :width="plotWidth"
                            :height="plotHeight"
                            fill="rgb(var(--v-theme-surface))"
                            :stroke="previewStrokeColor"
                            stroke-width="1" />

                        <!-- Grid lines -->
                        <line
                            v-for="gx in gridLinesX"
                            :key="'gx-' + gx"
                            :x1="toSvgX(gx)"
                            :y1="padding"
                            :x2="toSvgX(gx)"
                            :y2="padding + plotHeight"
                            stroke="rgba(var(--v-theme-on-surface), 0.06)"
                            stroke-width="0.5" />
                        <line
                            v-for="gy in gridLinesY"
                            :key="'gy-' + gy"
                            :x1="padding"
                            :y1="toSvgY(gy)"
                            :x2="padding + plotWidth"
                            :y2="toSvgY(gy)"
                            stroke="rgba(var(--v-theme-on-surface), 0.06)"
                            stroke-width="0.5" />

                        <!-- Offset origin markers (back to front, inactive first) -->
                        <g
                            v-for="entry in sortedOffsets"
                            v-show="isOffsetVisible(entry.name)"
                            :key="'wcs-' + entry.name"
                            class="offset-rect-group"
                            :class="{ 'offset-rect--active': entry.name === activeWcs }"
                            style="cursor: pointer"
                            @click="onSelectWcs(entry.name)">
                            <line
                                :x1="toSvgX(entry.offsetX) - 8"
                                :y1="toSvgY(entry.offsetY)"
                                :x2="toSvgX(entry.offsetX) + 8"
                                :y2="toSvgY(entry.offsetY)"
                                :stroke="entry.color"
                                :stroke-width="entry.name === activeWcs ? 2 : 1.5"
                                :stroke-opacity="entry.name === activeWcs ? 1 : 0.75"
                                stroke-linecap="round" />
                            <line
                                :x1="toSvgX(entry.offsetX)"
                                :y1="toSvgY(entry.offsetY) - 8"
                                :x2="toSvgX(entry.offsetX)"
                                :y2="toSvgY(entry.offsetY) + 8"
                                :stroke="entry.color"
                                :stroke-width="entry.name === activeWcs ? 2 : 1.5"
                                :stroke-opacity="entry.name === activeWcs ? 1 : 0.75"
                                stroke-linecap="round" />
                        </g>

                        <!-- Stock size rectangles (origin at bottom-left of stock) -->
                        <g
                            v-for="entry in allOffsetEntries"
                            v-show="isOffsetVisible(entry.name)"
                            :key="'stock-' + entry.name"
                            style="pointer-events: none">
                            <rect
                                v-if="stockSizes[entry.name]"
                                :x="toSvgX(entry.offsetX)"
                                :y="toSvgY(entry.offsetY + stockSizes[entry.name].height)"
                                :width="
                                    Math.max(
                                        0,
                                        toSvgX(entry.offsetX + stockSizes[entry.name].width) - toSvgX(entry.offsetX)
                                    )
                                "
                                :height="
                                    Math.max(
                                        0,
                                        toSvgY(entry.offsetY) - toSvgY(entry.offsetY + stockSizes[entry.name].height)
                                    )
                                "
                                fill="none"
                                :stroke="entry.color"
                                stroke-width="1.5"
                                stroke-opacity="0.6" />
                            <text
                                v-if="stockSizes[entry.name]"
                                :x="toSvgX(entry.offsetX + stockSizes[entry.name].width / 2)"
                                :y="toSvgY(entry.offsetY + stockSizes[entry.name].height) - 4"
                                text-anchor="middle"
                                :fill="entry.color"
                                font-size="7"
                                opacity="0.7">
                                {{ stockSizes[entry.name].name || entry.name }}
                            </text>
                        </g>

                        <!-- Cursor crosshair -->
                        <template v-if="cursorInfo">
                            <line
                                :x1="padding"
                                :y1="toSvgY(cursorInfo.y)"
                                :x2="Math.max(padding, toSvgX(cursorInfo.x - gridStep))"
                                :y2="toSvgY(cursorInfo.y)"
                                stroke="rgba(var(--v-theme-on-surface), 0.45)"
                                stroke-width="1"
                                stroke-dasharray="3 3" />
                            <line
                                :x1="Math.min(padding + plotWidth, toSvgX(cursorInfo.x + gridStep))"
                                :y1="toSvgY(cursorInfo.y)"
                                :x2="padding + plotWidth"
                                :y2="toSvgY(cursorInfo.y)"
                                stroke="rgba(var(--v-theme-on-surface), 0.45)"
                                stroke-width="1"
                                stroke-dasharray="3 3" />
                            <line
                                :x1="toSvgX(cursorInfo.x)"
                                :y1="padding"
                                :x2="toSvgX(cursorInfo.x)"
                                :y2="Math.max(padding, toSvgY(cursorInfo.y + gridStep))"
                                stroke="rgba(var(--v-theme-on-surface), 0.45)"
                                stroke-width="1"
                                stroke-dasharray="3 3" />
                            <line
                                :x1="toSvgX(cursorInfo.x)"
                                :y1="Math.min(padding + plotHeight, toSvgY(cursorInfo.y - gridStep))"
                                :x2="toSvgX(cursorInfo.x)"
                                :y2="padding + plotHeight"
                                stroke="rgba(var(--v-theme-on-surface), 0.45)"
                                stroke-width="1"
                                stroke-dasharray="3 3" />
                        </template>

                        <!-- Snap crosshair indicator -->
                        <template v-if="snapToGrid && snapInfo">
                            <line
                                :x1="toSvgX(snapInfo.x) - 8"
                                :y1="toSvgY(snapInfo.y)"
                                :x2="toSvgX(snapInfo.x) + 8"
                                :y2="toSvgY(snapInfo.y)"
                                stroke="rgba(var(--v-theme-on-surface), 0.7)"
                                stroke-width="1"
                                stroke-dasharray="3 2" />
                            <line
                                :x1="toSvgX(snapInfo.x)"
                                :y1="toSvgY(snapInfo.y) - 8"
                                :x2="toSvgX(snapInfo.x)"
                                :y2="toSvgY(snapInfo.y) + 8"
                                stroke="rgba(var(--v-theme-on-surface), 0.7)"
                                stroke-width="1"
                                stroke-dasharray="3 2" />
                            <circle
                                :cx="toSvgX(snapInfo.x)"
                                :cy="toSvgY(snapInfo.y)"
                                r="3"
                                fill="none"
                                stroke="rgba(var(--v-theme-on-surface), 0.5)"
                                stroke-width="1" />
                        </template>

                        <!-- Tool position dot -->
                        <g v-if="toolVisible" class="tool-dot-group">
                            <circle
                                :cx="toSvgX(displayToolX)"
                                :cy="toSvgY(displayToolY)"
                                r="6"
                                fill="rgb(var(--v-theme-primary))"
                                stroke="rgb(var(--v-theme-on-surface))"
                                stroke-width="2" />
                            <circle
                                :cx="toSvgX(displayToolX)"
                                :cy="toSvgY(displayToolY)"
                                r="10"
                                fill="none"
                                stroke="rgb(var(--v-theme-primary))"
                                stroke-width="1"
                                opacity="0.4"
                                class="tool-dot-pulse" />
                        </g>

                        <!-- Axis labels -->
                        <text
                            :x="padding + plotWidth / 2"
                            :y="svgHeight - 2"
                            text-anchor="middle"
                            fill="rgba(var(--v-theme-on-surface), 0.5)"
                            font-size="9">
                            X ({{ machineMaxX.toFixed(0) }}mm)
                        </text>
                        <text
                            :x="padding - 8"
                            :y="padding + plotHeight / 2"
                            text-anchor="middle"
                            fill="rgba(var(--v-theme-on-surface), 0.5)"
                            font-size="9"
                            :transform="`rotate(-90, ${padding - 8}, ${padding + plotHeight / 2})`">
                            Y ({{ machineMaxY.toFixed(0) }}mm)
                        </text>
                    </svg>
                </div>

                <div class="offset-preview-layout__details">
                    <!-- Legend -->
                    <div class="offset-preview-legend">
                        <div
                            v-for="entry in allOffsetEntries"
                            :key="'legend-' + entry.name"
                            class="offset-preview-legend__card"
                            :class="{ 'offset-preview-legend__card--active': entry.name === activeWcs }"
                            :style="{ borderColor: entry.color }"
                            style="cursor: pointer"
                            @click="onSelectWcs(entry.name)">
                            <div class="offset-preview-legend__card-header">
                                <span class="offset-preview-legend__swatch" :style="{ backgroundColor: entry.color }" />
                                <span class="offset-preview-legend__card-title">{{ entry.name }}</span>
                                <span class="offset-preview-legend__card-origin">
                                    <span class="offset-preview-legend__card-axis" :style="{ color: entry.color }">
                                        x
                                    </span>
                                    <span class="offset-preview-legend__card-number">
                                        {{ formatOffsetValue(entry.offsetX) }}
                                    </span>
                                    <span class="offset-preview-legend__card-axis" :style="{ color: entry.color }">
                                        y
                                    </span>
                                    <span class="offset-preview-legend__card-number">
                                        {{ formatOffsetValue(entry.offsetY) }}
                                    </span>
                                    <span class="offset-preview-legend__card-axis" :style="{ color: entry.color }">
                                        z
                                    </span>
                                    <span class="offset-preview-legend__card-number">
                                        {{ formatOffsetValue(entry.offsetZ) }}
                                    </span>
                                </span>
                                <v-icon
                                    size="x-small"
                                    class="offset-preview-legend__card-eye"
                                    :style="{
                                        color: isOffsetVisible(entry.name) ? 'rgb(var(--v-theme-primary))' : undefined,
                                        opacity: isOffsetVisible(entry.name) ? 1 : 0.5,
                                    }"
                                    @click.stop="toggleOffsetVisibility(entry.name)">
                                    {{ isOffsetVisible(entry.name) ? mdiEye : mdiEyeOff }}
                                </v-icon>
                                <v-btn
                                    icon
                                    variant="tonal"
                                    color="primary"
                                    size="x-small"
                                    density="compact"
                                    class="offset-preview-legend__card-edit"
                                    :aria-label="`Edit stock size for ${entry.name}`"
                                    @click.stop="openStockDialog(entry.name)">
                                    <v-icon size="x-small">{{ mdiPencilPlusOutline }}</v-icon>
                                </v-btn>
                            </div>
                            <div v-if="stockSizes[entry.name]" class="offset-preview-legend__card-stock">
                                <div class="offset-preview-legend__card-stock-content">
                                    <div class="offset-preview-legend__card-stock-name">
                                        {{ stockSizes[entry.name].name || entry.name }}
                                    </div>
                                    <div class="offset-preview-legend__card-stock-dims">
                                        <span>{{ stockSizes[entry.name].width }}W</span>
                                        <span class="offset-preview-legend__card-sep">&times;</span>
                                        <span>{{ stockSizes[entry.name].height }}H</span>
                                        <template v-if="stockSizes[entry.name].depth">
                                            <span class="offset-preview-legend__card-sep">&times;</span>
                                            <span>{{ stockSizes[entry.name].depth }}D</span>
                                        </template>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="offset-preview-legend__item offset-preview-legend__item--tool">
                            <span class="offset-preview-legend__swatch offset-preview-legend__swatch--tool" />
                            <span class="offset-preview-legend__label">Tool</span>
                            <span class="offset-preview-legend__coords">
                                ({{ displayToolX.toFixed(1) }}, {{ displayToolY.toFixed(1) }})
                            </span>
                        </div>
                    </div>

                    <div class="offset-preview-controls">
                        <v-card variant="outlined" class="offset-preview-summary-card">
                            <v-card-text class="offset-preview-summary-card__text">
                                <div class="offset-preview-summary-grid">
                                    <div class="offset-preview-summary-grid__section">
                                        <span class="text-caption font-weight-bold section-label">Work Position:</span>
                                        <div class="compact-axis-list">
                                            <span class="compact-axis compact-axis--stacked">
                                                X
                                                <strong>{{ currentWorkX.toFixed(3) }}</strong>
                                            </span>
                                            <span class="compact-axis compact-axis--stacked">
                                                Y
                                                <strong>{{ currentWorkY.toFixed(3) }}</strong>
                                            </span>
                                            <span class="compact-axis compact-axis--stacked">
                                                Z
                                                <strong>{{ currentWorkZ.toFixed(3) }}</strong>
                                            </span>
                                        </div>
                                    </div>

                                    <div class="offset-preview-summary-grid__section">
                                        <span class="text-caption font-weight-bold section-label">
                                            Origin Offset (machine):
                                        </span>
                                        <div class="compact-axis-list compact-axis-list--muted">
                                            <span class="compact-axis compact-axis--stacked">
                                                X
                                                <strong>{{ wcsOriginOffsetX.toFixed(3) }}</strong>
                                            </span>
                                            <span class="compact-axis compact-axis--stacked">
                                                Y
                                                <strong>{{ wcsOriginOffsetY.toFixed(3) }}</strong>
                                            </span>
                                            <span class="compact-axis compact-axis--stacked">
                                                Z
                                                <strong>{{ wcsOriginOffsetZ.toFixed(3) }}</strong>
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </v-card-text>
                        </v-card>

                        <v-row
                            density="compact"
                            class="offset-preview-controls__row offset-preview-controls__row--tight">
                            <v-col cols="12">
                                <span class="text-caption font-weight-bold">Set Work Zero:</span>
                            </v-col>
                            <v-col cols="6" md="3">
                                <v-btn
                                    size="small"
                                    block
                                    variant="outlined"
                                    :disabled="offsetActionsLocked"
                                    @click="onSetWorkZeroClick('X')">
                                    <v-icon size="small" start>{{ mdiTarget }}</v-icon>
                                    Set X
                                </v-btn>
                            </v-col>
                            <v-col cols="6" md="3">
                                <v-btn
                                    size="small"
                                    block
                                    variant="outlined"
                                    :disabled="offsetActionsLocked"
                                    @click="onSetWorkZeroClick('Y')">
                                    <v-icon size="small" start>{{ mdiTarget }}</v-icon>
                                    Set Y
                                </v-btn>
                            </v-col>
                            <v-col cols="6" md="3">
                                <v-btn
                                    size="small"
                                    block
                                    variant="outlined"
                                    :disabled="offsetActionsLocked"
                                    @click="onSetWorkZeroClick('Z')">
                                    <v-icon size="small" start>{{ mdiAxisZArrow }}</v-icon>
                                    Set Z
                                </v-btn>
                            </v-col>
                            <v-col cols="6" md="3">
                                <v-btn
                                    size="small"
                                    block
                                    variant="outlined"
                                    :disabled="offsetActionsLocked"
                                    @click="onSetWorkZeroClick('ALL')">
                                    <v-icon size="small" start>{{ mdiTarget }}</v-icon>
                                    Set All
                                </v-btn>
                            </v-col>
                        </v-row>

                        <v-row
                            density="compact"
                            class="offset-preview-controls__row offset-preview-controls__row--tight">
                            <v-col cols="12">
                                <span class="text-caption font-weight-bold">Manual Offset:</span>
                            </v-col>
                            <v-col cols="12" sm="4">
                                <v-text-field
                                    v-model.number="offsetInputX"
                                    label="X"
                                    type="number"
                                    density="compact"
                                    variant="outlined"
                                    step="0.001" />
                            </v-col>
                            <v-col cols="12" sm="4">
                                <v-text-field
                                    v-model.number="offsetInputY"
                                    label="Y"
                                    type="number"
                                    density="compact"
                                    variant="outlined"
                                    step="0.001" />
                            </v-col>
                            <v-col cols="12" sm="4">
                                <v-text-field
                                    v-model.number="offsetInputZ"
                                    label="Z"
                                    type="number"
                                    density="compact"
                                    variant="outlined"
                                    step="0.001" />
                            </v-col>
                        </v-row>

                        <v-row
                            density="compact"
                            class="offset-preview-controls__row offset-preview-controls__row--actions">
                            <v-col cols="12">
                                <v-btn
                                    size="small"
                                    block
                                    variant="outlined"
                                    :disabled="offsetActionsLocked"
                                    @click="resetOffsets">
                                    <v-icon size="small" start>{{ mdiRestart }}</v-icon>
                                    Reset
                                </v-btn>
                            </v-col>
                        </v-row>
                    </div>
                </div>
            </div>

            <confirmation-dialog
                v-model="zeroConfirmDialogOpen"
                :title="zeroConfirmTitle"
                :text="zeroConfirmText"
                :action-button-text="$t('Buttons.Yes')"
                :cancel-button-text="$t('Buttons.No')"
                @action="runZeroConfirmAction" />

            <!-- Cursor coordinate tooltip (teleported to body to avoid clipping) -->
            <Teleport to="body">
                <div
                    v-if="cursorInfo"
                    class="offset-preview-tooltip"
                    :style="{ left: tooltipLeft + 'px', top: tooltipTop + 'px' }">
                    X {{ cursorInfo.x.toFixed(1) }} &nbsp; Y {{ cursorInfo.y.toFixed(1) }}
                </div>
            </Teleport>
        </div>

        <!-- Stock size dialog -->
        <v-dialog v-model="stockDialogOpen" max-width="320">
            <v-card>
                <v-card-title class="text-subtitle-1">Stock — {{ stockDialogWcs }}</v-card-title>
                <v-card-text>
                    <v-row dense>
                        <v-col cols="12">
                            <v-text-field
                                v-model="stockDialogName"
                                label="Name"
                                density="compact"
                                variant="outlined"
                                :placeholder="stockDialogWcs" />
                        </v-col>
                    </v-row>
                    <v-row dense>
                        <v-col cols="12">
                            <v-text-field
                                v-model.number="stockDialogWidth"
                                label="Width (mm)"
                                type="number"
                                density="compact"
                                variant="outlined"
                                :min="0"
                                :max="machineMaxX - machineMinX"
                                :error="stockDialogWidth > machineMaxX - machineMinX"
                                :hint="
                                    stockDialogWidth > machineMaxX - machineMinX
                                        ? `Max: ${machineMaxX - machineMinX}mm`
                                        : undefined
                                "
                                persistent-hint />
                        </v-col>
                        <v-col cols="12">
                            <v-text-field
                                v-model.number="stockDialogHeight"
                                label="Height (mm)"
                                type="number"
                                density="compact"
                                variant="outlined"
                                :min="0"
                                :max="machineMaxY - machineMinY"
                                :error="stockDialogHeight > machineMaxY - machineMinY"
                                :hint="
                                    stockDialogHeight > machineMaxY - machineMinY
                                        ? `Max: ${machineMaxY - machineMinY}mm`
                                        : undefined
                                "
                                persistent-hint />
                        </v-col>
                        <v-col cols="12">
                            <v-text-field
                                v-model.number="stockDialogDepth"
                                label="Depth (mm)"
                                type="number"
                                density="compact"
                                variant="outlined"
                                :min="0" />
                        </v-col>
                    </v-row>
                    <v-alert v-if="stockDialogError" type="error" density="compact" class="mt-2" variant="tonal">
                        {{ stockDialogError }}
                    </v-alert>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" size="small" @click="stockDialogOpen = false">Cancel</v-btn>
                    <v-btn
                        variant="text"
                        size="small"
                        color="primary"
                        :disabled="!!stockDialogError"
                        @click="saveStockDialog">
                        Save
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- Home confirmation dialog -->
        <v-dialog v-model="homeConfirmDialogOpen" persistent max-width="400" @keydown="onHomeDialogKeydown">
            <v-card>
                <v-card-title class="text-subtitle-1">
                    <v-icon start>{{ mdiAlert }}</v-icon>
                    Machine Not Homed
                </v-card-title>
                <v-card-text>
                    <p class="mb-4">The machine must be homed before it can move to the selected position.</p>
                    <div class="d-flex align-center justify-center ga-4 py-2">
                        <v-chip size="small" color="primary" variant="flat" class="text-uppercase font-weight-bold">
                            Enter
                        </v-chip>
                        <span class="text-body-2 text-medium-emphasis">to home then move</span>
                        <v-chip size="small" color="primary" variant="outlined" class="text-uppercase font-weight-bold">
                            Esc
                        </v-chip>
                        <span class="text-body-2 text-medium-emphasis">to cancel</span>
                    </div>
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="cancelHome">{{ $t('Buttons.Cancel') }}</v-btn>
                    <v-btn variant="text" color="primary" @click="confirmHome">
                        {{ $t('Buttons.Yes') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </panel>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import { useCncProfile } from '@/composables/useCncProfile'
import { useToast } from 'vue-toast-notification'
import Panel from '@/components/ui/Panel.vue'
import {
    mdiGrid,
    mdiChevronDown,
    mdiMagnet,
    mdiEye,
    mdiEyeOff,
    mdiTarget,
    mdiAxisZArrow,
    mdiPencilPlusOutline,
    mdiAlert,
    mdiRestart,
} from '@mdi/js'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog.vue'
import { useCncOffsets, offsetNames } from '@/composables/useCncOffsets'
import { setCncZero } from '@/store/files/cncApi'
import { getSocket } from '@/store/runtime'
import { getCursorTooltipPosition, previewCursorStyle } from '@/components/panels/Cnc/wcsPreview'

const toast = useToast()
const { klipperReadyForGui } = useBase()
const { showWorkCoords, requireConfirmForZeroReset, requireHomingBeforeOffsets } = useCncProfile()
const store = useStore()

const padding = 24
const svgWidth = 260
const { activeWcs, wcsOffsets, refreshWcs, setActiveWcs } = useCncOffsets()
const viewportHeight = ref(window.innerHeight)

function syncViewportHeight() {
    viewportHeight.value = window.innerHeight
}

onMounted(() => {
    window.addEventListener('resize', syncViewportHeight)
})

onBeforeUnmount(() => {
    window.removeEventListener('resize', syncViewportHeight)
})

const machineAspectY = computed(() => {
    const rangeX = machineMaxX.value - machineMinX.value
    const rangeY = machineMaxY.value - machineMinY.value
    return rangeX > 0 ? rangeY / rangeX : 1
})
const plotWidth = svgWidth - padding - 10
const svgHeight = computed(() =>
    Math.min(Math.round(padding + 16 + plotWidth * machineAspectY.value), Math.max(320, viewportHeight.value - 560))
)
const plotHeight = computed(() => svgHeight.value - padding - 16)
const gridStepOptions = [5, 10, 15, 20, 25, 30, 50, 100]
const gridStep = ref(Number(localStorage.getItem('cncPreviewGridStep')) || 10)
const snapToGrid = ref(localStorage.getItem('cncPreviewSnapToGrid') === 'true')
const hiddenOffsets = ref<Set<string>>(loadHiddenOffsets())
const offsetInputX = ref(0)
const offsetInputY = ref(0)
const offsetInputZ = ref(0)
const zeroConfirmDialogOpen = ref(false)
const zeroConfirmText = ref('')
const zeroConfirmTitle = ref('Confirm')
const zeroConfirmAction = ref<'X' | 'Y' | 'Z' | 'ALL' | null>(null)

const homeConfirmDialogOpen = ref(false)
const pendingClickCoords = ref<{ x: number; y: number } | null>(null)
watch(gridStep, (v) => localStorage.setItem('cncPreviewGridStep', String(v)))
watch(snapToGrid, (v) => localStorage.setItem('cncPreviewSnapToGrid', String(v)))
watch(
    hiddenOffsets,
    (v) => {
        localStorage.setItem('cncPreviewHiddenOffsets', JSON.stringify([...v]))
    },
    { deep: true }
)

function loadHiddenOffsets(): Set<string> {
    try {
        const raw = localStorage.getItem('cncPreviewHiddenOffsets')
        if (raw) return new Set(JSON.parse(raw))
    } catch {
        /* ignore */
    }
    return new Set()
}

function isOffsetVisible(name: string): boolean {
    return !hiddenOffsets.value.has(name)
}

function toggleOffsetVisibility(name: string) {
    const next = new Set(hiddenOffsets.value)
    if (next.has(name)) {
        next.delete(name)
    } else {
        next.add(name)
    }
    hiddenOffsets.value = next
}

interface StockSize {
    name: string
    width: number
    height: number
    depth: number
}

const stockSizes = ref<Record<string, StockSize>>({})
const stockDialogOpen = ref(false)
const stockDialogWcs = ref('')
const stockDialogName = ref('')
const stockDialogWidth = ref(0)
const stockDialogHeight = ref(0)
const stockDialogDepth = ref(0)

function loadStockSizes() {
    try {
        const raw = localStorage.getItem('cncPreviewStockSizes')
        if (raw) stockSizes.value = JSON.parse(raw)
    } catch {
        /* ignore */
    }
}

function saveStockSizes() {
    localStorage.setItem('cncPreviewStockSizes', JSON.stringify(stockSizes.value))
}

function openStockDialog(wcsName: string) {
    stockDialogWcs.value = wcsName
    const existing = stockSizes.value[wcsName]
    stockDialogName.value = existing?.name ?? wcsName
    stockDialogWidth.value = existing?.width ?? 0
    stockDialogHeight.value = existing?.height ?? 0
    stockDialogDepth.value = existing?.depth ?? 0
    stockDialogOpen.value = true
}

function saveStockDialog() {
    if (stockDialogError.value) return
    const name = stockDialogName.value.trim() || stockDialogWcs.value
    const w = stockDialogWidth.value
    const h = stockDialogHeight.value
    const d = stockDialogDepth.value
    if (w > 0 && h > 0) {
        stockSizes.value[stockDialogWcs.value] = { name, width: w, height: h, depth: d }
    } else {
        delete stockSizes.value[stockDialogWcs.value]
    }
    saveStockSizes()
    stockDialogOpen.value = false
}

const stockDialogError = computed(() => {
    const w = stockDialogWidth.value
    const h = stockDialogHeight.value
    const machineW = machineMaxX.value - machineMinX.value
    const machineH = machineMaxY.value - machineMinY.value
    if (w > machineW) return `Width (${w}mm) exceeds machine (${machineW}mm)`
    if (h > machineH) return `Height (${h}mm) exceeds machine (${machineH}mm)`
    return ''
})

const currentWorkPosition = computed(() => store.state.printer?.gcode_move?.gcode_position ?? [0, 0, 0, 0])
const currentWorkX = computed(() => currentWorkPosition.value[0] ?? 0)
const currentWorkY = computed(() => currentWorkPosition.value[1] ?? 0)
const currentWorkZ = computed(() => currentWorkPosition.value[2] ?? 0)

const offsetActionsLocked = computed(
    () =>
        requireHomingBeforeOffsets.value &&
        !(
            store.state.printer?.toolhead?.homed_axes?.includes('x') &&
            store.state.printer?.toolhead?.homed_axes?.includes('y') &&
            store.state.printer?.toolhead?.homed_axes?.includes('z')
        )
)

const activeWcsIndex = computed(() => {
    const index = offsetNames.indexOf(activeWcs.value)
    return index >= 0 ? index : 0
})
const activeWcsColor = computed(() => offsetColors[activeWcsIndex.value] ?? offsetColors[0])
const activeWcsToolbarColor = computed(() => hexToRgba(activeWcsColor.value, 0.42))
const previewStrokeColor = computed(() => hexToRgba(activeWcsColor.value, 0.9))
const wcsOriginOffsets = computed(() => wcsOffsets.value[offsetNames[activeWcsIndex.value]] ?? { X: 0, Y: 0, Z: 0 })
const wcsOriginOffsetX = computed(() => wcsOriginOffsets.value.X ?? 0)
const wcsOriginOffsetY = computed(() => wcsOriginOffsets.value.Y ?? 0)
const wcsOriginOffsetZ = computed(() => wcsOriginOffsets.value.Z ?? 0)

const offsetColors = ['#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#EF5350', '#26C6DA']

function hexToRgba(hex: string, alpha: number): string {
    const normalized = hex.replace('#', '')
    const value =
        normalized.length === 3
            ? normalized
                  .split('')
                  .map((c) => c + c)
                  .join('')
            : normalized
    const int = Number.parseInt(value, 16)
    const r = (int >> 16) & 255
    const g = (int >> 8) & 255
    const b = int & 255
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function formatOffsetValue(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

const machineMinX = computed(() => {
    const min = store.state.printer?.toolhead?.axis_minimum
    return Array.isArray(min) ? (min[0] ?? 0) : 0
})
const machineMinY = computed(() => {
    const min = store.state.printer?.toolhead?.axis_minimum
    return Array.isArray(min) ? (min[1] ?? 0) : 0
})
const machineMaxX = computed(() => {
    const max = store.state.printer?.toolhead?.axis_maximum
    return Array.isArray(max) ? (max[0] ?? 165) : 165
})
const machineMaxY = computed(() => {
    const max = store.state.printer?.toolhead?.axis_maximum
    return Array.isArray(max) ? (max[1] ?? 300) : 300
})

const toolX = computed(() => {
    const pos = store.state.printer?.toolhead?.position
    return Array.isArray(pos) ? (pos[0] ?? 0) : 0
})
const toolY = computed(() => {
    const pos = store.state.printer?.toolhead?.position
    return Array.isArray(pos) ? (pos[1] ?? 0) : 0
})
const toolVisible = computed(() => {
    const homed = store.state.printer?.toolhead?.homed_axes ?? ''
    return homed.includes('x') && homed.includes('y')
})

const displayToolX = computed(() => (animFrameId !== null ? animatedToolX.value : toolX.value))
const displayToolY = computed(() => (animFrameId !== null ? animatedToolY.value : toolY.value))

const gridLinesX = computed(() => {
    const lines: number[] = []
    const step = gridStep.value
    const start = Math.ceil(machineMinX.value / step) * step
    for (let x = start; x < machineMaxX.value; x += step) {
        lines.push(x)
    }
    return lines
})

const gridLinesY = computed(() => {
    const lines: number[] = []
    const step = gridStep.value
    const start = Math.ceil(machineMinY.value / step) * step
    for (let y = start; y < machineMaxY.value; y += step) {
        lines.push(y)
    }
    return lines
})

interface OffsetEntry {
    name: string
    color: string
    offsetX: number
    offsetY: number
    offsetZ: number
    clippedMinX: number
    clippedMinY: number
    clippedMaxX: number
    clippedMaxY: number
}

const allOffsetEntries = computed<OffsetEntry[]>(() => {
    return offsetNames.map((name, idx) => {
        const off = wcsOffsets.value[name] ?? { X: 0, Y: 0, Z: 0 }
        const ox = off.X ?? 0
        const oy = off.Y ?? 0
        const oz = off.Z ?? 0
        return {
            name,
            color: offsetColors[idx],
            offsetX: ox,
            offsetY: oy,
            offsetZ: oz,
            clippedMinX: Math.max(ox, machineMinX.value),
            clippedMinY: Math.max(oy, machineMinY.value),
            clippedMaxX: Math.min(machineMaxX.value, machineMaxX.value),
            clippedMaxY: Math.min(machineMaxY.value, machineMaxY.value),
        }
    })
})

const sortedOffsets = computed(() => {
    return [...allOffsetEntries.value].sort((a, b) => {
        if (a.name === activeWcs.value) return 1
        if (b.name === activeWcs.value) return -1
        return 0
    })
})

function toSvgX(machineX: number): number {
    const range = machineMaxX.value - machineMinX.value
    if (range === 0) return padding
    return padding + ((machineX - machineMinX.value) / range) * plotWidth
}

function toSvgY(machineY: number): number {
    const range = machineMaxY.value - machineMinY.value
    const h = plotHeight.value
    if (range === 0) return padding + h
    return padding + h - ((machineY - machineMinY.value) / range) * h
}

async function onSelectWcs(name: string) {
    if (name === activeWcs.value) return
    try {
        await setActiveWcs(name)
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to change WCS'
        toast.error(message)
    }
}

function onSetWorkZeroClick(axis: 'X' | 'Y' | 'Z' | 'ALL') {
    if (requireConfirmForZeroReset.value) {
        zeroConfirmTitle.value = 'Set Work Zero'
        zeroConfirmText.value =
            axis === 'ALL'
                ? 'Set X, Y, and Z zero for the current work coordinate system?'
                : `Set ${axis} zero for the current work coordinate system?`
        zeroConfirmAction.value = axis
        zeroConfirmDialogOpen.value = true
        return
    }
    void setWorkZero(axis)
}

async function setWorkZero(axis: 'X' | 'Y' | 'Z' | 'ALL') {
    const axes = axis === 'ALL' ? ['X', 'Y', 'Z'] : [axis]

    try {
        await setCncZero(store.getters['socket/getUrl'], { axes })
        await refreshWcs()
    } catch (error) {
        const message = error instanceof Error ? error.message : `Failed to set ${axis} zero`
        toast.error(message)
    }
}

async function runZeroConfirmAction() {
    const action = zeroConfirmAction.value
    zeroConfirmAction.value = null
    zeroConfirmDialogOpen.value = false
    if (action) {
        await setWorkZero(action)
    }
}

function resetOffsets() {
    offsetInputX.value = 0
    offsetInputY.value = 0
    offsetInputZ.value = 0
}

const svgEl = ref<SVGSVGElement | null>(null)
const cursorInfo = ref<{ x: number; y: number } | null>(null)
const tooltipLeft = ref(0)
const tooltipTop = ref(0)

function svgPointToMachine(svgX: number, svgY: number): { x: number; y: number } | null {
    const rangeX = machineMaxX.value - machineMinX.value
    const rangeY = machineMaxY.value - machineMinY.value
    if (rangeX === 0 || rangeY === 0) return null

    const h = plotHeight.value
    const machineX = ((svgX - padding) / plotWidth) * rangeX + machineMinX.value
    const machineY = ((padding + h - svgY) / h) * rangeY + machineMinY.value

    return { x: machineX, y: machineY }
}

function snapToGridValue(val: number): number {
    const step = gridStep.value
    return Math.round(val / step) * step
}

const snapInfo = ref<{ x: number; y: number } | null>(null)

function onSvgMouseMove(e: MouseEvent) {
    const svg = svgEl.value
    if (!svg) return

    const rect = svg.getBoundingClientRect()
    const scaleX = svgWidth / rect.width
    const scaleY = svgHeight.value / rect.height

    const svgX = (e.clientX - rect.left) * scaleX
    const svgY = (e.clientY - rect.top) * scaleY

    const coords = svgPointToMachine(svgX, svgY)
    if (!coords) return

    let clampedX = Math.max(machineMinX.value, Math.min(machineMaxX.value, coords.x))
    let clampedY = Math.max(machineMinY.value, Math.min(machineMaxY.value, coords.y))

    if (snapToGrid.value) {
        clampedX = snapToGridValue(clampedX)
        clampedY = snapToGridValue(clampedY)
        snapInfo.value = { x: clampedX, y: clampedY }
    } else {
        snapInfo.value = null
    }

    cursorInfo.value = { x: clampedX, y: clampedY }

    const tooltip = getCursorTooltipPosition(e.clientX, e.clientY)
    tooltipLeft.value = tooltip.left
    tooltipTop.value = tooltip.top
}

function onSvgMouseLeave() {
    cursorInfo.value = null
    snapInfo.value = null
}

function isMachineHomed(): boolean {
    const homed = store.state.printer?.toolhead?.homed_axes ?? ''
    return homed.includes('x') && homed.includes('y')
}

function onSvgClick() {
    const info = cursorInfo.value
    if (!info) return

    if (!isMachineHomed()) {
        pendingClickCoords.value = { x: info.x, y: info.y }
        homeConfirmDialogOpen.value = true
        return
    }

    executeMove(info.x, info.y)
}

const animatedToolX = ref(0)
const animatedToolY = ref(0)
let animFrameId: number | null = null

function animateToolTo(targetX: number, targetY: number, durationMs: number) {
    if (animFrameId !== null) cancelAnimationFrame(animFrameId)

    const startX = toolX.value
    const startY = toolY.value
    const startTime = performance.now()

    function step(now: number) {
        const elapsed = now - startTime
        const t = Math.min(elapsed / durationMs, 1)
        // Ease-out cubic
        const ease = 1 - Math.pow(1 - t, 3)
        animatedToolX.value = startX + (targetX - startX) * ease
        animatedToolY.value = startY + (targetY - startY) * ease

        if (t < 1) {
            animFrameId = requestAnimationFrame(step)
        } else {
            animFrameId = null
            animatedToolX.value = targetX
            animatedToolY.value = targetY
        }
    }

    animFrameId = requestAnimationFrame(step)
}

function executeMove(x: number, y: number) {
    const gcode = `G53\nG1 X${x.toFixed(4)} Y${y.toFixed(4)} F3000`
    getSocket().emit('printer.gcode.script', { script: gcode })

    // Animate the dot along the expected path
    const dx = x - toolX.value
    const dy = y - toolY.value
    const distance = Math.sqrt(dx * dx + dy * dy)
    // F3000 = 3000 mm/min = 50 mm/s
    const durationMs = Math.max(200, (distance / 50) * 1000)
    animateToolTo(x, y, durationMs)
}

function confirmHome() {
    homeConfirmDialogOpen.value = false
    const coords = pendingClickCoords.value
    pendingClickCoords.value = null
    if (!coords) return

    // Home first, then move to the clicked position
    getSocket().emit('printer.gcode.script', { script: 'G28' }, { loading: 'homeAll' })
    // Give the homing a moment to start, then queue the move
    setTimeout(() => {
        executeMove(coords.x, coords.y)
    }, 500)
}

function cancelHome() {
    homeConfirmDialogOpen.value = false
    pendingClickCoords.value = null
}

function onHomeDialogKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
        confirmHome()
    } else if (e.key === 'Escape') {
        cancelHome()
    }
}

onMounted(() => {
    loadStockSizes()
    void refreshWcs().catch((error) => {
        const message = error instanceof Error ? error.message : 'Failed to load WCS'
        toast.error(message)
    })
})
</script>

<style scoped>
.offset-preview-container {
    padding: 4px 18px 8px;
    margin: 0 auto;
}

.offset-preview-layout {
    display: grid;
    gap: 16px;
}

.offset-preview-layout__preview {
    width: 100%;
    max-width: 320px;
    cursor: none;
}

.offset-preview-layout__details {
    min-width: 0;
}

.offset-preview-controls {
    display: flex;
    flex-direction: column;
    gap: 0;
}

.offset-preview-controls :deep(.v-row) {
    flex-shrink: 0;
}

@media (min-width: 1400px) {
    .offset-preview-layout {
        grid-template-columns: minmax(0, 320px) minmax(0, 1fr);
        align-items: start;
    }

    .offset-preview-layout__preview {
        position: sticky;
        top: 12px;
    }
}

.wcs-panel {
    display: flex;
    flex-direction: column;
}

.offset-preview-svg {
    width: 100%;
    height: auto;
    display: block;
    cursor: none;
}

.offset-rect-group:hover rect {
    filter: brightness(1.3);
}

.offset-preview-legend {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    margin-top: 6px;
}

.offset-preview-legend__item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.6875rem;
    opacity: 0.7;
    transition: opacity 0.15s;
}

.offset-preview-legend__item:hover {
    opacity: 1;
}

.offset-preview-legend__swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
    flex-shrink: 0;
}

.offset-preview-legend__swatch--tool {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: rgb(var(--v-theme-primary));
    border: 1px solid rgb(var(--v-theme-on-surface));
}

.offset-preview-legend__label {
    color: rgba(var(--v-theme-on-surface), 0.85);
}

.offset-preview-legend__coords {
    color: rgba(var(--v-theme-on-surface), 0.45);
    font-size: 0.625rem;
}

.offset-preview-legend__card {
    background: rgba(var(--v-theme-on-surface), 0.04);
    border: 1px solid;
    border-radius: 4px;
    padding: 6px 8px;
    min-width: 0;
    width: 100%;
    opacity: 0.7;
    transition: opacity 0.15s;
}

.offset-preview-legend__card:hover {
    opacity: 1;
}

.offset-preview-legend__card--active {
    opacity: 1;
}

.section-label {
    display: inline-block;
    margin-bottom: 0;
    line-height: 1;
    font: inherit;
}

.offset-preview-summary-card {
    background: rgba(var(--v-theme-on-surface), 0.03);
    border-color: rgba(var(--v-theme-on-surface), 0.08);
    margin-bottom: 20px;
    margin-top: 10px;
}

.offset-preview-summary-card__text {
    padding: 10px;
}

.offset-preview-controls {
    padding-bottom: 6px;
}

.offset-preview-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    align-items: start;
}

.offset-preview-summary-grid__section {
    min-width: 0;
    text-align: left;
}

.offset-preview-summary-grid__section .section-label {
    margin-bottom: 2px;
}

.offset-preview-summary-grid__section .compact-axis-row {
    margin-top: 0;
}

.compact-axis-list {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 4px 10px;
    margin-top: 0;
    align-items: flex-start;
}

.compact-axis-list--muted {
    opacity: 0.9;
}

.compact-axis-row {
    display: flex;
    justify-content: flex-start;
    gap: 4px;
    align-items: baseline;
    flex-wrap: nowrap;
    margin-top: -2px;
}

.compact-axis {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
    font-size: 0.6875rem;
    line-height: 1;
    white-space: nowrap;
}

.compact-axis--stacked {
    width: auto;
    justify-content: flex-start;
}

@media (max-width: 640px) {
    .compact-axis-list {
        flex-direction: column;
        gap: 4px;
    }

    .compact-axis--stacked {
        width: 100%;
    }
}

.offset-preview-controls__row {
    margin-left: 0;
    margin-right: 0;
}

.offset-preview-controls__row--tight {
    margin-bottom: 2px;
}

.offset-preview-controls__row--actions {
    margin-top: 2px;
    margin-bottom: 2px;
}

.offset-preview-controls__row :deep(.v-col) {
    padding-top: 2px;
    padding-bottom: 2px;
}

.compact-axis span {
    font-weight: 600;
}

.compact-axis strong {
    font-weight: 600;
}

.offset-preview-legend__card-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 6px;
}

.offset-preview-legend__card-eye {
    margin-left: auto;
    transition: opacity 0.15s;
}

.offset-preview-legend__card:hover .offset-preview-legend__card-eye {
    opacity: 1;
}

.offset-preview-legend__card-title {
    color: rgba(var(--v-theme-on-surface), 0.9);
    font-weight: 600;
    font-size: 0.6875rem;
    flex: 1 1 auto;
    min-width: 0;
}

.offset-preview-legend__card-origin {
    color: rgba(var(--v-theme-on-surface), 0.4);
    font-size: 0.625rem;
    display: flex;
    flex: 1 1 100%;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0 4px;
    min-width: 0;
    line-height: 1.2;
}

@media (min-width: 560px) {
    .offset-preview-legend__card-origin {
        flex-basis: auto;
        margin-left: auto;
    }
}

.offset-preview-legend__card-axis {
    font-weight: 700;
}

.offset-preview-legend__card-number {
    color: rgba(var(--v-theme-on-surface), 0.92);
}

.offset-preview-legend__card-stock {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.offset-preview-legend__card-stock-content {
    min-width: 0;
}

.offset-preview-legend__card-stock-name {
    color: rgba(var(--v-theme-on-surface), 0.6);
    font-size: 0.625rem;
    margin-bottom: 2px;
}

.offset-preview-legend__card-stock-dims {
    display: flex;
    align-items: center;
    gap: 2px;
    color: rgba(var(--v-theme-on-surface), 0.45);
    font-size: 0.625rem;
    flex-wrap: wrap;
}

.offset-preview-legend__card-sep {
    opacity: 0.4;
}

.offset-preview-legend__card-edit {
    flex: 0 0 auto;
    margin-left: 4px;
    margin-top: -2px;
    color: rgba(var(--v-theme-on-surface), 0.75);
    opacity: 1;
    pointer-events: auto;
}

.offset-preview-legend__card-edit:hover {
    color: rgb(var(--v-theme-primary));
}

.offset-preview-tooltip {
    position: fixed;
    background: #000;
    color: #fff;
    font-size: 0.625rem;
    padding: 2px 6px;
    border-radius: 3px;
    pointer-events: none;
    white-space: nowrap;
    z-index: 10000;
}

.tool-dot-pulse {
    animation: tool-pulse 2s ease-in-out infinite;
}

@keyframes tool-pulse {
    0%,
    100% {
        opacity: 0.35;
    }
    50% {
        opacity: 0.1;
    }
}
</style>
