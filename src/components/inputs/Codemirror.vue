<template>
    <div class="vue-codemirror">
        <div ref="editor" v-observe-visibility="visibilityChanged"></div>
    </div>
</template>

<script setup lang="ts">
// Inspired by this repo: https://github.com/surmon-china/vue-codemirror

import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'

import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import { useTheme } from '@/composables/useTheme'
import { basicSetup } from 'codemirror'
import { EditorView, keymap, WidgetType, Decoration, DecorationSet } from '@codemirror/view'
import { EditorState, StateEffect, StateField } from '@codemirror/state'
import { vscodeDark, vscodeLight } from '@uiw/codemirror-theme-vscode'
import { StreamLanguage } from '@codemirror/language'
import { klipper_config } from '@/plugins/StreamParserKlipperConfig'
import { gcode } from '@/plugins/StreamParserGcode'
import { insertTab, indentLess } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { css } from '@codemirror/lang-css'
import { indentUnit } from '@codemirror/language'

const props = defineProps<{
    code?: string
    value?: string
    modelValue?: string
    name?: string
    fileExtension?: string
    validationErrors?: { line: number; severity: 'error' | 'warning' }[]
}>()

const emit = defineEmits<{
    (e: 'ready', cm: EditorView): void
    (e: 'lineChange', line: number): void
    (e: 'input', content: string): void
    (e: 'update:modelValue', content: string): void
}>()

const store = useStore()
useBase()
const { themeMode } = useTheme()

const editor = ref<HTMLElement | null>(null)

let content = ''
let codemirror: null | EditorView = null
let cminstance: null | EditorView = null

watch(
    () => props.modelValue ?? props.value,
    (newVal) => {
        const cm_value = cminstance?.state?.doc.toString()
        if (newVal !== cm_value) {
            setCmValue(newVal ?? '')
        }
    }
)

onMounted(() => {
    initialize()
})

onBeforeUnmount(() => {
    destroy()
})

function destroy() {
    cminstance?.destroy()
}

function initialize() {
    codemirror = new EditorView({
        parent: editor.value!,
    })
    cminstance = codemirror

    nextTick(() => {
        setCmValue(props.modelValue ?? props.code ?? props.value ?? content ?? '')
        syncAnnotations(props.validationErrors)

        emit('ready', codemirror)
    })
}

function setCmValue(content: string) {
    cminstance?.setState(EditorState.create({ doc: content, extensions: cmExtensions.value }))
}

const cmExtensions = computed(() => {
    const extensions = [
        annotationField,

        EditorView.theme({}, { dark: themeMode.value === 'dark' }),
        basicSetup,
        vscodeTheme.value,
        indentUnit.of(' '.repeat(tabSize.value)),
        keymap.of([
            { key: 'Tab', run: insertTab },
            { key: 'Shift-Tab', run: indentLess },
        ]),
        EditorView.updateListener.of((update) => {
            if (update.selectionSet) {
                const line = cminstance?.state?.doc.lineAt(cminstance?.state?.selection.main.head).number ?? 0
                emit('lineChange', line)
            }
            content = update.state?.doc.toString()
            if (content) {
                emit('input', content)
                emit('update:modelValue', content)
            }
        }),
    ]

    const ext = props.fileExtension ?? ''
    if (['cfg', 'conf'].includes(ext)) {
        extensions.push(StreamLanguage.define(klipper_config))
    } else if (['gcode'].includes(ext)) extensions.push(StreamLanguage.define(gcode))
    else if (['json'].includes(ext)) extensions.push(json())
    else if (['css', 'scss', 'sass'].includes(ext)) extensions.push(css())

    return extensions
})

function visibilityChanged(isVisible: boolean) {
    if (isVisible) cminstance?.focus()
}

const tabSize = computed(() => store.state.gui.editor?.tabSize || 2)

const vscodeTheme = computed(() => (themeMode.value === 'dark' ? vscodeDark : vscodeLight))

class AnnotationWidget extends WidgetType {
    severity: 'error' | 'warning'
    constructor(severity: 'error' | 'warning') {
        super()
        this.severity = severity
    }
    toDOM() {
        const span = document.createElement('span')
        span.className = 'cm-annotation-widget cm-annotation-widget-' + this.severity
        span.textContent = '\u26A0'
        span.title = this.severity === 'error' ? 'Error' : 'Warning'
        return span
    }
}

const annotationEffect = StateEffect.define<{ line: number; severity: 'error' | 'warning' }[]>()

const annotationField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none
    },
    update(value, tr) {
        for (const e of tr.effects) {
            if (e.is(annotationEffect)) {
                const sorted = [...e.value].sort((a, b) => a.line - b.line)
                const decorations: Decoration[] = []
                for (const ann of sorted) {
                    if (ann.line < 1 || ann.line > tr.state.doc.lines) continue
                    const line = tr.state.doc.line(ann.line)
                    const isError = ann.severity === 'error'
                    // Widget icon at the start of the line
                    decorations.push(
                        Decoration.widget({
                            widget: new AnnotationWidget(ann.severity),
                            side: -1,
                        }).range(line.from)
                    )
                    // Wavy underline across the line (must be sorted by from to avoid Decoration.set errors)
                    decorations.push(
                        Decoration.mark({
                            class: isError ? 'cm-annotation-error' : 'cm-annotation-warning',
                        }).range(line.from, line.to)
                    )
                }
                return Decoration.set(decorations, true)
            }
        }
        return value.map(tr.changes)
    },
    provide: (field) => EditorView.decorations.from(field),
})

function setAnnotations(errors: { line: number; severity: 'error' | 'warning' }[]) {
    if (!cminstance) return
    cminstance.dispatch({
        effects: annotationEffect.of(errors),
    })
}

function clearAnnotations() {
    if (!cminstance) return
    cminstance.dispatch({
        effects: annotationEffect.of([]),
    })
}

function syncAnnotations(errors?: { line: number; severity: 'error' | 'warning' }[]) {
    if (errors && errors.length > 0) {
        setAnnotations(errors)
    } else {
        clearAnnotations()
    }
}

watch(
    () => props.validationErrors,
    (errors) => {
        syncAnnotations(errors)
    },
    { deep: true, immediate: true }
)

defineExpose({ gotoLine, setAnnotations, clearAnnotations })

function gotoLine(line: number) {
    const view = cminstance
    const l = view?.state?.doc.line(line)
    if (!view || !l) return

    view.dispatch({
        selection: { head: l.from, anchor: l.to },
    })

    requestAnimationFrame(() => {
        const coords = view.coordsAtPos(l.from)
        const scroller = view.scrollDOM
        if (!coords || !scroller) return

        const scrollerRect = scroller.getBoundingClientRect()
        const targetTop = scroller.scrollTop + (coords.top - scrollerRect.top) - scroller.clientHeight / 2

        scroller.scrollTo({
            top: Math.max(0, targetTop),
            behavior: 'smooth',
        })
    })
}
</script>

<style>
.vue-codemirror {
    display: flex;
    flex: 1 1 auto;
    height: 100%;
    min-height: 0;
    overflow: hidden;
}

.vue-codemirror > div {
    flex: 1 1 auto;
    min-height: 0;
}

.cm-annotation-error {
    background: rgba(255, 0, 0, 0.1) !important;
    text-decoration: wavy underline #f44336 2px !important;
    text-underline-offset: 2px;
}

.cm-annotation-warning {
    background: rgba(255, 152, 0, 0.08) !important;
    text-decoration: wavy underline #ff9800 2px !important;
    text-underline-offset: 2px;
}

.cm-annotation-widget {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    font-size: 0.8125rem;
    cursor: default;
    user-select: none;
}

.cm-annotation-widget-error {
    color: #f44336;
}

.cm-annotation-widget-warning {
    color: #ff9800;
}
</style>
