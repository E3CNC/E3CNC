import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import MinSettingsPanel from '@/components/panels/MinSettingsPanel.vue'

const mockKlipperState = vi.hoisted(() => {
    class MockRef { _value: any; __v_isRef = true; constructor(v: any) { this._value = v } get value() { return this._value } set value(v) { this._value = v } }
    return new MockRef('ready')
})
const mockExistsPrinterConfig = vi.hoisted(() => {
    class MockRef { _value: any; __v_isRef = true; constructor(v: any) { this._value = v } get value() { return this._value } set value(v) { this._value = v } }
    return new MockRef(true)
})
const mockMissingConfigs = vi.hoisted(() => {
    class MockRef { _value: any; __v_isRef = true; constructor(v: any) { this._value = v } get value() { return this._value } set value(v) { this._value = v } }
    return new MockRef(['[idle_timeout]'])
})
const mockMainsailCfgExists = vi.hoisted(() => {
    class MockRef { _value: any; __v_isRef = true; constructor(v: any) { this._value = v } get value() { return this._value } set value(v) { this._value = v } }
    return new MockRef(false)
})

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperState: mockKlipperState,
        existsPrinterConfig: mockExistsPrinterConfig,
        missingConfigs: mockMissingConfigs,
        mainsailCfgExists: mockMainsailCfgExists,
    }),
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], collapsible: Boolean, cardClass: String, toolbarColor: String },
        template: '<div class="panel" :class="cardClass"><slot /><slot name="buttons" /><span class="panel-title">{{ title }}</span></div>',
    },
}))

vi.mock('vuetify/components', () => ({
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VBtn: {
        name: 'VBtn',
        props: { size: String, href: String, target: String },
        template: '<a class="v-btn" :href="href" :target="target"><slot /></a>',
    },
    VIcon: { name: 'VIcon', props: { size: String, icon: String }, template: '<i class="v-icon"><slot /></i>' },
}))

describe('MinSettingsPanel.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKlipperState.value = 'ready'
        mockExistsPrinterConfig.value = true
        mockMissingConfigs.value = ['[idle_timeout]']
        mockMainsailCfgExists.value = false
    })

    it('renders when klipperState is ready, config exists, and missing configs present', () => {
        const wrapper = mount(MinSettingsPanel, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.find('.panel').exists()).toBe(true)
    })

    it('does NOT render when klipperState is not ready', () => {
        mockKlipperState.value = 'error'
        const wrapper = mount(MinSettingsPanel, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.find('.panel').exists()).toBe(false)
    })

    it('does NOT render when existsPrinterConfig is false', () => {
        mockExistsPrinterConfig.value = false
        const wrapper = mount(MinSettingsPanel, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.find('.panel').exists()).toBe(false)
    })

    it('does NOT render when missingConfigs is empty', () => {
        mockMissingConfigs.value = []
        const wrapper = mount(MinSettingsPanel, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.find('.panel').exists()).toBe(false)
    })

    it('shows missing config modules in a list', () => {
        mockMissingConfigs.value = ['[idle_timeout]', '[display_status]']
        const wrapper = mount(MinSettingsPanel, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('[idle_timeout]')
        expect(wrapper.text()).toContain('[display_status]')
    })

    it('shows mainsail config include message when mainsailCfgExists is true', () => {
        mockMainsailCfgExists.value = true
        const wrapper = mount(MinSettingsPanel, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).toContain('Panels.MinSettingsPanel.IncludeMainsailCfg')
    })

    it('does NOT show mainsail config include message when mainsailCfgExists is false', () => {
        mockMainsailCfgExists.value = false
        const wrapper = mount(MinSettingsPanel, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.text()).not.toContain('Panels.MinSettingsPanel.IncludeMainsailCfg')
    })

    it('renders a "More Information" button with link to docs', () => {
        const wrapper = mount(MinSettingsPanel, {
            global: { mocks: { $t: (key: string) => key } },
        })
        const btn = wrapper.find('.v-btn')
        expect(btn.exists()).toBe(true)
        expect(btn.attributes('href')).toBe('https://docs.mainsail.xyz/setup/configuration')
        expect(btn.attributes('target')).toBe('_blank')
    })

    it('renders v-divider when mainsailCfgExists is true', () => {
        mockMainsailCfgExists.value = true
        const wrapper = mount(MinSettingsPanel, {
            global: { mocks: { $t: (key: string) => key } },
        })
        expect(wrapper.findAll('.v-divider').length).toBeGreaterThanOrEqual(1)
    })
})
