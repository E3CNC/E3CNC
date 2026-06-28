import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import WebcamForm from '@/components/settings/Webcams/WebcamForm.vue'
import type { GuiWebcamStateWebcam } from '@/store/gui/webcams/types'

// ── Mocks ──
vi.mock('vuetify/components', () => ({
    VForm: {
        name: 'VForm',
        props: ['modelValue'],
        template: '<form class="v-form"><slot /></form>',
    },
    VCardTitle: { name: 'VCardTitle', template: '<div class="v-card-title"><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VTextField: {
        name: 'VTextField',
        props: ['label', 'modelValue', 'rules'],
        template: '<div class="v-text-field"><span class="_label">{{ label }}</span></div>',
    },
    VSelect: { name: 'VSelect', props: ['label'], template: '<div class="v-select"><span>{{ label }}</span></div>' },
    VCheckbox: {
        name: 'VCheckbox',
        props: ['label', 'modelValue'],
        template: '<div class="v-checkbox"><span>{{ label }}</span></div>',
    },
    VSlider: { name: 'VSlider', props: ['label'], template: '<div class="v-slider"><span>{{ label }}</span></div>' },
    VBtn: {
        name: 'VBtn',
        props: ['type', 'color', 'disabled'],
        template:
            '<button :type="type" :color="color" :disabled="disabled" class="v-btn" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VIcon: { name: 'VIcon', template: '<i class="v-icon"><slot /></i>' },
    VMenu: {
        name: 'VMenu',
        props: ['modelValue', 'closeOnContentClick'],
        template:
            '<div class="v-menu-stub"><slot name="activator" /><div v-if="modelValue" class="v-menu-content"><slot /></div></div>',
    },
    VItemGroup: { name: 'VItemGroup', template: '<div class="v-item-group"><slot /></div>' },
    VList: { name: 'VList', template: '<div class="v-list"><slot /></div>' },
    VListItem: {
        name: 'VListItem',
        template:
            '<div class="v-list-item" @click="$emit(\'click\', $event)"><slot name="prepend" /><slot name="title" /></div>',
    },
    VColorPicker: {
        name: 'VColorPicker',
        props: ['modelValue'],
        template: '<div class="v-color-picker"><slot /></div>',
    },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VSpacer: { name: 'VSpacer', template: '<span class="v-spacer" />' },
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@/composables/useWebcam', () => ({
    useWebcam: () => ({ convertWebcamIcon: (icon: string) => icon }),
}))

vi.mock('@/components/webcams/WebcamWrapper.vue', () => ({
    default: {
        name: 'WebcamWrapper',
        props: ['webcam', 'page'],
        template: '<div class="webcam-wrapper">{{ webcam.name }}</div>',
    },
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
    })
}

describe('WebcamForm.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ── Rendering ──

    it('renders without crashing in create mode', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('renders without crashing in edit mode', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'edit' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.exists()).toBe(true)
    })

    it('shows CreateWebcam title in create mode', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.CreateWebcam')
    })

    it('shows EditWebcam title in edit mode', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'edit' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.EditWebcam')
    })

    // ── Form fields ──

    it('renders name text field', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ name: 'My Cam' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.Name')
    })

    it('renders stream URL field', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.UrlStream')
    })

    it('renders snapshot URL field', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.UrlSnapshot')
    })

    it('renders service select field', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.Service')
    })

    it('renders WebcamWrapper component', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ name: 'Preview Cam' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        const ww = wrapper.find('.webcam-wrapper')
        expect(ww.exists()).toBe(true)
        expect(ww.text()).toContain('Preview Cam')
    })

    it('renders flip horizontal and vertical checkboxes', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.Horizontally')
        expect(wrapper.text()).toContain('Settings.WebcamsTab.Vertically')
    })

    // ── Service-dependent fields ──

    it('shows target FPS for mjpegstreamer-adaptive service', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ service: 'mjpegstreamer-adaptive' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.TargetFPS')
    })

    it('shows rotation for mjpegstreamer service', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ service: 'mjpegstreamer' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.Rotate')
    })

    it('shows aspect ratio field for iframe service', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ service: 'iframe', aspect_ratio: '16:9' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.AspectRatio')
    })

    it('hides target FPS for services without it', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ service: 'iframe', aspect_ratio: '16:9' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).not.toContain('Settings.WebcamsTab.TargetFPS')
    })

    it('shows HideFps checkbox for mjpegstreamer service', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ service: 'mjpegstreamer' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.HideFps')
    })

    it('shows EnableAudio checkbox for webrtc-go2rtc service', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ service: 'webrtc-go2rtc' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.EnableAudio')
    })

    it('shows nozzle crosshair section for mjpegstreamer service', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ service: 'mjpegstreamer' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.NozzleCrosshair')
    })

    it('does not show nozzle crosshair for hlsstream service', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ service: 'hlsstream' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).not.toContain('Settings.WebcamsTab.NozzleCrosshair')
    })

    // ── Cancel button ──

    it('emits close when cancel button is clicked', async () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        const cancelBtn = wrapper.findAll('button.v-btn').find((btn) => btn.text().includes('Buttons.Cancel'))
        expect(cancelBtn).toBeDefined()
        await cancelBtn!.trigger('click')
        expect(wrapper.emitted('close')).toBeTruthy()
    })

    // ── Submit via form submit event ──

    it('dispatches gui/webcams/store on form submit in create mode', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ name: 'New Cam' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        // Submit the form by calling the save function via the submit button click
        // The submit button has type="submit" which triggers the form's submit event
        await wrapper.find('form.v-form').trigger('submit')
        expect(store.dispatch).toHaveBeenCalledWith('gui/webcams/store', expect.objectContaining({ name: 'New Cam' }))
        expect(wrapper.emitted('close')).toBeTruthy()
    })

    it('dispatches gui/webcams/update on form submit in edit mode', async () => {
        const store = createStoreWithState()
        store.dispatch = vi.fn()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ name: 'Existing Cam' }), type: 'edit' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        await wrapper.find('form.v-form').trigger('submit')
        expect(store.dispatch).toHaveBeenCalledWith('gui/webcams/update', {
            webcam: expect.objectContaining({ name: 'Existing Cam' }),
            oldWebcamName: 'Existing Cam',
        })
        expect(wrapper.emitted('close')).toBeTruthy()
    })

    // ── Name uniqueness validation ──

    it('can submit in create mode without crashing even when name exists', async () => {
        const store = createStoreWithState({
            gui: {
                webcams: {
                    webcams: [
                        {
                            name: 'Test Cam',
                            service: 'mjpegstreamer',
                            enabled: true,
                            icon: 'mdiWebcam',
                            target_fps: 15,
                            stream_url: '',
                            snapshot_url: '',
                            flip_horizontal: false,
                            flip_vertical: false,
                            rotation: 0,
                            source: 'database',
                        },
                    ],
                },
            },
        })
        store.dispatch = vi.fn()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ name: 'Test Cam' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        // Form renders without crashing
        expect(wrapper.exists()).toBe(true)
        // Submit should work
        await wrapper.find('form.v-form').trigger('submit')
        expect(store.dispatch).toHaveBeenCalled()
    })

    it('can submit in edit mode without crashing', async () => {
        const store = createStoreWithState({
            gui: {
                webcams: {
                    webcams: [
                        {
                            name: 'My Cam',
                            service: 'mjpegstreamer',
                            enabled: true,
                            icon: 'mdiWebcam',
                            target_fps: 15,
                            stream_url: '',
                            snapshot_url: '',
                            flip_horizontal: false,
                            flip_vertical: false,
                            rotation: 0,
                            source: 'database',
                        },
                    ],
                },
            },
        })
        store.dispatch = vi.fn()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ name: 'My Cam' }), type: 'edit' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.exists()).toBe(true)
        await wrapper.find('form.v-form').trigger('submit')
        expect(store.dispatch).toHaveBeenCalled()
    })

    // ── Aspect ratio validation ──

    // ── Aspect ratio field visibility ──

    it('shows aspect ratio field when aspect_ratio is provided', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ service: 'iframe', aspect_ratio: '16:9' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.AspectRatio')
    })

    // ── Extra data ──

    it('shows HideFps when extra_data has hideFps true', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: {
                webcam: makeWebcam({ service: 'mjpegstreamer', extra_data: { hideFps: true } }),
                type: 'create',
            },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.HideFps')
    })

    it('shows EnableAudio when extra_data has enableAudio true', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: {
                webcam: makeWebcam({ service: 'webrtc-go2rtc', extra_data: { enableAudio: true } }),
                type: 'create',
            },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.EnableAudio')
    })

    it('shows crosshair color and size when nozzleCrosshair is enabled', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: {
                webcam: makeWebcam({
                    service: 'mjpegstreamer',
                    extra_data: { nozzleCrosshair: true, nozzleCrosshairColor: '#00ff00', nozzleCrosshairSize: 0.5 },
                }),
                type: 'create',
            },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.Enable')
        expect(wrapper.text()).toContain('Settings.WebcamsTab.Color')
        expect(wrapper.text()).toContain('Settings.WebcamsTab.Size')
    })

    // ── Required field validation via form rules ──

    // ── Stream/snapshot URL labels always visible ──

    it('renders stream URL field label for mjpegstreamer', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam({ service: 'mjpegstreamer', stream_url: '' }), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.UrlStream')
    })

    it('renders snapshot URL field label for mjpegstreamer-adaptive', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: {
                webcam: makeWebcam({ service: 'mjpegstreamer-adaptive', snapshot_url: '' }),
                type: 'create',
            },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.UrlSnapshot')
    })

    // ── Button text ──

    it('shows SaveWebcam button text in create mode', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'create' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.SaveWebcam')
    })

    it('shows UpdateWebcam button text in edit mode', () => {
        const store = createStoreWithState()
        const wrapper = mount(WebcamForm, {
            props: { webcam: makeWebcam(), type: 'edit' },
            global: { plugins: [store], mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Settings.WebcamsTab.UpdateWebcam')
    })
})
