import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import MiscellaneousLightNeopixel from '@/components/panels/Miscellaneous/MiscellaneousLightNeopixel.vue'

// ── Mocks ──
vi.mock('vuetify/components', () => ({
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
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

vi.mock('@/plugins/helpers', () => ({
    convertName: (name: string) => `converted-${name}`,
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({
        emit: vi.fn(),
    }),
}))

vi.mock('@/components/panels/Miscellaneous/MiscellaneousLightNeopixelGroup.vue', () => ({
    default: {
        name: 'MiscellaneousLightNeopixelGroup',
        props: ['type', 'name', 'group'],
        template: '<div class="neopixel-group-stub">{{ group.name }}</div>',
    },
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
        props: ['modelValue', 'type', 'name'],
        template: '<div class="neopixel-dialog-stub" v-if="modelValue">Dialog</div>',
    },
}))

// ── Helpers ──
function makeStore(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            gui: {
                miscellaneous: {
                    entries: {} as Record<string, any>,
                    ...(overrides.gui?.miscellaneous || {}),
                },
            },
            printer: {
                configfile: {
                    settings: {
                        'led my_strip': {
                            color_order: ['GRB'],
                        },
                        ...(overrides.printer?.configfile?.settings || {}),
                    },
                },
                'led my_strip': {
                    color_data: [[1, 0.5, 0, 0]],
                },
                ...(overrides.printer || {}),
            },
        },
    })
}

describe('MiscellaneousLightNeopixel.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders the converted output name', () => {
        const store = makeStore()
        const wrapper = mount(MiscellaneousLightNeopixel, {
            props: { type: 'led', name: 'my_strip' },
            global: { plugins: [store] },
        })
        expect(wrapper.text()).toContain('converted-my_strip')
    })

    it('renders neopixel state indicator when no groups', () => {
        const store = makeStore()
        const wrapper = mount(MiscellaneousLightNeopixel, {
            props: { type: 'led', name: 'my_strip' },
            global: { plugins: [store] },
        })
        const stateIndicator = wrapper.findComponent({ name: 'MiscellaneousLightNeopixelState' })
        expect(stateIndicator.exists()).toBe(true) // rendered as child via v-if
    })

    it('renders neopixel group for each lightgroup entry', () => {
        const store = makeStore({
            gui: {
                miscellaneous: {
                    entries: {
                        group1: {
                            type: 'led',
                            name: 'my_strip',
                            lightgroups: {
                                g1: { name: 'Front', start: 1, end: 10 },
                                g2: { name: 'Back', start: 11, end: 20 },
                            },
                            presets: {},
                        },
                    },
                },
            },
        })
        const wrapper = mount(MiscellaneousLightNeopixel, {
            props: { type: 'led', name: 'my_strip' },
            global: { plugins: [store] },
        })
        const groups = wrapper.findAllComponents({ name: 'MiscellaneousLightNeopixelGroup' })
        expect(groups).toHaveLength(2)
        expect(groups[0].props('group').name).toBe('Front')
        expect(groups[1].props('group').name).toBe('Back')
    })

    it('shows dialog when state indicator is clicked', async () => {
        const store = makeStore()
        const wrapper = mount(MiscellaneousLightNeopixel, {
            props: { type: 'led', name: 'my_strip' },
            global: { plugins: [store] },
        })
        // Click the state indicator to show dialog
        const stateIndicator = wrapper.findComponent({ name: 'MiscellaneousLightNeopixelState' })
        await stateIndicator.vm.$emit('click-button')
        await wrapper.vm.$nextTick()
        const dialog = wrapper.findComponent({ name: 'MiscellaneousLightNeopixelDialog' })
        expect(dialog.exists()).toBe(true)
        expect(dialog.props('modelValue')).toBe(true)
    })
})
