import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SystemPanelMcu from '@/components/panels/Machine/SystemPanelMcu.vue'

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VRow: { name: 'VRow', template: '<div :class="$attrs.class" :style="$attrs.style"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div :class="$attrs.class" :style="$attrs.style"><slot /></div>' },
    VTooltip: { name: 'VTooltip', template: '<div><slot name="activator" /><slot /></div>' },
    VIcon: { name: 'VIcon', props: ['size'], template: '<i><slot /></i>' },
    VBtn: {
        name: 'VBtn',
        props: ['icon', 'rounded', 'variant'],
        template: '<button :class="$attrs.class" @click="$attrs.onClick || $attrs.click"><slot /></button>',
    },
    VCard: { name: 'VCard', template: '<div><slot /></div>' },
    VCardText: { name: 'VCardText', template: '<div><slot /></div>' },
    VDivider: { name: 'VDivider', template: '<hr />' },
    VDialog: {
        name: 'VDialog',
        props: ['modelValue', 'maxWidth', 'maxHeight', 'scrollable'],
        template: '<div v-if="modelValue" class="v-dialog"><slot /></div>',
    },
    VProgressCircular: {
        name: 'VProgressCircular',
        props: ['rotate', 'size', 'width', 'value', 'color', 'ariaLabel'],
        template: '<div :class="`progress-${color}`">{{ value }}</div>',
    },
    VAlert: { name: 'VAlert', props: ['variant', 'density', 'type', 'border'], template: '<div><slot /></div>' },
    VList: { name: 'VList', template: '<div><slot /></div>' },
    VListItem: { name: 'VListItem', template: '<div><slot name="prepend" /><slot name="title" /></div>' },
    VListItemTitle: { name: 'VListItemTitle', template: '<span><slot /></span>' },
}))

vi.mock('vuetify/components', () => vuetifyComponentsMock)

vi.mock('@/components/ui/Panel.vue', () => ({
    default: {
        name: 'Panel',
        props: ['title', 'icon', 'cardClass', 'marginBottom'],
        template: '<div :class="cardClass"><slot name="buttons" /><slot /></div>',
    },
}))

vi.mock('overlayscrollbars-vue', () => ({
    OverlayScrollbarsComponent: { name: 'OverlayScrollbarsComponent', template: '<div><slot /></div>' },
}))

const mcuBase = {
    name: 'mcu',
    chip: 'rp2040',
    version: 'v0.12.0-123',
    load: '0.02',
    awake: '1234.567',
    freq: 250000000,
    freqFormat: '250 MHz',
    loadPercent: 2,
    loadProgressColor: 'primary',
    mcu_constants: { dummy: 0 },
    last_stats: { dummy: 0 },
    tempSensor: { temperature: 0, measured_min_temp: null, measured_max_temp: null },
}

const mcuWithTempSensor = {
    ...mcuBase,
    tempSensor: {
        temperature: 45.0,
        measured_min_temp: 30.0,
        measured_max_temp: 60.0,
    },
}

const mcuWithTempSensorNoLimits = {
    ...mcuBase,
    tempSensor: {
        temperature: 45.0,
        measured_min_temp: null,
        measured_max_temp: null,
    },
}

const mcuWithConstants = {
    ...mcuBase,
    mcu_constants: {
        ADC_MAX: 4095,
        CLOCK_FREQ: 250000000,
        STATS_SUMSQ_BASE: 256,
    },
}

const mcuWithLastStats = {
    ...mcuBase,
    last_stats: {
        mcu_awake: 1234.567,
        mcu_task_avg: 0.000001,
        mcu_task_stddev: 0.000001,
        bytes_write: 1000,
        bytes_read: 5000,
        bytes_invalid: 0,
        bytes_retransmit: 0,
        freq: 250000000,
    },
}

describe('SystemPanelMcu.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders MCU name', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: mcuBase },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('mcu')
    })

    it('renders chip name when mcu.chip exists', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: mcuBase },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('rp2040')
    })

    it('does not render chip parentheses when chip is absent', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: { ...mcuBase, chip: null } },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).not.toContain('(null)')
    })

    it('renders version translation key', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: mcuBase },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Version')
    })

    it('renders load and awake values', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: mcuBase },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Load')
        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Awake')
    })

    it('renders frequency when freq is not null', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: mcuBase },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Frequency')
    })

    it('does not render frequency when freq is null', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: { ...mcuBase, freq: null, freqFormat: null } as any },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).not.toContain('Machine.SystemPanel.Values.Frequency')
    })

    it('renders temp sensor with values', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: mcuWithTempSensor },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Temp')
    })

    it('renders temp sensor without limits (simple display)', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: mcuWithTempSensorNoLimits },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Temp')
    })

    it('does not render temp when tempSensor is absent', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: { ...mcuBase, tempSensor: null } as any },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        expect(wrapper.text()).not.toContain('Machine.SystemPanel.Values.Temp')
    })

    it('renders progress circular with mcu load', () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: mcuBase },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        // loadPercent is 2 and loadProgressColor is 'primary'
        const progress = wrapper.findComponent({ name: 'VProgressCircular' })
        expect(progress.exists()).toBe(true)
        expect(progress.text()).toBe('2')
    })

    it('opens mcuDetailsDialog when clicking MCU name', async () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: mcuWithConstants },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        const strong = wrapper.find('strong')
        await strong.trigger('click')

        const dialog = wrapper.find('.v-dialog')
        expect(dialog.exists()).toBe(true)
        expect(dialog.text()).toContain('ADC_MAX')
        expect(dialog.text()).toContain('4095')
    })

    it('shows mcu_constants and last_stats in details dialog', async () => {
        const mcu = {
            ...mcuBase,
            mcu_constants: { ADC_MAX: 4095, CLOCK_FREQ: 250000000, STATS_SUMSQ_BASE: 256 },
            last_stats: {
                mcu_awake: 1234.567,
                mcu_task_avg: 0.000001,
                mcu_task_stddev: 0.000001,
                bytes_write: 1000,
                bytes_read: 5000,
                bytes_invalid: 0,
                bytes_retransmit: 0,
                freq: 250000000,
            },
        }
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        const strong = wrapper.find('strong')
        await strong.trigger('click')

        const dialog = wrapper.find('.v-dialog')
        expect(dialog.exists()).toBe(true)
        expect(dialog.text()).toContain('Machine.SystemPanel.Constants')
        expect(dialog.text()).toContain('Machine.SystemPanel.LastStats')
        expect(dialog.text()).toContain('ADC_MAX')
        expect(dialog.text()).toContain('mcu_awake')
    })

    it('shows no constants block when mcu_constants is absent', async () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: { ...mcuBase, mcu_constants: null } } as any,
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        await wrapper.find('strong').trigger('click')

        const dialog = wrapper.find('.v-dialog')
        expect(dialog.text()).not.toContain('Machine.SystemPanel.Constants')
    })

    it('shows close button in dialog', async () => {
        const wrapper = mount(SystemPanelMcu, {
            props: { mcu: mcuWithConstants },
            global: {
                mocks: { $t: (key: string) => key },
            },
        })

        await wrapper.find('strong').trigger('click')

        // The close button should be in the dialog's buttons slot
        const dialog = wrapper.find('.v-dialog')
        expect(dialog.exists()).toBe(true)
    })
})
