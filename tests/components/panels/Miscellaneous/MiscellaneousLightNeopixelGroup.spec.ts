import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import MiscellaneousLightNeopixelGroup from '@/components/panels/Miscellaneous/MiscellaneousLightNeopixelGroup.vue'

// ── Mocks ──
vi.mock('vuetify/components', () => ({
    VListSubheader: { name: 'VListSubheader', template: '<div class="v-list-subheader"><slot /></div>' },
    VIcon: {
        name: 'VIcon',
        props: ['size'],
        template: '<i class="v-icon" @click="$emit(\'click\', $event)"><slot /></i>',
    },
    VBtn: { name: 'VBtn', template: '<button class="v-btn" @click="$emit(\'click\', $event)"><slot /></button>' },
    VSpacer: { name: 'VSpacer', template: '<span class="v-spacer" />' },
    VDialog: {
        name: 'VDialog',
        props: ['modelValue'],
        template: '<div class="v-dialog" v-if="modelValue"><slot /></div>',
    },
    VCard: { name: 'VCard', template: '<div class="v-card"><slot /></div>' },
    VCardTitle: { name: 'VCardTitle', template: '<div class="v-card-title"><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VSlider: {
        name: 'VSlider',
        props: ['modelValue', 'label', 'max', 'min', 'step', 'thumbLabel', 'hideDetails'],
        template: '<div class="v-slider">{{ label }}<input type="range" /></div>',
    },
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: vi.fn(),
    }),
}))

vi.mock('@/components/panels/Miscellaneous/MiscellaneousLightNeopixelState.vue', () => ({
    default: {
        name: 'MiscellaneousLightNeopixelState',
        props: ['type', 'name', 'index'],
        template: '<span class="neopixel-state-stub" @click="$emit(\'click-button\')">State</span>',
    },
}))

vi.mock('@/components/dialogs/MiscellaneousLightNeopixelDialog.vue', () => ({
    default: {
        name: 'MiscellaneousLightNeopixelDialog',
        props: ['modelValue', 'type', 'name', 'index'],
        template: '<div class="neopixel-dialog-stub" v-if="modelValue">Dialog</div>',
    },
}))

// ── Helpers ──
function makeStore(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            printer: {
                configfile: {
                    settings: {
                        'neopixel my_strip': {
                            color_order: ['GRB', 'GRB', 'GRB'],
                        },
                        ...(overrides.printer?.configfile?.settings || {}),
                    },
                },
                'neopixel my_strip': {
                    color_data: [
                        [1, 0.5, 0, 0],
                        [0, 0, 0, 0],
                        [0.3, 0.2, 0.1, 0],
                    ],
                },
                ...(overrides.printer || {}),
            },
        },
    })
}

describe('MiscellaneousLightNeopixelGroup.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the group name', () => {
        const store = makeStore()
        const wrapper = mount(MiscellaneousLightNeopixelGroup, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                group: { name: 'Front LEDs', start: 1, end: 5 },
            },
            global: { plugins: [store] },
        })
        expect(wrapper.text()).toContain('Front LEDs')
    })

    it('renders neopixel state indicator with correct index', () => {
        const store = makeStore()
        const wrapper = mount(MiscellaneousLightNeopixelGroup, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                group: { name: 'Front', start: 2, end: 4 },
            },
            global: { plugins: [store] },
        })
        const stateIndicator = wrapper.findComponent({ name: 'MiscellaneousLightNeopixelState' })
        expect(stateIndicator.exists()).toBe(true)
        expect(stateIndicator.props('index')).toBe(2)
    })

    it('shows dialog when state indicator emits click-button', async () => {
        const store = makeStore()
        const wrapper = mount(MiscellaneousLightNeopixelGroup, {
            props: {
                type: 'neopixel',
                name: 'my_strip',
                group: { name: 'Back', start: 1, end: 3 },
            },
            global: { plugins: [store] },
        })
        const stateIndicator = wrapper.findComponent({ name: 'MiscellaneousLightNeopixelState' })
        await stateIndicator.vm.$emit('click-button')
        await wrapper.vm.$nextTick()
        const dialog = wrapper.findComponent({ name: 'MiscellaneousLightNeopixelDialog' })
        expect(dialog.exists()).toBe(true)
        expect(dialog.props('modelValue')).toBe(true)
    })
})
