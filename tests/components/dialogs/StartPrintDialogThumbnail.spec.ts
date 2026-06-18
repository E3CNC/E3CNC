import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ apiUrl: ref('//localhost:8080') }),
}))

vi.mock('vuetify/components', () => ({
    VImg: { name: 'VImg', props: ['src', 'maxWidth'], template: '<img class="v-img" :src="src" />' },
}))

const store = createStore({
    state: { gui: { uiSettings: { bigThumbnailBackground: '#000' } }, instancesDB: 'moonraker' },
})

import StartPrintDialogThumbnail from '@/components/dialogs/StartPrintDialogThumbnail.vue'

describe('StartPrintDialogThumbnail.vue', () => {
    it('renders without crashing', () => {
        const wrapper = mount(StartPrintDialogThumbnail, {
            props: {
                file: {
                    filename: 'test.gcode',
                    modified: new Date(1000),
                    thumbnails: [{ width: 256, height: 256, size: 1000, relative_path: '' }],
                } as any,
                currentPath: '',
            },
            global: { plugins: [store] },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('does not render when file has no thumbnails', () => {
        const wrapper = mount(StartPrintDialogThumbnail, {
            props: {
                file: { filename: 'test.gcode', modified: new Date(1000), thumbnails: [] } as any,
                currentPath: '',
            },
            global: { plugins: [store] },
        })
        expect(wrapper.find('.v-img').exists()).toBe(false)
    })
})
