<template>
    <div>
        <panel :title="panelTitle" :icon="mdiVideo3d" card-class="gcode-viewer-panel" :margin-bottom="false">
            <template #buttons>
                <v-btn
                    v-show="reloadRequired"
                    :icon="display.xs"
                    variant="text"
                    rounded="0"
                    color="info"
                    class="ml-3"
                    @click="reloadViewer">
                    <span class="d-none d-sm-block">{{ $t('GCodeViewer.ReloadRequired') }}</span>
                    <v-icon class="d-sm-none">{{ mdiReloadAlert }}</v-icon>
                </v-btn>
                <v-btn :icon="mdiCameraRetake" rounded="0" @click="resetCamera" />
            </template>
            <v-card-text>
                <v-row :class="showScrubber ? 'withScrubber' : ''">
                    <v-col :cols="showGCode ? 8 : 12">
                        <div ref="viewerCanvasContainer"></div>
                    </v-col>
                    <v-col v-show="showGCode" cols="4">
                        <div class="viewer">
                            <CodeStream
                                ref="gcodestream"
                                v-model:currentline="scrubPosition"
                                :shown="showGCode"
                                :document="fileData"
                                :is-simulating="!printerIsPrinting" />
                        </div>
                    </v-col>
                </v-row>
                <v-row v-show="showScrubber" class="scrubber">
                    <v-col class="pt-0">
                        <v-slider
                            v-model="scrubPosition"
                            :hint="scrubPosition + '/' + scrubFileSize"
                            :max="scrubFileSize"
                            density="compact"
                            min="0"
                            persistent-hint />
                    </v-col>
                    <v-col class="v-col-auto pt-0 text-center">
                        <v-btn class="px-2 minwidth-0" color="primary" @click="scrubPlaying = !scrubPlaying">
                            <v-icon v-if="scrubPlaying">{{ mdiPause }}</v-icon>
                            <v-icon v-else>{{ mdiPlay }}</v-icon>
                        </v-btn>
                        <v-btn class="px-2 minwidth-0 mx-3" color="primary" @click="fastForward">
                            <v-icon>{{ mdiFastForward }}</v-icon>
                        </v-btn>
                        <v-btn-toggle v-model="scrubSpeed" class="mt-3 mt-sm-0" density="compact" mandatory rounded>
                            <v-btn :value="1">1x</v-btn>
                            <v-btn :value="2">2x</v-btn>
                            <v-btn :value="5">5x</v-btn>
                            <v-btn :value="10">10x</v-btn>
                            <v-btn :value="20">20x</v-btn>
                        </v-btn-toggle>
                    </v-col>
                </v-row>
                <v-row class="mt-0 d-flex align-top">
                    <v-col>
                        <v-row>
                            <v-col
                                order-md="2"
                                class="d-flex align-content-space-around justify-center flex-wrap flex-md-nowrap v-col-12 v-col-md-4">
                                <template v-if="loadedFile === null">
                                    <v-btn
                                        v-if="sdCardFilePath !== '' && sdCardFilePath !== loadedFile"
                                        class="mr-3"
                                        @click="loadCurrentFile">
                                        {{ $t('GCodeViewer.LoadCurrentFile') }}
                                    </v-btn>
                                    <v-btn color="primary" @click="chooseFile">upload gcode</v-btn>
                                </template>
                                <template v-else>
                                    <v-btn v-if="showTrackingButton" class="mr-3" @click="tracking = !tracking">
                                        <v-icon
                                            class="mr-2"
                                            v-html="tracking ? mdiToggleSwitch : mdiToggleSwitchOffOutline" />
                                        {{ $t('GCodeViewer.Tracking') }}
                                    </v-btn>
                                    <v-btn @click="clearLoadedFile">
                                        <v-icon start>{{ mdiBroom }}</v-icon>
                                        {{ $t('GCodeViewer.ClearLoadedFile') }}
                                    </v-btn>
                                </template>
                            </v-col>
                            <v-col class="v-col-12 v-col-sm-6 v-col-md-4">
                                <v-text-field
                                    :model-value="gcodeWcsSummary"
                                    label="G-Code WCS"
                                    density="compact"
                                    hide-details
                                    readonly
                                    variant="outlined"></v-text-field>
                            </v-col>
                            <v-col class="v-col-12 v-col-sm-6 v-col-md-4">
                                <v-select
                                    v-model="colorMode"
                                    :items="colorModes"
                                    :label="$t('GCodeViewer.ColorMode')"
                                    item-title="text"
                                    density="compact"
                                    hide-details
                                    variant="outlined"></v-select>
                            </v-col>
                            <v-col order-md="3" class="v-col-12 v-col-sm-6 v-col-md-4 d-flex">
                                <v-select
                                    v-model="renderQuality"
                                    :items="renderQualities"
                                    :label="$t('GCodeViewer.RenderQuality')"
                                    item-title="label"
                                    density="compact"
                                    hide-details
                                    variant="outlined"></v-select>
                                <v-menu
                                    :offset-y="true"
                                    :offset-x="true"
                                    top
                                    :close-on-content-click="false"
                                    :title="$t('Files.SetupCurrentList')">
                                    <template #activator="{ props: menuProps }">
                                        <v-btn class="minwidth-0 px-2 ml-3" v-bind="menuProps">
                                            <v-icon>{{ mdiCog }}</v-icon>
                                        </v-btn>
                                    </template>
                                    <v-list>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="showCursor"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.ShowToolhead')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="showTravelMoves"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.ShowTravelMoves')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="showGCode"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.ShowGCode')" />
                                        </v-list-item>

                                        <v-list-item
                                            v-if="loadedFile === sdCardFilePath && printing_objects.length"
                                            class="minHeight36">
                                            <v-checkbox
                                                v-model="showObjectSelection"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.ShowObjectSelection')" />
                                        </v-list-item>
                                        <v-divider></v-divider>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="hdRendering"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.HDRendering')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="forceLineRendering"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.ForceLineRendering')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="transparency"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.Transparency')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="voxelMode"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.VoxelMode')" />
                                        </v-list-item>
                                        <v-list-item class="minHeight36">
                                            <v-checkbox
                                                v-model="specularLighting"
                                                class="mt-0"
                                                hide-details
                                                :label="$t('GCodeViewer.SpecularLighting')" />
                                        </v-list-item>
                                    </v-list>
                                </v-menu>
                            </v-col>
                        </v-row>
                    </v-col>
                </v-row>
                <input
                    ref="fileInput"
                    :accept="'.g,.gcode,.gc,.gco,.nc,.ngc,.tap'"
                    hidden
                    multiple
                    type="file"
                    @change="fileSelected" />
            </v-card-text>
        </panel>
        <v-snackbar v-model="loading" :timeout="-1" location="bottom right">
            <div>
                {{ $t('GCodeViewer.Rendering') }} - {{ loadingPercent }}%
                <br />
                <strong>{{ loadedFile }}</strong>
            </div>
            <v-progress-linear class="mt-2" :model-value="loadingPercent"></v-progress-linear>
            <template #actions="{ props: snackbarProps }">
                <v-btn
                    :icon="mdiClose"
                    color="red"
                    variant="text"
                    v-bind="snackbarProps"
                    style="min-width: auto"
                    @click="cancelRendering()" />
            </template>
        </v-snackbar>
        <v-snackbar v-model="downloadSnackbar.status" :timeout="-1" location="bottom right">
            <template v-if="downloadSnackbar.total > 0">
                <div>
                    {{ $t('GCodeViewer.Downloading') }} - {{ Math.round(downloadSnackbar.percent) }} % @
                    {{ formatFilesize(Math.round(downloadSnackbar.speed)) }}/s
                    <br />
                    <strong>{{ downloadSnackbar.filename }}</strong>
                </div>
                <v-progress-linear class="mt-2" :model-value="downloadSnackbar.percent" />
            </template>
            <template v-else>
                <div>
                    {{ $t('GCodeViewer.Downloading') }}
                    <br />
                    <strong>{{ downloadSnackbar.filename }}</strong>
                </div>
                <v-progress-linear class="mt-2" indeterminate />
            </template>
            <template #actions="{ props: downloadProps }">
                <v-btn
                    :icon="mdiClose"
                    color="red"
                    variant="text"
                    v-bind="downloadProps"
                    style="min-width: auto"
                    @click="cancelDownload" />
            </template>
        </v-snackbar>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useStore } from 'vuex'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useDisplay, useTheme } from 'vuetify'
import { useBase } from '@/composables/useBase'
import GCodeViewer from '@sindarius/gcodeviewer'
import axios, { CancelTokenSource } from 'axios'
import type { AxiosProgressEvent } from 'axios'
import { escapePath, formatFilesize } from '@/plugins/helpers'
import Panel from '@/components/ui/Panel.vue'
import CodeStream from '@/components/gcodeviewer/CodeStream.vue'
import debounce from 'lodash.debounce'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import type { GCodeViewerInstance } from '@/store/gcodeviewer/types'
import {
    mdiCameraRetake,
    mdiCog,
    mdiClose,
    mdiReloadAlert,
    mdiToggleSwitch,
    mdiToggleSwitchOffOutline,
    mdiVideo3d,
    mdiPlay,
    mdiPause,
    mdiFastForward,
    mdiBroom,
} from '@mdi/js'

interface DownloadSnackbar {
    status: boolean
    filename: string
    percent: number
    speed: number
    total: number
    cancelTokenSource: CancelTokenSource | null
}

interface PrintableObject {
    name: string
    polygon: [number, number][]
}

interface ViewerObjectMetadata {
    cancelled?: boolean
    name?: string
}

interface StockBoxBounds {
    xMin: number
    xMax: number
    yMin: number
    yMax: number
    zMin: number
    zMax: number
}

interface CamWcsOriginAxis {
    fromMin: number
    fromMax: number
}

interface CamWcsOrigin {
    X: CamWcsOriginAxis
    Y: CamWcsOriginAxis
    Z: CamWcsOriginAxis
}

const store = useStore()
const route = useRoute()
const { t } = useI18n()
const display = useDisplay()
const theme = useTheme()
const { apiUrl, printerIsPrinting, klipperReadyForGui, socketIsConnected } = useBase()

defineProps<{
    filename?: string
}>()

const viewerCanvasContainer = ref<HTMLElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

let viewer: GCodeViewerInstance | null = null
let stockBoxMesh: any | null = null

const isBusy = ref(false)
const loading = ref(false)
const loadingPercent = ref(0)

const tracking = ref(false)
const loadedFile = ref<string | null>(null)

const reloadRequired = ref(false)
const fileSize = ref(0)
const renderQualities = computed(() => [
    { label: t('GCodeViewer.Low'), value: 2 },
    { label: t('GCodeViewer.Medium'), value: 3 },
    { label: t('GCodeViewer.High'), value: 4 },
    { label: t('GCodeViewer.Ultra'), value: 5 },
    { label: t('GCodeViewer.Max'), value: 6 },
])
const renderQuality = ref(renderQualities.value[2])

const scrubPosition = ref(0)
const scrubPlaying = ref(false)
const scrubSpeed = ref(1)
const scrubInterval = ref<ReturnType<typeof setInterval> | undefined>(undefined)
const scrubFileSize = ref(0)

const downloadSnackbar = ref<DownloadSnackbar>({
    status: false,
    filename: '',
    percent: 0,
    speed: 0,
    total: 0,
    cancelTokenSource: null,
})

const fileData = ref('')
const appliedPreviewOffset = ref({ X: 0, Y: 0, Z: 0 })
const appliedPreviewAxesOffset = ref({ X: 0, Y: 0, Z: 0 })
const appliedPreviewToolOffset = ref({ X: 0, Y: 0, Z: 0 })
const stockBoxBounds = ref<StockBoxBounds | null>(null)
const camWcsOrigin = ref<CamWcsOrigin | null>(null)
const initialCameraAdjusted = ref(false)
const primaryViewerColor = computed(() => normalizeThemeColor(theme.current.value.colors.primary ?? '#4caf50'))

const resizeObserver = ref<ResizeObserver | null>(null)

onMounted(async () => {
    loadedFile.value = store.state.gcodeviewer?.loadedFileBackup ?? null
    viewer = store.state.gcodeviewer?.viewerBackup ?? null
    await waitForMachineStateReady()
    await init()

    if (loadedFile.value !== null && viewer) scrubFileSize.value = viewer.fileSize
    if (viewer) fileData.value = viewer.fileData

    resizeObserver.value = new ResizeObserver(() => handleResize())
    resizeObserver.value.observe(viewerCanvasContainer.value!)
})

onBeforeUnmount(() => {
    if (viewer) {
        viewer.gcodeProcessor.loadingProgressCallback = null
        store.dispatch('gcodeviewer/setLoadedFileBackup', loadedFile.value)
        store.dispatch('gcodeviewer/setViewerBackup', viewer)
    }

    scrubPlaying.value = false
    if (scrubInterval.value) {
        clearInterval(scrubInterval.value)
        scrubInterval.value = undefined
    }

    resizeObserver.value?.disconnect()
})

const handleResize = debounce(() => {
    nextTick(() => {
        viewer?.resize()
    })
}, 200)

const panelTitle = computed(() => {
    let title = t('GCodeViewer.Title').toString()

    if (loadedFile.value) title += `: ${loadedFile.value}`

    return title
})

const filePosition = computed(() => (printerIsPrinting.value ? store.state.printer.virtual_sdcard.file_position : 0))

const sdCardFilePath = computed(() => store.state.printer.print_stats?.filename ?? '')

const livePosition = computed(() => store.state.printer.motion_report?.live_position ?? [0, 0, 0, 0])

const gcodeOffset = computed(() => store.state.printer?.gcode_move?.homing_origin ?? [0, 0, 0])

const currentPosition = computed(() => [
    livePosition.value[0] - gcodeOffset.value[0],
    livePosition.value[1] - gcodeOffset.value[1],
    livePosition.value[2] - gcodeOffset.value[2],
    livePosition.value[3],
])

const showTrackingButton = computed(() => printerIsPrinting.value && sdCardFilePath.value === loadedFile.value)

const printing_objects = computed<PrintableObject[]>(() => store.state.printer?.exclude_object?.objects ?? [])

watch(printing_objects, () => {
    refreshPrintingObjects()
})

const excluded_objects = computed(() => store.state.printer.exclude_object?.excluded_objects ?? [])

watch(excluded_objects, () => {
    refreshPrintingObjects()
})

const nozzle_diameter = computed(() => store.state.printer.configfile?.settings?.extruder?.nozzle_diameter ?? 0.4)

async function init() {
    let canvasElement = store.state.gcodeviewer?.canvasBackup ?? null

    if (canvasElement === null) {
        canvasElement = document.createElement('canvas')
        canvasElement.className = 'viewer'
        viewerCanvasContainer.value!.appendChild(canvasElement)
        await store.dispatch('gcodeviewer/setCanvasBackup', canvasElement)
    } else {
        viewerCanvasContainer.value!.appendChild(canvasElement)
        if (viewer?.gcodeProcessor) {
            viewer.gcodeProcessor.updateFilePosition(viewer?.fileSize)
        }
    }

    if (viewer === null) await viewerInit(canvasElement)

    registerProgressCallback()

    if (route.query?.filename && loadedFile.value !== route.query?.filename?.toString()) {
        await sleep(1000)
        await loadFile(route.query.filename.toString())
    }
}

async function viewerInit(element: HTMLCanvasElement) {
    viewer = new GCodeViewer(element)
    await viewer.init()
    viewer.setBackgroundColor(backgroundColor.value)
    viewer.bed.setBedColor(gridColor.value)
    viewer.setCursorVisiblity(showCursor.value)
    viewer.setZClipPlane(1000000, -1000000)
    viewer.axes.show(showAxes.value)
    viewer.bed.setDelta(kinematics.value.includes('delta'))

    if (bedMaxSize.value !== null) {
        viewer.bed.buildVolume.x.max = bedMaxSize.value[0]
        viewer.bed.buildVolume.y.max = bedMaxSize.value[1]
        viewer.bed.buildVolume.z.max = bedMaxSize.value[2]
    }

    if (bedMinSize.value !== null) {
        viewer.bed.buildVolume.x.min = bedMinSize.value[0]
        viewer.bed.buildVolume.y.min = bedMinSize.value[1]
        viewer.bed.buildVolume.z.min = bedMinSize.value[2]
    }

    viewer.gcodeProcessor.useHighQualityExtrusion(hdRendering.value)
    viewer.gcodeProcessor.updateForceWireMode(true)
    viewer.gcodeProcessor.setAlpha(transparency.value)
    viewer.gcodeProcessor.setVoxelMode(voxelMode.value)
    viewer.gcodeProcessor.voxelWidth = voxelWidth.value
    viewer.gcodeProcessor.voxelHeight = voxelHeight.value
    viewer.gcodeProcessor.useSpecularColor(specularLighting.value)
    viewer.gcodeProcessor.setLiveTracking(false)
    viewer.gcodeProcessor.g1AsExtrusion = true
    viewer.gcodeProcessor.setColorMode(0)
    viewer.setProgressColor(primaryViewerColor.value)
    viewer.buildObjects.objectCallback = objectCallback

    applyPrimaryToolColor()

    if (viewer.lastLoadFailed()) {
        renderQuality.value = renderQualities.value[0]
        viewer.updateRenderQuality(1)
        viewer.clearLoadFlag()
    }
}

function registerProgressCallback() {
    if (viewer === null) return

    viewer.gcodeProcessor.loadingProgressCallback = (progress: number) => {
        loadingPercent.value = Math.ceil(progress * 100)
        loading.value = loadingPercent.value <= 99
    }
}

async function cancelRendering() {
    if (viewer === null) return

    viewer.gcodeProcessor.cancelLoad = true
    await sleep(1000)
}

function clearLoadedFile() {
    if (viewer === null) return

    scrubPlaying.value = false
    scrubFileSize.value = 0
    disposeStockBox()
    stockBoxBounds.value = null
    camWcsOrigin.value = null
    viewer.clearScene(true)
    loadedFile.value = null
    tracking.value = false
    appliedPreviewOffset.value = { X: 0, Y: 0, Z: 0 }
    appliedPreviewAxesOffset.value = { X: 0, Y: 0, Z: 0 }
    appliedPreviewToolOffset.value = { X: 0, Y: 0, Z: 0 }
}

function chooseFile() {
    if (isBusy.value) return

    fileInput.value?.click()
}

function finishLoad() {
    loading.value = false
    if (viewer === null) return

    viewer.setCursorVisiblity(showCursor.value)
    replaceToolCursorWithCylinder()

    refreshPrintingObjects()
    scrubFileSize.value = viewer.fileSize
    stockBoxBounds.value = parseStockBoxBounds(fileData.value)
    camWcsOrigin.value = parseCamWcsOrigin(fileData.value)
    renderStockBox()
    applyPreviewOffset(true)
    zoomOutInitialCamera()

    viewer.gcodeProcessor.updateFilePosition(viewer.fileSize)
}

function refreshPrintingObjects() {
    if (loadedFile.value !== sdCardFilePath.value || printing_objects.value.length === 0) return

    const objects: {
        cancelled: boolean
        name: string
        x: number[]
        y: number[]
    }[] = []
    printing_objects.value.forEach((object) => {
        const xValues = object.polygon.map((point) => point[0])
        const yValues = object.polygon.map((point) => point[1])

        objects.push({
            cancelled: excluded_objects.value.includes(object.name),
            name: object.name,
            x: [Math.min(...xValues), Math.max(...xValues)],
            y: [Math.min(...yValues), Math.max(...yValues)],
        })
    })

    viewer?.buildObjects.loadObjectBoundaries(objects)
    viewer?.buildObjects.showObjectSelection(showObjectSelection.value)
}

async function fileSelected(e: Event) {
    const input = e.target as HTMLInputElement | null
    if (input === null || viewer === null) return

    const reader = new FileReader()
    reader.addEventListener('load', async (event: ProgressEvent<FileReader>) => {
        const blob = event.target?.result
        if (typeof blob === 'string') {
            fileSize.value = blob.length
            await viewer?.processFile(blob)
            fileData.value = viewer?.fileData ?? ''
        }
        finishLoad()
    })
    tracking.value = false

    const selectedFile = input.files?.[0]
    if (selectedFile) {
        loadedFile.value = selectedFile.name
        reader.readAsText(selectedFile)
    }
    input.value = ''
}

async function loadFile(filename: string) {
    downloadSnackbar.value.status = true
    downloadSnackbar.value.speed = 0
    downloadSnackbar.value.filename = filename.startsWith('gcodes/') ? filename.slice(7) : filename
    const CancelToken = axios.CancelToken
    const cancelTokenSource = CancelToken.source()
    downloadSnackbar.value.cancelTokenSource = cancelTokenSource

    const text = await axios
        .get(apiUrl.value + '/server/files/' + escapePath(filename), {
            cancelToken: cancelTokenSource.token,
            responseType: 'blob',
            onDownloadProgress: (progressEvent: AxiosProgressEvent) => {
                downloadSnackbar.value.percent = (progressEvent.progress ?? 0) * 100
                downloadSnackbar.value.speed = progressEvent.rate ?? 0
                downloadSnackbar.value.total = progressEvent.total ?? 0
            },
        })
        .then((res) => res.data.text())
        .catch((e) => {
            window.console.error(e.message)
        })
    downloadSnackbar.value.status = false
    loadedFile.value = downloadSnackbar.value.filename

    if (viewer === null) return

    viewer.updateRenderQuality(renderQuality.value.value)
    await viewer.processFile(text)
    fileData.value = viewer.fileData
    loadingPercent.value = 100
    finishLoad()
    scrubFileSize.value = viewer.fileSize
}

function cancelDownload() {
    downloadSnackbar.value.cancelTokenSource?.cancel('User canceled download gcode file')
}

async function sleep(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadCurrentFile() {
    await loadFile('gcodes/' + sdCardFilePath.value)
    loadedFile.value = sdCardFilePath.value
}

async function reloadViewer() {
    if (loadedFile.value === null || viewer === null) return

    if (loading.value) {
        viewer.gcodeProcessor.cancelLoad = true
        await sleep(1000)
    }

    reloadRequired.value = false
    loading.value = true
    loadingPercent.value = 0
    await viewer.reload()
    fileData.value = viewer.fileData
    loadingPercent.value = 100
    finishLoad()
}

function resetCamera() {
    viewer?.resetCamera()
}

function zoomOutInitialCamera() {
    if (!viewer || initialCameraAdjusted.value) return

    const activeCamera = (viewer as any)?.scene?.activeCamera
    if (!activeCamera || typeof activeCamera.radius !== 'number') return

    activeCamera.radius *= 1.2
    viewer.forceRender()
    initialCameraAdjusted.value = true
}

const gcodeWcsSummary = computed(() => {
    if (camWcsOrigin.value) {
        const { X, Y, Z } = camWcsOrigin.value
        return `X min ${formatSignedCoordinate(X.fromMin)} · Y min ${formatSignedCoordinate(Y.fromMin)} · Z min ${formatSignedCoordinate(Z.fromMin)}`
    }

    if (stockBoxBounds.value) {
        return `X0 Y0 Z0 from file · stock Z0 offset ${formatSignedCoordinate(-stockBoxBounds.value.zMin)}`
    }

    return 'Load a G-code file'
})

function normalizeThemeColor(color: string): string {
    if (color.startsWith('#')) return color
    if (/^[0-9a-f]{6}$/i.test(color)) return `#${color}`
    return '#4caf50'
}

function toColor3(color: string): Color3 {
    return Color3.FromHexString(normalizeThemeColor(color))
}

function disposeStockBox() {
    stockBoxMesh?.dispose(false, true)
    stockBoxMesh = null
}

function formatSignedCoordinate(value: number) {
    return `${value >= 0 ? '+' : ''}${value}`
}

function parseCamWcsOrigin(text: string): CamWcsOrigin | null {
    if (!text) return null

    const lines = text.split(/\r?\n/)
    const origin: Partial<CamWcsOrigin> = {}
    let inBlock = false

    for (const line of lines) {
        if (/^\s*;\s*CAM WCS Origin\s*:/i.test(line)) {
            inBlock = true
            continue
        }

        if (!inBlock) continue

        const match = line.match(
            /^\s*;\s*([XYZ])\s*:\s*stock\s+min\s*([+-]?\d+(?:\.\d+)?)\s*=\s*stock\s+max\s*([+-]?\d+(?:\.\d+)?)/i
        )
        if (match) {
            const [, axis, fromMinText, fromMaxText] = match
            origin[axis.toUpperCase() as keyof CamWcsOrigin] = {
                fromMin: Number(fromMinText),
                fromMax: Number(fromMaxText),
            } as CamWcsOriginAxis
            continue
        }

        if (/^\s*;\s*[A-Z][A-Z\s]*:/i.test(line) || /^\s*[^;]/.test(line)) {
            break
        }
    }

    if (!origin.X || !origin.Y || !origin.Z) return null
    return origin as CamWcsOrigin
}

function parseStockBoxBounds(text: string): StockBoxBounds | null {
    if (!text) return null

    const lines = text.split(/\r?\n/)
    const bounds: Partial<StockBoxBounds> = {}
    let inStockBox = false

    for (const line of lines) {
        if (/^\s*;\s*Stock Box\s*:/i.test(line)) {
            inStockBox = true
            continue
        }

        if (!inStockBox) continue

        const match = line.match(/^\s*;\s*([XYZ])\s*:\s*Min\s*=\s*(-?\d+(?:\.\d+)?)\s+Max\s*=\s*(-?\d+(?:\.\d+)?)/i)
        if (match) {
            const [, axis, minText, maxText] = match
            const min = Number(minText)
            const max = Number(maxText)
            if (axis.toUpperCase() === 'X') {
                bounds.xMin = min
                bounds.xMax = max
            } else if (axis.toUpperCase() === 'Y') {
                bounds.yMin = min
                bounds.yMax = max
            } else if (axis.toUpperCase() === 'Z') {
                bounds.zMin = min
                bounds.zMax = max
            }
            continue
        }

        if (/^\s*;\s*[A-Z]\s*:/i.test(line) || /^\s*;\s*Ranges Table\s*:/i.test(line) || /^\s*[^;]/.test(line)) {
            break
        }
    }

    if (
        bounds.xMin === undefined ||
        bounds.xMax === undefined ||
        bounds.yMin === undefined ||
        bounds.yMax === undefined ||
        bounds.zMin === undefined ||
        bounds.zMax === undefined
    ) {
        return null
    }

    return bounds as StockBoxBounds
}

function renderStockBox() {
    disposeStockBox()
    if (!viewer?.scene || !stockBoxBounds.value) return

    const { xMin, xMax, yMin, yMax, zMin, zMax } = stockBoxBounds.value
    const point = (x: number, y: number, z: number) => new Vector3(x, z, y)

    const lines = [
        [point(xMin, yMin, zMin), point(xMax, yMin, zMin)],
        [point(xMax, yMin, zMin), point(xMax, yMax, zMin)],
        [point(xMax, yMax, zMin), point(xMin, yMax, zMin)],
        [point(xMin, yMax, zMin), point(xMin, yMin, zMin)],
        [point(xMin, yMin, zMax), point(xMax, yMin, zMax)],
        [point(xMax, yMin, zMax), point(xMax, yMax, zMax)],
        [point(xMax, yMax, zMax), point(xMin, yMax, zMax)],
        [point(xMin, yMax, zMax), point(xMin, yMin, zMax)],
        [point(xMin, yMin, zMin), point(xMin, yMin, zMax)],
        [point(xMax, yMin, zMin), point(xMax, yMin, zMax)],
        [point(xMax, yMax, zMin), point(xMax, yMax, zMax)],
        [point(xMin, yMax, zMin), point(xMin, yMax, zMax)],
    ]

    stockBoxMesh = CreateLineSystem('StockBox', { lines }, viewer.scene)
    stockBoxMesh.color = toColor3(primaryViewerColor.value)
    stockBoxMesh.renderingGroupId = 2
    stockBoxMesh.isPickable = false
    viewer.forceRender()
}

function applyPreviewOffset(force = false) {
    if (viewer === null || loadedFile.value === null) return

    const zLift = camWcsOrigin.value?.Z.fromMin ?? (stockBoxBounds.value ? -stockBoxBounds.value.zMin : 0)
    const nextOffset = { X: 0, Y: 0, Z: zLift }
    const axesOffset = { X: 0, Y: 0, Z: zLift }
    const toolOffset = { X: 0, Y: 0, Z: zLift }
    const deltaX = nextOffset.X - appliedPreviewOffset.value.X
    const deltaY = nextOffset.Y - appliedPreviewOffset.value.Y
    const deltaZ = nextOffset.Z - appliedPreviewOffset.value.Z

    const axesDeltaX = axesOffset.X - appliedPreviewAxesOffset.value.X
    const axesDeltaY = axesOffset.Y - appliedPreviewAxesOffset.value.Y
    const axesDeltaZ = axesOffset.Z - appliedPreviewAxesOffset.value.Z
    const toolDeltaX = toolOffset.X - appliedPreviewToolOffset.value.X
    const toolDeltaY = toolOffset.Y - appliedPreviewToolOffset.value.Y
    const toolDeltaZ = toolOffset.Z - appliedPreviewToolOffset.value.Z

    if (
        !force &&
        deltaX === 0 &&
        deltaY === 0 &&
        axesDeltaX === 0 &&
        axesDeltaY === 0 &&
        axesDeltaZ === 0 &&
        toolDeltaX === 0 &&
        toolDeltaY === 0 &&
        toolDeltaZ === 0
    )
        return

    viewer.scene?.meshes?.forEach((mesh: any) => {
        if (
            mesh?.renderingGroupId !== 2 ||
            mesh?.name === 'JRNozzle' ||
            mesh?.name === 'SimpleToolCursorCylinder'
        )
            return
        if (!mesh?.position) return

        mesh.position.x += deltaX
        mesh.position.y += deltaZ
        mesh.position.z += deltaY
    })

    const axesMesh = (viewer as any)?.axes?.axesMesh
    if (axesMesh?.position) {
        axesMesh.position.x += axesDeltaX
        axesMesh.position.y += axesDeltaZ
        axesMesh.position.z += axesDeltaY
    }

    if (!tracking.value) {
        const toolCursor = (viewer as any)?.toolCursor
        if (toolCursor?.position) {
            toolCursor.position.x += toolDeltaX
            toolCursor.position.y += toolDeltaZ
            toolCursor.position.z += toolDeltaY
        }
        syncToolCursorCylinder(false)
    }

    appliedPreviewOffset.value = nextOffset
    appliedPreviewAxesOffset.value = axesOffset
    appliedPreviewToolOffset.value = toolOffset
    viewer.forceRender()
}

function getPreviewAdjustedPosition(position: number[]) {
    const zLift = camWcsOrigin.value?.Z.fromMin ?? (stockBoxBounds.value ? -stockBoxBounds.value.zMin : 0)

    return [position[0], position[1], position[2] + zLift, position[3] ?? 0]
}

function applyPrimaryToolColor() {
    if (!viewer) return

    viewer.gcodeProcessor.resetTools()
    viewer.gcodeProcessor.addTool(primaryViewerColor.value, nozzle_diameter.value)
    viewer.gcodeProcessor.setColorMode(0)
}

function syncToolCursorCylinder(forceRender = true) {
    if (!viewer) return

    const viewerAny = viewer as any
    const toolCursor = viewerAny?.toolCursor
    const cylinder = viewerAny?.toolCursorMesh

    if (!toolCursor?.getAbsolutePosition || cylinder?.name !== 'SimpleToolCursorCylinder') return

    const position = toolCursor.getAbsolutePosition()
    cylinder.setAbsolutePosition(new Vector3(position.x, position.y + 2, position.z))

    if (forceRender) viewer.forceRender()
}

function replaceToolCursorWithCylinder(attempt = 0) {
    if (!viewer?.scene) return

    const viewerAny = viewer as any
    const toolCursor = viewerAny?.toolCursor
    const existingMesh = viewerAny?.toolCursorMesh
    const childMeshes = typeof toolCursor?.getChildMeshes === 'function' ? toolCursor.getChildMeshes() : []

    if ((!toolCursor || (!existingMesh && childMeshes.length === 0)) && attempt < 10) {
        window.setTimeout(() => replaceToolCursorWithCylinder(attempt + 1), 100)
        return
    }

    if (!toolCursor) return
    if (existingMesh?.name === 'SimpleToolCursorCylinder') {
        syncToolCursorCylinder()
        return
    }

    const wasVisible = existingMesh?.isVisible ?? showCursor.value
    childMeshes.forEach((mesh: any) => mesh?.dispose?.(false, true))

    const cylinder = CreateCylinder(
        'SimpleToolCursorCylinder',
        { height: 4, diameter: 1.5, tessellation: 24 },
        viewer.scene
    )
    const material = new StandardMaterial('SimpleToolCursorCylinderMaterial', viewer.scene)
    material.diffuseColor = toColor3(primaryViewerColor.value)
    material.specularColor = new Color3(0, 0, 0)
    cylinder.material = material
    cylinder.renderingGroupId = 2
    cylinder.isPickable = false
    cylinder.isVisible = wasVisible

    viewerAny.toolCursorMesh = cylinder
    syncToolCursorCylinder()
}

function reapplyPreviewOffsetToToolCursor() {
    if (!viewer) return

    const toolCursor = (viewer as any)?.toolCursor
    if (!toolCursor?.position) return

    const Z = camWcsOrigin.value?.Z.fromMin ?? (stockBoxBounds.value ? -stockBoxBounds.value.zMin : 0)
    if (Z === 0) {
        syncToolCursorCylinder()
        return
    }

    toolCursor.position.y += Z
    syncToolCursorCylinder()
}

function setReloadRequiredFlag() {
    if (loadedFile.value && loadedFile.value != '') {
        reloadRequired.value = true
    }
}

watch(renderQuality, async (newVal: { value: number }) => {
    if (viewer && viewer.renderQuality !== newVal.value) {
        viewer.updateRenderQuality(newVal.value)
        await reloadViewer()
    }
})

watch([stockBoxBounds, camWcsOrigin], () => {
    applyPreviewOffset()
})

watch(currentPosition, (newVal: number[]) => {
    if (!viewer || !tracking.value || scrubPlaying.value) return

    const adjustedPosition = getPreviewAdjustedPosition(newVal)
    const position = [
        { axes: 'X', position: adjustedPosition[0] },
        { axes: 'Y', position: adjustedPosition[1] },
        { axes: 'Z', position: adjustedPosition[2] },
    ]

    viewer.updateToolPosition(position)
    syncToolCursorCylinder(false)
})

watch(filePosition, (newVal: number) => {
    if (!viewer || !tracking.value || scrubPlaying.value) return

    const offset = 350
    if (newVal > 0 && printerIsPrinting.value && tracking.value && newVal > offset) {
        viewer.gcodeProcessor.updateFilePosition(newVal - offset)
        scrubPosition.value = newVal - offset
        return
    }

    viewer.gcodeProcessor.updateFilePosition(viewer.fileSize)
})

watch(tracking, async (newVal: boolean) => {
    if (viewer === null) return

    if (newVal) {
        scrubPlaying.value = false
        viewer.gcodeProcessor.updateFilePosition(0)
        viewer?.forceRender()
        return
    }

    viewer.gcodeProcessor.setLiveTracking(false)
    await reloadViewer()
})

watch(printerIsPrinting, () => {
    tracking.value = false
})

const showCursor = computed({
    get: () => store.state.gui.gcodeViewer.showCursor ?? false,
    set: (newVal: boolean) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.showCursor', value: newVal })
    },
})

watch(showCursor, (newVal: boolean) => {
    viewer?.setCursorVisiblity(newVal)
    if (newVal) replaceToolCursorWithCylinder()
})

const showTravelMoves = computed({
    get: () => store.state.gui.gcodeViewer.showTravelMoves ?? false,
    set: (newVal: boolean) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.showTravelMoves', value: newVal })
    },
})

const showGCode = computed({
    get: () => store.state.gui.gcodeViewer.showGCode ?? false,
    set: (newVal: boolean) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.showGCode', value: newVal })
        if (newVal && viewer) {
            fileData.value = viewer.fileData
        }
        handleResize()
    },
})

watch(showTravelMoves, (newVal: boolean) => {
    viewer?.toggleTravels(newVal)
})

const showObjectSelection = computed({
    get: () => store.state.gui.gcodeViewer.showObjectSelection ?? false,
    set: (newVal: boolean) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.showObjectSelection', value: newVal })
    },
})

watch(showObjectSelection, (newVal: boolean) => {
    viewer?.buildObjects.showObjectSelection(newVal)
})

const hdRendering = computed({
    get: () => store.state.gui.gcodeViewer.hdRendering,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.hdRendering', value: newVal })
    },
})

watch(hdRendering, async (newVal: boolean) => {
    if (viewer === null) return

    viewer.gcodeProcessor.useHighQualityExtrusion(newVal)
    await reloadViewer()
})

const forceLineRendering = computed({
    get: () => store.state.gui.gcodeViewer.forceLineRendering,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.forceLineRendering', value: newVal })
    },
})

watch(forceLineRendering, async () => {
    if (viewer === null) return

    viewer.gcodeProcessor.updateForceWireMode(true)
    await reloadViewer()
})

const transparency = computed({
    get: () => store.state.gui.gcodeViewer.transparency,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.transparency', value: newVal })
    },
})

watch(transparency, async (newVal: boolean) => {
    if (viewer === null) return

    viewer.gcodeProcessor.setAlpha(newVal)
    await reloadViewer()
})

const voxelMode = computed({
    get: () => store.state.gui.gcodeViewer.voxelMode,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.voxelMode', value: newVal })
    },
})

watch(voxelMode, async (newVal: boolean) => {
    if (viewer === null) return

    viewer.gcodeProcessor.setVoxelMode(newVal)
    viewer.gcodeProcessor.voxelWidth = voxelWidth.value
    viewer.gcodeProcessor.voxelHeight = voxelHeight.value
    await reloadViewer()
})

const voxelWidth = computed({
    get: () => store.state.gui.gcodeViewer.voxelWidth ?? 1,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.voxelWidth', value: newVal })
    },
})

const voxelHeight = computed({
    get: () => store.state.gui.gcodeViewer.voxelHeight ?? 1,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.voxelHeight', value: newVal })
    },
})

const specularLighting = computed({
    get: () => store.state.gui.gcodeViewer.specularLighting,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'gcodeViewer.specularLighting', value: newVal })
    },
})

watch(specularLighting, async (newVal: boolean) => {
    if (viewer === null) return

    viewer.gcodeProcessor.useSpecularColor(newVal)
})

const colorModes = [{ text: 'Primary', value: 0 }]

const colorMode = computed({
    get: () => 0,
    set: () => {
        if (!viewer) return
        viewer.gcodeProcessor.setColorMode(0)
    },
})

const backgroundColor = computed(() => store.state.gui.gcodeViewer?.backgroundColor ?? '#121212')

watch(backgroundColor, (newVal: string) => {
    if (viewer === null) return

    viewer.setBackgroundColor(newVal)
})

const gridColor = computed(() => store.state.gui.gcodeViewer?.gridColor ?? '#B3B3B3')

watch(gridColor, (newVal: string) => {
    if (viewer === null) return
    viewer.bed.setBedColor(newVal)
})

const showAxes = computed(() => store.state.gui.gcodeViewer?.showAxes ?? true)

watch(showAxes, (newVal: boolean) => {
    if (viewer === null) return

    viewer.axes.show(newVal)
})

const minFeed = computed(() => store.state.gui.gcodeViewer?.minFeed ?? 20)

watch(minFeed, (newVal: number) => {
    if (viewer === null) return

    viewer.gcodeProcessor.updateColorRate(newVal * 60, maxFeed.value * 60)
})

const maxFeed = computed(() => store.state.gui.gcodeViewer?.maxFeed ?? 100)

watch(maxFeed, (newVal: number) => {
    if (viewer === null) return

    viewer.gcodeProcessor.updateColorRate(minFeed.value * 60, newVal * 60)
})

const minFeedColor = computed(() => store.state.gui.gcodeViewer?.minFeedColor ?? '#0000FF')

watch(minFeedColor, (newVal: string) => {
    if (viewer === null) return

    viewer.gcodeProcessor.updateMinFeedColor(newVal)
    setReloadRequiredFlag()
})

const maxFeedColor = computed(() => store.state.gui.gcodeViewer?.maxFeedColor ?? '#FF0000')

watch(maxFeedColor, (newVal: string) => {
    if (viewer === null) return

    viewer.gcodeProcessor.updateMaxFeedColor(newVal)
    setReloadRequiredFlag()
})

const kinematics = computed(
    () =>
        store.state.printer.configfile?.settings?.printer?.kinematics ??
        store.state.gui?.gcodeViewer?.klipperCache?.kinematics ??
        ''
)

const bedMaxSize = computed(
    () => store.state.printer.toolhead?.axis_maximum ?? store.state.gui?.gcodeViewer?.klipperCache?.axis_maximum ?? null
)

const bedMinSize = computed(
    () => store.state.printer.toolhead?.axis_minimum ?? store.state.gui?.gcodeViewer?.klipperCache?.axis_minimum ?? null
)

const machineStateReady = computed(() => {
    const min = store.state.printer.toolhead?.axis_minimum
    const max = store.state.printer.toolhead?.axis_maximum
    return (
        klipperReadyForGui.value &&
        Array.isArray(min) &&
        min.length >= 3 &&
        Array.isArray(max) &&
        max.length >= 3
    )
})

async function waitForMachineStateReady() {
    if (!socketIsConnected.value || machineStateReady.value) return

    await new Promise<void>((resolve) => {
        const stop = watch(
            machineStateReady,
            (ready) => {
                if (!ready) return
                stop()
                resolve()
            },
            { immediate: true }
        )

        window.setTimeout(() => {
            stop()
            resolve()
        }, 5000)
    })
}

watch(
    kinematics,
    (newVal: string) => {
        if (viewer === null || !newVal) return

        viewer.bed.setDelta(newVal.includes('delta'))
    },
    { immediate: true }
)

watch(
    bedMinSize,
    (newVal: number[] | null) => {
        if (newVal === null || viewer === null || viewer.bed === null) return

        viewer.bed.buildVolume.x.min = newVal[0]
        viewer.bed.buildVolume.y.min = newVal[1]
        viewer.bed.buildVolume.z.min = newVal[2]
    },
    { deep: true, immediate: true }
)

watch(
    bedMaxSize,
    (newVal: number[] | null) => {
        if (newVal === null || viewer === null || viewer.bed === null) return

        viewer.bed.buildVolume.x.max = newVal[0]
        viewer.bed.buildVolume.y.max = newVal[1]
        viewer.bed.buildVolume.z.max = newVal[2]
    },
    { deep: true, immediate: true }
)

watch(primaryViewerColor, async (newVal: string) => {
    if (!viewer) return

    viewer.setProgressColor(newVal)
    if (stockBoxMesh) stockBoxMesh.color = toColor3(newVal)

    const toolCursorMesh = (viewer as any)?.toolCursorMesh
    const toolCursorMaterial = toolCursorMesh?.material as StandardMaterial | undefined
    if (toolCursorMesh?.name === 'SimpleToolCursorCylinder' && toolCursorMaterial) {
        toolCursorMaterial.diffuseColor = toColor3(newVal)
    }

    applyPrimaryToolColor()

    if (loadedFile.value) {
        await reloadViewer()
    } else {
        viewer.forceRender()
    }
})

watch(scrubPlaying, (to: boolean): void => {
    if (!to) {
        if (scrubInterval.value) clearInterval(scrubInterval.value)
        scrubPlaying.value = false
        scrubInterval.value = undefined
        return
    }

    if (viewer === null) {
        scrubPlaying.value = false
        return
    }

    if (scrubInterval.value) {
        clearInterval(scrubInterval.value)
        scrubInterval.value = undefined
    }

    scrubPlaying.value = true
    if (scrubPosition.value >= scrubFileSize.value) {
        scrubPosition.value = 0
    }

    viewer?.gcodeProcessor.updateFilePosition(scrubPosition.value - 30000)
    scrubInterval.value = setInterval(() => {
        scrubPosition.value += 100 * scrubSpeed.value
        viewer?.gcodeProcessor.updateFilePosition(scrubPosition.value)
        viewer?.simulateToolPosition()
        reapplyPreviewOffsetToToolCursor()
        if (tracking.value || scrubPosition.value >= scrubFileSize.value) {
            scrubPlaying.value = false
        }
    }, 200)
})

const showScrubber = computed(() => !tracking.value && scrubFileSize.value > 0)

const updateScrubPosition = debounce((to: number): void => {
    if (viewer === null || tracking.value) return

    viewer.gcodeProcessor.updateFilePosition(to)
    viewer.simulateToolPosition()
    reapplyPreviewOffsetToToolCursor()
}, 200)

watch(scrubPosition, (to: number) => {
    updateScrubPosition(to)
})

function fastForward(): void {
    if (viewer === null) return

    scrubPosition.value = scrubFileSize.value
    viewer.gcodeProcessor.updateFilePosition(scrubPosition.value)
}

function objectCallback(metadata: ViewerObjectMetadata | null) {
    if (metadata?.cancelled === false) {
        excludeObject.value.name = metadata.name ?? 'UNKNOWN'
        excludeObject.value.bool = true
    }
}
</script>

<!-- Because the viewer lives outside of the components DOM it can't be scoped -->
<style>
.viewer {
    width: 100%;
    height: calc(var(--app-height) - 240px);
    border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
}

.withScrubber .viewer {
    height: calc(var(--app-height) - 300px);
}

@media (min-width: 600px) and (max-width: 959px) {
    .viewer {
        height: calc(var(--app-height) - 295px);
    }

    .withScrubber .viewer {
        height: calc(var(--app-height) - 360px);
    }
}

@media (max-width: 599px) {
    .viewer {
        height: calc(var(--app-height) - 340px);
    }

    .withScrubber .viewer {
        height: calc(var(--app-height) - 340px);
    }
}
</style>

<style scoped>
.scrubber {
    position: relative;
    left: 0;
    right: 0;
    bottom: 5px;
}
</style>
