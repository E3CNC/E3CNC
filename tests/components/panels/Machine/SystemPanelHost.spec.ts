import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import SystemPanelHost from '@/components/panels/Machine/SystemPanelHost.vue'

const mockBaseValues = vi.hoisted(() => ({
    klipperReadyForGui: { value: true, __v_isRef: true },
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => mockBaseValues,
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({
        t: (key: string) => key,
    }),
}))

const vuetifyComponentsMock = vi.hoisted(() => ({
    VRow: { name: 'VRow', template: '<div :class="$attrs.class"><slot /></div>' },
    VCol: { name: 'VCol', template: '<div :class="$attrs.class"><slot /></div>' },
    VTooltip: { name: 'VTooltip', template: '<div><slot name="activator" /><slot /></div>' },
    VIcon: { name: 'VIcon', template: '<i class="v-icon"><slot /></i>' },
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

vi.mock('@/plugins/helpers', () => ({
    formatFilesize: (bytes: number) => `${bytes} B`,
}))

function makeHostStats(overrides: Record<string, any> = {}) {
    return {
        cpuName: 'BCM2711',
        cpuDesc: 'ARMv8 Processor rev 3',
        bits: '64bit',
        version: 'v0.12.0',
        pythonVersion: '3.11.2',
        os: 'Debian GNU/Linux 12 (bookworm)',
        release_info: { name: '#1 SMP', version_id: '12', id: 'debian' },
        load: 0.5,
        loadPercent: 12,
        loadProgressColor: 'primary',
        memoryFormat: '500 MB / 1 GB',
        memUsed: '500 MB',
        memAvail: '500 MB',
        memTotal: '1 GB',
        memUsage: 50,
        memUsageColor: 'primary',
        tempSensor: null,
        ...overrides,
    }
}

function makeEmptyHostStats(overrides: Record<string, any> = {}) {
    return {
        cpuName: null,
        cpuDesc: null,
        bits: null,
        version: '',
        pythonVersion: null,
        os: null,
        release_info: {},
        load: '',
        loadPercent: 0,
        loadProgressColor: '',
        memoryFormat: null,
        memUsed: null,
        memAvail: null,
        memTotal: null,
        memUsage: null,
        memUsageColor: '',
        tempSensor: null,
        ...overrides,
    }
}

function createStoreWithState(overrides: Record<string, any> = {}) {
    return createStore({
        state: {
            socket: { isConnected: true, initializationList: [], loadings: [] },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                system_info: null,
                ...(overrides.server || {}),
            },
            printer: {
                print_stats: { state: 'standby' },
                idle_timeout: { state: 'Idle' },
                toolhead: { homed_axes: 'xyz' },
                software_version: 'v0.12.0-123',
                system_stats: { sysload: 0.5, memavail: 500000 },
                ...(overrides.printer || {}),
            },
            gui: {
                dashboard: {
                    nonExpandPanels: { mobile: [], tablet: [], desktop: [], widescreen: [] },
                    floatingPanels: {},
                },
                general: { printername: 'Test' },
                control: {},
                uiSettings: {},
                navigationSettings: { entries: [] },
            },
            files: {},
            instancesDB: 'moonraker',
            ...overrides,
        },
        getters: {
            'socket/getUrl': () => '//localhost:8080',
            'socket/getHostUrl': () => '//localhost:8080',
            'gui/getPanelExpand': () => () => true,
            'server/getHostStats': () => null,
            'server/getCpuUsage': () => null,
            'server/getNetworkInterfaces': () => null,
            'files/getDirectory': () => () => null,
            ...(overrides.getters || {}),
        },
    })
}

const $t = (key: string) => key

describe('SystemPanelHost.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders structure with empty hostStats (all values null/empty)', () => {
        const hostStats = makeEmptyHostStats()
        const store = createStoreWithState({
            getters: {
                'server/getHostStats': () => hostStats,
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        // The panel structure renders (hostStats is truthy even with empty values)
        expect(wrapper.find('.system-load-row').exists()).toBe(true)
        // Load is always rendered regardless of hostStats values
        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Load')
        // Version and Memory are conditionally rendered - should not show when empty/null
        expect(wrapper.text()).not.toContain('Machine.SystemPanel.Values.Version')
        expect(wrapper.text()).not.toContain('Machine.SystemPanel.Values.Memory')
    })

    it('renders host name and version when hostStats exist', () => {
        const hostStats = makeHostStats()
        const store = createStoreWithState({
            getters: {
                'server/getHostStats': () => hostStats,
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        const strong = wrapper.find('strong')
        expect(strong.exists()).toBe(true)
        expect(strong.text()).toBe('Host')
        // Should show the version translation key
        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Version')
    })

    it('shows CPU name with bits when cpuName exists', () => {
        const hostStats = makeHostStats()
        const store = createStoreWithState({
            getters: {
                'server/getHostStats': () => hostStats,
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        const chip = wrapper.find('.system-host-chip')
        expect(chip.exists()).toBe(true)
        expect(chip.text()).toContain('BCM2711')
        expect(chip.text()).toContain('64bit')
    })

    it('renders CPU usage gauge when getCpuUsage returns a value', () => {
        const hostStats = makeHostStats()
        const store = createStoreWithState({
            getters: {
                'server/getHostStats': () => hostStats,
                'server/getCpuUsage': () => 42,
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        const gauges = wrapper.findAll('.system-load-gauge')
        const cpuGauge = gauges.find((g) => g.text().includes('42'))
        expect(cpuGauge).toBeTruthy()
        expect(cpuGauge!.text()).toContain('Machine.SystemPanel.Cpu')
    })

    it('renders load gauge when cpuUsage is null and loadPercent exists', () => {
        const hostStats = makeHostStats({ loadPercent: 12 })
        const store = createStoreWithState({
            getters: {
                'server/getHostStats': () => hostStats,
                'server/getCpuUsage': () => null,
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        const gauges = wrapper.findAll('.system-load-gauge')
        const loadGauge = gauges.find((g) => g.text().includes('Machine.SystemPanel.Load'))
        expect(loadGauge).toBeTruthy()
    })

    it('renders memory gauge when memUsage is not null', () => {
        const hostStats = makeHostStats({ memUsage: 50 })
        const store = createStoreWithState({
            getters: {
                'server/getHostStats': () => hostStats,
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        const gauges = wrapper.findAll('.system-load-gauge')
        const memGauge = gauges.find((g) => g.text().includes('Machine.SystemPanel.Memory'))
        expect(memGauge).toBeTruthy()
    })

    it('opens hostDetailsDialog when clicking Host name', async () => {
        const hostStats = makeHostStats()
        const store = createStoreWithState({
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                system_info: {
                    cpu_info: {
                        processor: 'BCM2711',
                        cpu_desc: '',
                        bits: '64bit',
                        cpu_count: 4,
                        total_memory: 1024000,
                        serial_number: '10000000',
                        hardware_desc: 'Pi 4',
                        model: 'Raspberry Pi 4',
                    },
                    distribution: { name: 'Debian', release_info: { name: '#1', version_id: '12', id: 'debian' } },
                    python: { version: ['3', '11', '2'], version_string: '3.11.2' },
                    system_uptime: { uptime: 123456 },
                    available_services: ['klipper', 'moonraker'],
                    sd_info: {
                        manufacturer_id: '123',
                        manufacturer: 'SanDisk',
                        oem_id: 'abc',
                        product_name: 'SD32G',
                        product_revision: '1.0',
                        serial_number: '12345',
                        capacity: '31.9G',
                    },
                },
            },
            getters: {
                'server/getHostStats': () => hostStats,
                'server/getCpuUsage': () => 42,
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        await wrapper.find('strong').trigger('click')

        const dialog = wrapper.find('.v-dialog')
        expect(dialog.exists()).toBe(true)
        expect(wrapper.text()).toContain('cpu_info')
    })

    it('renders temp sensor when available', () => {
        const hostStats = makeHostStats({
            tempSensor: {
                temperature: 45,
                measured_min_temp: null,
                measured_max_temp: null,
            },
        })
        const store = createStoreWithState({
            getters: {
                'server/getHostStats': () => hostStats,
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Temp')
    })

    it('renders temp sensor with min/max tooltip data', () => {
        const hostStats = makeHostStats({
            tempSensor: {
                temperature: 45,
                measured_min_temp: 30,
                measured_max_temp: 60,
            },
        })
        const store = createStoreWithState({
            getters: {
                'server/getHostStats': () => hostStats,
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        // With both min and max, the tooltip wraps the temp
        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Temp')
        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.TempMax')
        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.TempMin')
    })

    it('renders network interfaces when present', () => {
        const hostStats = makeHostStats()
        const store = createStoreWithState({
            getters: {
                'server/getHostStats': () => hostStats,
                'server/getNetworkInterfaces': () => ({
                    eth0: {
                        bandwidth: 1000000,
                        rx_bytes: 500000,
                        tx_bytes: 300000,
                        details: {
                            ip_addresses: [{ family: 'ipv4', address: '192.168.1.100' }],
                        },
                    },
                }),
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        expect(wrapper.text()).toContain('eth0')
        expect(wrapper.text()).toContain('192.168.1.100')
        expect(wrapper.text()).toContain('Machine.SystemPanel.Values.Bandwidth')
    })

    it('shows dialog with "No More Infos" when system_info is empty', async () => {
        const hostStats = makeHostStats()
        const store = createStoreWithState({
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                system_info: {},
            },
            getters: {
                'server/getHostStats': () => hostStats,
            },
        })
        const wrapper = mount(SystemPanelHost, {
            global: {
                plugins: [store],
                mocks: { $t },
            },
        })

        await wrapper.find('strong').trigger('click')

        expect(wrapper.text()).toContain('Machine.SystemPanel.NoMoreInfos')
    })
})
