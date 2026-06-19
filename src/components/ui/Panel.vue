<template>
    <div :style="wrapperStyle" class="panel-wrapper">
        <v-card
            :ref="
                (el: any) => {
                    if (el) setPanelRef(el)
                }
            "
            :class="
                'panel ' +
                cardClass +
                ' ' +
                (marginBottom && !floating ? 'mb-3 mb-md-6' : '') +
                ' ' +
                (!expand ? 'expanded' : '') +
                (floating ? ' floating' : '')
            "
            :loading="loading"
            :style="floating ? floatingCardStyle : cardStyle">
            <v-toolbar
                flat
                :color="toolbarColor"
                :class="getToolbarClass"
                :height="panelToolbarHeight"
                class="panel-toolbar"
                :style="additionalStyle"
                @pointerdown="onPointerDown">
                <slot name="buttons-left" />
                <v-toolbar-title class="d-flex align-center">
                    <slot v-if="hasIconSlot" name="icon" />
                    <v-icon v-if="icon !== null && !hasIconSlot" start>{{ icon }}</v-icon>
                    <span v-if="title" class="subheading">{{ title }}</span>
                </v-toolbar-title>
                <slot name="buttons-title" />
                <v-spacer />
                <v-toolbar-items v-show="hasButtonsSlot || collapsible || floating">
                    <div v-if="expand || !hideButtonsOnCollapse || floating" class="d-flex align-center">
                        <slot name="buttons" />
                    </div>
                    <v-btn
                        v-if="collapsible && !floating"
                        icon
                        class="btn-collapsible"
                        :ripple="true"
                        @click="expand = !expand">
                        <v-icon :class="expand ? '' : 'icon-rotate-90'">{{ mdiChevronDown }}</v-icon>
                    </v-btn>
                    <v-btn v-if="floating" icon :ripple="true" @click="dockPanel">
                        <v-icon>{{ mdiClose }}</v-icon>
                    </v-btn>
                </v-toolbar-items>
            </v-toolbar>
            <v-expand-transition>
                <div v-show="expand || !collapsible || floating" class="panel-content">
                    <slot />
                </div>
            </v-expand-transition>
            <div v-if="floating" class="resize-handle" @pointerdown="onResizeStart" />
        </v-card>
    </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, useSlots, watch } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import { panelToolbarHeight } from '@/store/variables'
import { mdiChevronDown, mdiClose } from '@mdi/js'
import type { PanelFloatingState } from '@/store/gui/types'

const props = defineProps({
    icon: { type: String, default: null },
    title: { type: [String, Object], required: false, default: '' },
    collapsible: { type: Boolean, default: false },
    cardClass: { type: String, required: true },
    toolbarColor: { type: String, default: '' },
    toolbarClass: { type: String, default: '' },
    loading: { type: Boolean, default: false },
    marginBottom: { type: Boolean, default: true },
    hideButtonsOnCollapse: { type: Boolean, default: false },
    height: { type: [Number, String], default: null },
    floatable: { type: Boolean, default: false },
})

const store = useStore()
const { viewport } = useBase()
const slots = useSlots()

let panelEl: HTMLElement | null = null

function setPanelRef(el: unknown) {
    panelEl = el?.$el ?? el ?? null
}

const floatingData = computed<PanelFloatingState | null>(
    () => store.state.gui.dashboard.floatingPanels[props.cardClass] ?? null
)

const floating = computed(() => floatingData.value !== null)

const expand = computed({
    get: () => store.getters['gui/getPanelExpand'](props.cardClass, viewport.value),
    set: (newVal) =>
        store.dispatch('gui/saveExpandPanel', { name: props.cardClass, value: newVal, viewport: viewport.value }),
})

const hasIconSlot = computed(() => !!slots.icon)
const hasButtonsSlot = computed(() => !!slots.buttons)

const isDragging = ref(false)
const isResizing = ref(false)
const isAnimating = ref(false)

const spacerHeight = ref(0)
const enableTransition = ref(false)

const floatState = reactive({
    x: 0,
    y: 0,
    width: 400,
    height: 300,
    zIndex: 10,
})

watch(
    floatingData,
    (val) => {
        if (val && !isDragging.value && !isResizing.value && !isAnimating.value) {
            floatState.x = val.x
            floatState.y = val.y
            floatState.width = val.width
            floatState.height = val.height
            floatState.zIndex = val.zIndex
        }
    },
    { immediate: true, deep: true }
)

const getToolbarClass = computed(() => {
    let output = props.toolbarClass
    if (props.collapsible) output += ' collapsible'
    if (props.floatable) output += ' is-floatable'
    return output
})

const additionalStyle = computed(() => {
    return ''
})

const cardStyle = computed(() => {
    if (!props.height) return undefined

    const height = typeof props.height === 'number' ? `${props.height}px` : props.height
    return {
        height,
        maxHeight: height,
        display: 'flex',
        flexDirection: 'column',
    }
})

const floatingCardStyle = computed(() => ({
    position: 'fixed' as const,
    left: floatState.x + 'px',
    top: floatState.y + 'px',
    width: floatState.width + 'px',
    height: floatState.height + 'px',
    zIndex: floatState.zIndex,
    display: 'flex',
    flexDirection: 'column',
    transition: isAnimating.value ? 'left 300ms ease-in-out, top 300ms ease-in-out' : 'none',
}))

const wrapperStyle = computed(() => {
    if (!floating.value && spacerHeight.value === 0) return undefined
    return {
        height: spacerHeight.value + 'px',
        position: 'relative' as const,
        transition: enableTransition.value ? 'height 200ms ease-in-out' : undefined,
    }
})

// --- Drag ---
const dragThreshold = 5
let dragStarted = false

interface DragState {
    startX: number
    startY: number
    floatX: number
    floatY: number
}

const dragState: DragState = { startX: 0, startY: 0, floatX: 0, floatY: 0 }

function onPointerDown(e: PointerEvent) {
    if (!props.floatable || isAnimating.value) return

    const target = e.target as HTMLElement
    if (target.closest('.v-btn, button, a, input, select, textarea, .resize-handle')) return

    e.preventDefault()
    dragStarted = false

    dragState.startX = e.clientX
    dragState.startY = e.clientY

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
    if (!dragStarted) {
        const dx = e.clientX - dragState.startX
        const dy = e.clientY - dragState.startY
        if (Math.abs(dx) < dragThreshold && Math.abs(dy) < dragThreshold) return

        dragStarted = true
        isDragging.value = true

        if (floating.value) {
            dragState.floatX = floatState.x
            dragState.floatY = floatState.y
            bringToFront()
        } else {
            const rect = panelEl?.getBoundingClientRect()
            if (!rect) {
                isDragging.value = false
                return
            }
            const z = nextZIndex()
            floatState.x = rect.left
            floatState.y = rect.top
            floatState.width = rect.width
            floatState.height = rect.height
            floatState.zIndex = z
            dragState.floatX = rect.left
            dragState.floatY = rect.top
            saveToStore({ x: rect.left, y: rect.top, width: rect.width, height: rect.height, zIndex: z })

            enableTransition.value = false
            spacerHeight.value = rect.height
            requestAnimationFrame(() => {
                enableTransition.value = true
                spacerHeight.value = 0
            })
        }
    }

    if (floating.value || dragStarted) {
        floatState.x = dragState.floatX + (e.clientX - dragState.startX)
        floatState.y = dragState.floatY + (e.clientY - dragState.startY)
    }
}

function onPointerUp() {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)

    if (!dragStarted) return

    isDragging.value = false
    saveToStore({
        x: floatState.x,
        y: floatState.y,
        width: floatState.width,
        height: floatState.height,
        zIndex: floatState.zIndex,
    })
}

// --- Resize ---
interface ResizeState {
    startX: number
    startY: number
    width: number
    height: number
}

const resizeState: ResizeState = { startX: 0, startY: 0, width: 0, height: 0 }

function onResizeStart(e: PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    isResizing.value = true

    resizeState.startX = e.clientX
    resizeState.startY = e.clientY
    resizeState.width = floatState.width
    resizeState.height = floatState.height

    window.addEventListener('pointermove', onResizeMove)
    window.addEventListener('pointerup', onResizeEnd)
}

function onResizeMove(e: PointerEvent) {
    floatState.width = Math.max(200, resizeState.width + (e.clientX - resizeState.startX))
    floatState.height = Math.max(100, resizeState.height + (e.clientY - resizeState.startY))
}

function onResizeEnd() {
    window.removeEventListener('pointermove', onResizeMove)
    window.removeEventListener('pointerup', onResizeEnd)
    isResizing.value = false
    saveToStore({
        x: floatState.x,
        y: floatState.y,
        width: floatState.width,
        height: floatState.height,
        zIndex: floatState.zIndex,
    })
}

// --- Store helpers ---
function nextZIndex(): number {
    const panels = store.state.gui.dashboard.floatingPanels
    return Math.max(0, ...Object.values(panels).map((p: PanelFloatingState) => p.zIndex)) + 1
}

function bringToFront() {
    floatState.zIndex = nextZIndex()
    store.dispatch('gui/bringFloatingPanelToFront', props.cardClass)
}

function saveToStore(pos: PanelFloatingState) {
    store.dispatch('gui/saveFloatingPanelPosition', { id: props.cardClass, position: pos })
}

function dockPanel() {
    if (!floating.value || isAnimating.value) return

    const wrapper = panelEl?.closest('.panel-wrapper')
    if (!wrapper) {
        store.dispatch('gui/saveFloatingPanelPosition', { id: props.cardClass, remove: true })
        return
    }

    // Expand spacer to panel height (creates space in layout)
    enableTransition.value = true
    spacerHeight.value = floatState.height

    // After spacer expands, slide panel to target position
    setTimeout(() => {
        const targetRect = wrapper.getBoundingClientRect()
        isAnimating.value = true
        floatState.x = targetRect.left
        floatState.y = targetRect.top

        // After slide completes, collapse spacer then remove floating state
        setTimeout(() => {
            isAnimating.value = false
            spacerHeight.value = 0
            setTimeout(() => {
                store.dispatch('gui/saveFloatingPanelPosition', { id: props.cardClass, remove: true })
            }, 200)
        }, 300)
    }, 200)
}
</script>

<style scoped>
.panel-wrapper {
    display: block;
}

.expanded header.v-toolbar {
    border-bottom-left-radius: 12px;
    border-bottom-right-radius: 12px;
}

.btn-collapsible > * {
    will-change: transform;
    transition: transform 500ms;
}
.icon-rotate-90 {
    transform: rotate(90deg);
}

.panel-toolbar {
    overflow-y: hidden;
}

.panel-toolbar.is-floatable {
    cursor: grab;
}

.panel-toolbar.is-floatable:active {
    cursor: grabbing;
}

.panel-content {
    display: block;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
    width: 100%;
}

.panel-content > * {
    min-width: 0;
    width: 100%;
}

.panel-content > .v-card-text {
    align-self: stretch;
    max-width: none;
    width: 100%;
}

:deep(.panel-toolbar) .v-btn {
    height: 100%;
    max-height: none;
}

.panel-toolbar {
    gap: 4px;
}

.panel-toolbar .v-toolbar-title {
    gap: 8px;
}

.panel-toolbar .v-toolbar-title .v-icon + span {
    margin-inline-start: 2px;
}

:deep(.panel-toolbar) .v-toolbar-items {
    gap: 4px;
}

:deep(.panel-toolbar) .v-toolbar-items > .d-flex.align-center {
    padding-inline-end: 8px;
}

:deep(.panel-toolbar) .v-toolbar__content {
    padding-left: 8px;
    padding-right: 4px;
}

:deep(.panel-toolbar) .v-toolbar__content > .v-btn + .v-btn {
    margin-inline-start: 4px;
}

.resize-handle {
    position: absolute;
    bottom: 0;
    right: 0;
    width: 16px;
    height: 16px;
    cursor: nwse-resize;
    opacity: 0;
    transition: opacity 0.15s;
    z-index: 1;
}

.resize-handle::after {
    content: '';
    position: absolute;
    bottom: 2px;
    right: 2px;
    width: 10px;
    height: 10px;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    opacity: 0.4;
}

.floating:hover .resize-handle {
    opacity: 1;
}
</style>

<style>
.v-card.panel {
    border-radius: var(--border-radius);
    transition: all 150ms ease-in-out;
}
.v-card.panel .v-toolbar__content {
    padding-right: 0;
}
.v-card.panel .v-toolbar__content > .v-toolbar-title {
    flex: 1 1 auto;
    min-width: 0;
}
.v-card.panel .v-toolbar__content .subheading {
    user-select: none;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.panel-toolbar .v-btn.v-btn--icon {
    width: var(--panel-toolbar-icon-btn-width);
}
.v-card.panel.floating {
    outline: 2px solid rgb(var(--v-theme-primary));
    box-shadow:
        17px 20px 24px 20px rgba(0, 0, 0, 0.43),
        0 2px 8px rgba(0, 0, 0, 0.25);
}
.v-card.panel.floating .panel-content {
    overflow: auto;
}
</style>
