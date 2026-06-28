import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import WebcamListEntry from '@/components/settings/Webcams/WebcamListEntry.vue'
import type { GuiWebcamStateWebcam } from '@/store/gui/webcams/types'

// ── Mocks ──
vi.mock('vuetify/components', () => ({
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VBtn: {
        name: 'VBtn',
        props: ['size', 'variant', 'color', 'disabled'],
        template:
            '<button :disabled="disabled" :color="color" class="v-btn" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VIcon: {
        name: 'VIcon',
        props: ['size'],
        template: '<i class="v-icon"><slot /></i>',
    },
}))

vi.mock('@/components/settings/SettingsRow.vue', () => ({
    default: {
        name: 'SettingsRow',
        props: ['title', 'icon', 'subTitle'],
        template:
            '<div class="settings-row"><div class="_title">{{ title }}</div><div class="_subtitle">{{ subTitle }}</div><slot /></div>',
    },
}))

vi.mock('@/composables/useWebcam', () => ({
    useWebcam: () => ({
        convertWebcamIcon: (icon: string) => icon,
    }),
}))

// ── Helpers ──
function makeWebcam(overrides: Partial<GuiWebcamStateWebcam> = {}): GuiWebcamStateWebcam {
    return {
        name: 'Test Cam',
        service: 'mjpegstreamer',
        enabled: true,
        icon: 'mdiWebcam',
        target_fps: 15,
        stream_url: 'http://camera.local/webcam?action=stream',
        snapshot_url: 'http://camera.local/webcam?action=snapshot',
        flip_horizontal: false,
        flip_vertical: false,
        rotation: 0,
        source: 'database',
        ...overrides,
    }
}

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            gui: {
                webcams: { webcams: [] },
                ...(overrides.gui || {}),
            },
        },
        getters: {
            ...(overrides.getters || {}),
        },
    })
}

describe('WebcamListEntry.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the webcam name', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamListEntry, {
            props: { webcam: makeWebcam({ name: 'My Cam' }) },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.find('.settings-row').text()).toContain('My Cam')
    })

    it('shows snapshot URL subtitle for mjpegstreamer-adaptive service', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamListEntry, {
            props: {
                webcam: makeWebcam({
                    name: 'Adaptive Cam',
                    service: 'mjpegstreamer-adaptive',
                    snapshot_url: 'http://cam.local/snap.jpg',
                }),
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('URL: http://cam.local/snap.jpg')
    })

    it('shows stream URL subtitle for non-adaptive services', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamListEntry, {
            props: {
                webcam: makeWebcam({
                    name: 'Stream Cam',
                    service: 'mjpegstreamer',
                    stream_url: 'http://cam.local/stream',
                }),
            },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('URL: http://cam.local/stream')
    })

    it('renders toggle, edit, and delete buttons for database source', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamListEntry, {
            props: { webcam: makeWebcam({ source: 'database' }) },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAll('button.v-btn')
        // Toggle (lightbulb), Edit, Delete = 3 buttons
        expect(buttons.length).toBe(3)
    })

    it('does not render action buttons for config source', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamListEntry, {
            props: { webcam: makeWebcam({ source: 'config' }) },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAll('button.v-btn')
        expect(buttons.length).toBe(0)
    })

    it('toggle button has secondary color when webcam is disabled', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamListEntry, {
            props: { webcam: makeWebcam({ enabled: false, source: 'database' }) },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAll('button.v-btn')
        // First button is the toggle
        expect(buttons[0].attributes('color')).toBe('secondary')
    })

    it('toggle button has no secondary color when webcam is enabled', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamListEntry, {
            props: { webcam: makeWebcam({ enabled: true, source: 'database' }) },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAll('button.v-btn')
        // First button is the toggle - color should be '' or not set
        const colorAttr = buttons[0].attributes('color')
        expect(colorAttr === '' || colorAttr === undefined).toBe(true)
    })

    it('toggle dispatches gui/webcams/update with toggled enabled state', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const wrapper = mount(WebcamListEntry, {
            props: { webcam: makeWebcam({ name: 'Bed Cam', enabled: true, source: 'database' }) },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAll('button.v-btn')
        await buttons[0].trigger('click')

        expect(store.dispatch).toHaveBeenCalledWith('gui/webcams/update', {
            webcam: expect.objectContaining({ name: 'Bed Cam', enabled: false }),
            oldWebcamName: 'Bed Cam',
        })
    })

    it('edit button emits edit-webcam event', async () => {
        const store = createStoreWithState()
        const webcam = makeWebcam({ name: 'Edit Cam', source: 'database' })
        const wrapper = mount(WebcamListEntry, {
            props: { webcam },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAll('button.v-btn')
        // Second button is Edit
        await buttons[1].trigger('click')

        expect(wrapper.emitted('edit-webcam')).toBeTruthy()
        expect(wrapper.emitted('edit-webcam')![0]).toEqual([webcam])
    })

    it('delete button dispatches gui/webcams/delete with webcam name', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const wrapper = mount(WebcamListEntry, {
            props: { webcam: makeWebcam({ name: 'Delete Cam', source: 'database' }) },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const buttons = wrapper.findAll('button.v-btn')
        // Third button is Delete
        await buttons[2].trigger('click')

        expect(store.dispatch).toHaveBeenCalledWith('gui/webcams/delete', 'Delete Cam')
    })

    it('renders a border divider when boolBorderTop is true', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamListEntry, {
            props: { webcam: makeWebcam({ source: 'database' }), boolBorderTop: true },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const divider = wrapper.find('.v-divider')
        expect(divider.exists()).toBe(true)
    })

    it('does not render border divider when boolBorderTop is false', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamListEntry, {
            props: { webcam: makeWebcam({ source: 'database' }), boolBorderTop: false },
            global: {
                plugins: [store],
                mocks: { $t: (key: string) => key },
            },
        })

        const divider = wrapper.find('.v-divider')
        expect(divider.exists()).toBe(false)
    })
})
