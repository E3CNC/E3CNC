import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SystemPackagesList from '@/components/panels/Machine/UpdatePanel/SystemPackagesList.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('@mdi/js', () => ({
    mdiCloseThick: 'mdi-close-thick',
    mdiPackageVariantClosed: 'mdi-package-variant-closed',
}))

vi.mock('vuetify/components', () => ({
    VDialog: { name: 'VDialog', props: ['modelValue', 'maxWidth'], template: '<div class="v-dialog" v-if="$props.modelValue"><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div class="v-card-text"><slot /></div>' },
    VRow: { name: 'VRow', template: '<div class="v-row"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div class="v-col"><slot /></div>' },
    VCardActions: { name: 'VCardActions', template: '<div class="v-card-actions"><slot /></div>' },
    VSpacer: { name: 'VSpacer', template: '<div class="v-spacer" />' },
    VBtn: { name: 'VBtn', props: ['icon', 'variant', 'color', 'rounded'], template: '<button class="v-btn"><slot /></button>' },
}))

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: { icon: String, title: [String, Object], cardClass: String, marginBottom: Boolean },
        template: '<div class="panel" :class="cardClass"><slot name="buttons" /><slot /><span class="panel-title">{{ title }}</span></div>',
    },
}))

describe('SystemPackagesList.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    const packagesList = ['package1', 'package2', 'package3']

    it('does not render dialog when modelValue is false', () => {
        const wrapper = mount(SystemPackagesList, {
            props: { modelValue: false, packagesList },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(false)
    })

    it('renders dialog when modelValue is true', () => {
        const wrapper = mount(SystemPackagesList, {
            props: { modelValue: true, packagesList },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.v-dialog').exists()).toBe(true)
    })

    it('renders panel with correct title', () => {
        const wrapper = mount(SystemPackagesList, {
            props: { modelValue: true, packagesList },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.find('.panel-title').text()).toContain('Machine.UpdatePanel.UpgradeableSystemPackages')
    })

    it('renders the packages description text', () => {
        const wrapper = mount(SystemPackagesList, {
            props: { modelValue: true, packagesList },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('Machine.UpdatePanel.ThesePackagesCanBeUpgrade')
    })

    it('renders the package list as comma-separated', () => {
        const wrapper = mount(SystemPackagesList, {
            props: { modelValue: true, packagesList },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        expect(wrapper.text()).toContain('package1, package2, package3')
    })

    it('renders close button in card-actions', () => {
        const wrapper = mount(SystemPackagesList, {
            props: { modelValue: true, packagesList },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })
        // Close button should be inside card-actions
        const cardActions = wrapper.find('.v-card-actions')
        expect(cardActions.exists()).toBe(true)
        // Button text should be Close
        expect(wrapper.text()).toContain('Buttons.Close')
    })
})
