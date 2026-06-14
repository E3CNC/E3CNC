import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { useGcodeFiles } from '@/composables/useGcodeFiles'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

describe('useGcodeFiles', () => {
    let store: any

    beforeEach(() => {
        store = createStore({
            state: {
                gui: {
                    view: {
                        gcodefiles: {
                            search: 'benchy',
                            currentPath: 'gcodes',
                            showHiddenFiles: true,
                            showCompletedFiles: false,
                            hideMetadataColumns: ['slicer'],
                            orderMetadataColumns: ['size', 'modified', 'estimated_time', 'last_start_time', 'last_end_time', 'last_print_duration', 'last_total_duration', 'slicer'],
                            selectedFiles: ['benchy.gcode'],
                        },
                    },
                },
            },
            getters: {
                'files/getGcodeFiles': () => () => [
                    { filename: 'benchy.gcode' },
                    { filename: 'other.gcode' },
                ],
            },
            actions: {
                'gui/saveSetting': vi.fn(),
            },
        })
    })

    function mountComposable() {
        let result: any
        const TestComponent = defineComponent({
            setup() {
                result = useGcodeFiles()
                return () => h('div')
            },
        })

        mount(TestComponent, {
            global: { plugins: [store] },
        })

        return result
    }

    it('exposes current filters and headers', () => {
        const files = mountComposable()
        expect(files.search.value).toBe('benchy')
        expect(files.currentPath.value).toBe('')
        expect(files.showHiddenFiles.value).toBe(true)
        expect(files.showCompletedFiles.value).toBe(false)
        expect(files.files.value).toHaveLength(2)
        expect(files.headers.value.length).toBeGreaterThan(0)
        expect(files.filteredHeaders.value.length).toBeLessThan(files.headers.value.length)
        expect(files.existsFilename('benchy.gcode')).toBe(true)
    })

    it('dispatches settings updates', () => {
        const files = mountComposable()
        files.setSearch('cube')
        files.setCurrentPath('config')
        files.setShowHiddenFiles(false)
        files.setShowCompletedFiles(true)
        files.setHideMetadataColumns(['modified'])
        files.setOrderMetadataColumns(['filename'])
        files.setSelectedFiles(['cube.gcode'])
        files.setConfigurableHeaders(files.configurableHeaders.value)

        expect(store._actions['gui/saveSetting']).toBeTruthy()
    })
})
