import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { ref } from 'vue'
import TheTopCornerMenu from '@/components/TheTopCornerMenu.vue'

// ── Module-scope mutable refs for composable mocks ──
const mockKlipperState = ref('ready')
const mockPrinterState = ref('ready')
const mockPrinterIsPrinting = ref(false)
const mockHideOtherInstances = ref(false)
const mockKlipperInstance = ref('')
const mockMoonrakerInstance = ref('')
const mockSocketEmit = vi.fn()

// i18n mock
const mockT = vi.fn((key: string) => {
    const translations: Record<string, string> = {
        'App.TopCornerMenu.KlipperControl': 'Klipper Control',
        'App.TopCornerMenu.KlipperRestart': 'Klipper Restart',
        'App.TopCornerMenu.KlipperFirmwareRestart': 'Klipper Firmware Restart',
        'App.TopCornerMenu.ServiceControl': 'Service Control',
        'App.TopCornerMenu.PowerDevices': 'Power Devices',
        'App.TopCornerMenu.HostControl': 'Host Control',
        'App.TopCornerMenu.Reboot': 'Reboot',
        'App.TopCornerMenu.Shutdown': 'Shutdown',
        'PowerDeviceChangeDialog.TurnDeviceOn': 'Turn On {device}',
        'PowerDeviceChangeDialog.TurnDeviceOff': 'Turn Off {device}',
        'PowerDeviceChangeDialog.AreYouSure': 'Are you sure?',
        'Buttons.Yes': 'Yes',
        'Buttons.No': 'No',
        'App.TopCornerMenu.ConfirmationDialog.Title.KlipperRestart': 'Restart Klipper?',
        'App.TopCornerMenu.ConfirmationDialog.Description.KlipperRestart': 'This will restart Klipper.',
        'App.TopCornerMenu.ConfirmationDialog.Title.KlipperFirmwareRestart': 'Firmware Restart?',
        'App.TopCornerMenu.ConfirmationDialog.Description.KlipperFirmwareRestart':
            'This will perform a firmware restart.',
        'App.TopCornerMenu.ConfirmationDialog.Title.HostReboot': 'Reboot Host?',
        'App.TopCornerMenu.ConfirmationDialog.Description.HostReboot': 'This will reboot the host.',
        'App.TopCornerMenu.ConfirmationDialog.Title.HostShutdown': 'Shutdown Host?',
        'App.TopCornerMenu.ConfirmationDialog.Description.HostShutdown': 'This will shut down the host.',
    }
    return translations[key] ?? key
})

// ── Mocks ──

vi.mock('vuetify/components', () => ({
    VMenu: {
        name: 'VMenu',
        props: { modelValue: Boolean },
        template: '<div class="v-menu"><slot name="activator" /><slot /></div>',
    },
    VBtn: {
        name: 'VBtn',
        props: { icon: Boolean },
        template: '<button class="v-btn" @click="$emit(\'click\', $event)"><slot /></button>',
    },
    VList: { name: 'VList', template: '<div class="v-list"><slot /></div>' },
    VListItem: {
        name: 'VListItem',
        props: { link: Boolean, disabled: Boolean },
        template:
            '<div class="v-list-item" :class="{ \'v-list-item--disabled\': disabled }" @click="!disabled && $emit(\'click\', $event)"><slot name="title" /><slot name="append" /></div>',
    },
    VIcon: {
        name: 'VIcon',
        props: { icon: String, size: String, color: String },
        template: '<i class="v-icon"><slot /></i>',
    },
    VDivider: { name: 'VDivider', template: '<hr class="v-divider" />' },
    VListSubheader: {
        name: 'VListSubheader',
        template: '<div class="v-list-subheader"><slot /></div>',
    },
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mockSocketEmit }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        klipperState: mockKlipperState,
        printer_state: mockPrinterState,
        printerIsPrinting: mockPrinterIsPrinting,
    }),
}))

vi.mock('@/composables/useServices', () => ({
    useServices: () => ({
        hideOtherInstances: mockHideOtherInstances,
        klipperInstance: mockKlipperInstance,
        moonrakerInstance: mockMoonrakerInstance,
    }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: mockT }),
}))

vi.mock('@/components/ui/TopCornerMenuService.vue', () => ({
    default: {
        name: 'TopCornerMenuService',
        props: ['service'],
        template: '<div class="mock-service" :data-service="service" />',
    },
}))

vi.mock('@/components/dialogs/ConfirmationDialog.vue', () => ({
    default: {
        name: 'ConfirmationDialog',
        props: ['modelValue', 'title', 'text', 'actionButtonText', 'cancelButtonText'],
        template:
            '<div v-if="modelValue" class="mock-confirmation" :data-title="title" :data-text="text" :data-action-text="actionButtonText" @action="$emit(\'action\')"><slot /></div>',
        emits: ['action'],
    },
}))

// ── Helper: create store ──

interface StoreOverrides {
    state?: Record<string, any>
    getters?: Record<string, any>
}

function createStoreWithState(overrides: StoreOverrides = {}) {
    return createStore({
        state: {
            server: {
                system_info: {
                    available_services: [],
                },
            },
            gui: {
                uiSettings: {
                    confirmOnPowerDeviceChange: false,
                },
            },
            printer: {
                print_stats: {
                    state: 'standby',
                    filename: '',
                },
            },
            ...(overrides.state || {}),
        },
        getters: {
            'server/power/getDevices': () => [],
            ...(overrides.getters || {}),
        },
    })
}

// ── Helpers ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function vmAny(wrapper: any) {
    return wrapper.vm as any
}

function mountComponent(storeOverrides: StoreOverrides = {}) {
    const store = createStoreWithState(storeOverrides)

    return mount(TheTopCornerMenu, {
        global: {
            plugins: [store],
            mocks: {
                $t: mockT,
            },
            stubs: {
                'v-menu': false,
                'v-btn': false,
                'v-list': false,
                'v-list-item': false,
                'v-icon': false,
                'v-divider': false,
                'v-list-subheader': false,
                'confirmation-dialog': false,
                'top-corner-menu-service': false,
            },
        },
    })
}

// ── Tests ──

describe('TheTopCornerMenu.vue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockKlipperState.value = 'ready'
        mockPrinterState.value = 'ready'
        mockPrinterIsPrinting.value = false
        mockHideOtherInstances.value = false
        mockKlipperInstance.value = ''
        mockMoonrakerInstance.value = ''
    })

    // ── 1. Renders menu activator button ──
    it('renders menu activator button', async () => {
        const wrapper = await mountComponent()
        const btn = wrapper.findComponent({ name: 'VBtn' })
        expect(btn.exists()).toBe(true)
    })

    // ── 2. Shows Klipper control section when connected ──
    it('shows Klipper control section when connected', async () => {
        mockKlipperState.value = 'ready'
        const wrapper = await mountComponent()
        // Open the menu so slots render
        await wrapper.setData({ showMenu: true })
        await wrapper.vm.$nextTick()

        const subheaders = wrapper.findAllComponents({ name: 'VListSubheader' })
        const klipperHeader = subheaders.find((sh) => sh.text().includes('Klipper Control'))
        expect(klipperHeader).toBeTruthy()

        const items = wrapper.findAllComponents({ name: 'VListItem' })
        const klipperRestart = items.find((i) => i.text().includes('Klipper Restart'))
        const klipperFirmware = items.find((i) => i.text().includes('Klipper Firmware Restart'))
        expect(klipperRestart).toBeTruthy()
        expect(klipperFirmware).toBeTruthy()
    })

    // ── 3. Hides Klipper section when disconnected ──
    it('hides Klipper section when disconnected', async () => {
        mockKlipperState.value = 'disconnected'
        const wrapper = await mountComponent()
        await wrapper.setData({ showMenu: true })
        await wrapper.vm.$nextTick()

        const subheaders = wrapper.findAllComponents({ name: 'VListSubheader' })
        const klipperHeader = subheaders.find((sh) => sh.text().includes('Klipper Control'))
        expect(klipperHeader).toBeFalsy()
    })

    // ── 4. Shows service section when services available ──
    it('shows service section when services available', async () => {
        const wrapper = await mountComponent({
            state: {
                server: {
                    system_info: {
                        available_services: ['klipper', 'moonraker'],
                    },
                },
            },
        })
        await wrapper.setData({ showMenu: true })
        await wrapper.vm.$nextTick()

        const subheaders = wrapper.findAllComponents({ name: 'VListSubheader' })
        const serviceHeader = subheaders.find((sh) => sh.text().includes('Service Control'))
        expect(serviceHeader).toBeTruthy()

        const serviceComponents = wrapper.findAllComponents({ name: 'TopCornerMenuService' })
        expect(serviceComponents.length).toBe(2)
    })

    // ── 5. Shows power devices when available ──
    it('shows power devices when available', async () => {
        const mockDevices = [
            { device: 'Light', status: 'on', locked_while_printing: false, type: 'gpio' },
            { device: 'Fan', status: 'off', locked_while_printing: false, type: 'gpio' },
        ]
        const wrapper = await mountComponent({
            getters: {
                'server/power/getDevices': () => mockDevices,
            },
        })
        await wrapper.setData({ showMenu: true })
        await wrapper.vm.$nextTick()

        const subheaders = wrapper.findAllComponents({ name: 'VListSubheader' })
        const powerHeader = subheaders.find((sh) => sh.text().includes('Power Devices'))
        expect(powerHeader).toBeTruthy()

        // Power devices render as VListItems
        const items = wrapper.findAllComponents({ name: 'VListItem' })
        const lightItem = items.find((i) => i.text().includes('Light'))
        const fanItem = items.find((i) => i.text().includes('Fan'))
        expect(lightItem).toBeTruthy()
        expect(fanItem).toBeTruthy()
    })

    // ── 6. Shows host control (Reboot, Shutdown) ──
    it('shows host control (Reboot, Shutdown)', async () => {
        const wrapper = await mountComponent()
        await wrapper.setData({ showMenu: true })
        await wrapper.vm.$nextTick()

        const subheaders = wrapper.findAllComponents({ name: 'VListSubheader' })
        const hostHeader = subheaders.find((sh) => sh.text().includes('Host Control'))
        expect(hostHeader).toBeTruthy()

        const items = wrapper.findAllComponents({ name: 'VListItem' })
        const rebootItem = items.find((i) => i.text().includes('Reboot'))
        const shutdownItem = items.find((i) => i.text().includes('Shutdown'))
        expect(rebootItem).toBeTruthy()
        expect(shutdownItem).toBeTruthy()
    })

    // ── 7. Klipper restart emits socket event + store dispatch ──
    it('klipper restart emits socket event', async () => {
        const store = createStoreWithState()
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        const wrapper = mount(TheTopCornerMenu, {
            global: {
                plugins: [store],
                mocks: {
                    $t: mockT,
                },
            },
        })

        // Call klipperRestart directly
        vmAny(wrapper).klipperRestart()
        await wrapper.vm.$nextTick()

        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'RESTART',
            type: 'command',
        })
        expect(mockSocketEmit).toHaveBeenCalledWith('printer.gcode.script', { script: 'RESTART' })
    })

    // ── 8. Klipper firmware restart emits socket event ──
    it('klipper firmware restart emits socket event', async () => {
        const store = createStoreWithState()
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        const wrapper = mount(TheTopCornerMenu, {
            global: {
                plugins: [store],
                mocks: {
                    $t: mockT,
                },
            },
        })

        vmAny(wrapper).klipperFirmwareRestart()
        await wrapper.vm.$nextTick()

        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'FIRMWARE_RESTART',
            type: 'command',
        })
        expect(mockSocketEmit).toHaveBeenCalledWith('printer.gcode.script', {
            script: 'FIRMWARE_RESTART',
        })
    })

    // ── 9. Host reboot emits socket event ──
    it('host reboot emits socket event', async () => {
        const wrapper = await mountComponent()

        vmAny(wrapper).hostReboot()
        await wrapper.vm.$nextTick()

        expect(mockSocketEmit).toHaveBeenCalledWith('machine.reboot', {})
    })

    // ── 10. Host shutdown emits socket event ──
    it('host shutdown emits socket event', async () => {
        const wrapper = await mountComponent()

        vmAny(wrapper).hostShutdown()
        await wrapper.vm.$nextTick()

        expect(mockSocketEmit).toHaveBeenCalledWith('machine.shutdown', {})
    })

    // ── 11. Power device click with confirmOnPowerDeviceChange shows dialog ──
    it('power device click with confirmOnPowerDeviceChange shows dialog', async () => {
        const mockDevices = [{ device: 'Light', status: 'off', locked_while_printing: false, type: 'gpio' }]
        const wrapper = await mountComponent({
            state: {
                gui: {
                    uiSettings: {
                        confirmOnPowerDeviceChange: true,
                    },
                },
            },
            getters: {
                'server/power/getDevices': () => mockDevices,
            },
        })
        await wrapper.setData({ showMenu: true })
        await wrapper.vm.$nextTick()

        // Call changeSwitch directly (simulating click on a device)
        vmAny(wrapper).changeSwitch(mockDevices[0], mockDevices[0].status)
        await wrapper.vm.$nextTick()

        // Dialog should now be visible
        expect(vmAny(wrapper).dialogPowerDeviceChange.show).toBe(true)
        expect(vmAny(wrapper).dialogPowerDeviceChange.device).toBe('Light')
        expect(vmAny(wrapper).dialogPowerDeviceChange.value).toBe('off')
    })

    // ── 12. Fires toggle without confirmation when confirmOnPowerDeviceChange is false ──
    it('fires toggle without confirmation when confirmOnPowerDeviceChange is false', async () => {
        const mockDevices = [{ device: 'Light', status: 'off', locked_while_printing: false, type: 'gpio' }]
        const wrapper = await mountComponent({
            state: {
                gui: {
                    uiSettings: {
                        confirmOnPowerDeviceChange: false,
                    },
                },
            },
            getters: {
                'server/power/getDevices': () => mockDevices,
            },
        })
        await wrapper.setData({ showMenu: true })
        await wrapper.vm.$nextTick()

        // Call changeSwitch — should fire toggle immediately
        vmAny(wrapper).changeSwitch(mockDevices[0], mockDevices[0].status)
        await wrapper.vm.$nextTick()

        // Dialog should NOT be shown
        expect(vmAny(wrapper).dialogPowerDeviceChange.show).toBe(false)

        // Socket emit should have been called directly
        expect(mockSocketEmit).toHaveBeenCalledWith(
            'machine.device_power.on',
            { Light: null },
            { action: 'server/power/responseToggle' }
        )
    })

    // ── 13. Power device toggle emits correct RPC (on → off) ──
    it('power device toggle emits correct RPC for turning off', async () => {
        const mockDevices = [{ device: 'Fan', status: 'on', locked_while_printing: false, type: 'gpio' }]
        const wrapper = await mountComponent({
            getters: {
                'server/power/getDevices': () => mockDevices,
            },
        })

        // Set dialog state as if user clicked an 'on' device
        vmAny(wrapper).dialogPowerDeviceChange.device = 'Fan'
        vmAny(wrapper).dialogPowerDeviceChange.value = 'on'
        vmAny(wrapper).powerDeviceToggle()
        await wrapper.vm.$nextTick()

        expect(mockSocketEmit).toHaveBeenCalledWith(
            'machine.device_power.off',
            { Fan: null },
            { action: 'server/power/responseToggle' }
        )
    })

    // ── 14. Power device toggle emits correct RPC (off → on) ──
    it('power device toggle emits correct RPC for turning on', async () => {
        const mockDevices = [{ device: 'Fan', status: 'off', locked_while_printing: false, type: 'gpio' }]
        const wrapper = await mountComponent({
            getters: {
                'server/power/getDevices': () => mockDevices,
            },
        })

        vmAny(wrapper).dialogPowerDeviceChange.device = 'Fan'
        vmAny(wrapper).dialogPowerDeviceChange.value = 'off'
        vmAny(wrapper).powerDeviceToggle()
        await wrapper.vm.$nextTick()

        expect(mockSocketEmit).toHaveBeenCalledWith(
            'machine.device_power.on',
            { Fan: null },
            { action: 'server/power/responseToggle' }
        )
    })

    // ── 15. Klipper restart when printing shows confirmation dialog ──
    it('shows confirmation dialog when klipper restart triggered while printing', async () => {
        mockPrinterIsPrinting.value = true

        const wrapper = await mountComponent()
        await wrapper.setData({ showMenu: true })
        await wrapper.vm.$nextTick()

        // Call checkDialog with the klipperRestart function
        vmAny(wrapper).checkDialog(vmAny(wrapper).klipperRestart, 'klipper', 'restart')
        await wrapper.vm.$nextTick()

        expect(vmAny(wrapper).dialogConfirmation.show).toBe(true)
        expect(vmAny(wrapper).dialogConfirmation.title).toBeTruthy()
        expect(vmAny(wrapper).dialogConfirmation.description).toBeTruthy()
    })

    // ── 16. Confirmation dialog 'action' executes the stored function ──
    it('executes stored function when confirmation dialog action is triggered', async () => {
        mockPrinterIsPrinting.value = true

        const store = createStoreWithState()
        const dispatchSpy = vi.spyOn(store, 'dispatch')

        const wrapper = mount(TheTopCornerMenu, {
            global: {
                plugins: [store],
                mocks: {
                    $t: mockT,
                },
            },
        })

        // Set up the dialog state
        vmAny(wrapper).checkDialog(vmAny(wrapper).klipperRestart, 'klipper', 'restart')
        await wrapper.vm.$nextTick()

        expect(vmAny(wrapper).dialogConfirmation.show).toBe(true)

        // Execute the dialog action
        vmAny(wrapper).executeDialog()
        await wrapper.vm.$nextTick()

        // The klipperRestart function should have been called
        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'RESTART',
            type: 'command',
        })
        expect(mockSocketEmit).toHaveBeenCalledWith('printer.gcode.script', { script: 'RESTART' })
    })

    // ── 17. Filters hidden services based on hideOtherInstances ──
    it('filters hidden services based on hideOtherInstances', async () => {
        mockHideOtherInstances.value = true
        mockKlipperInstance.value = 'klipper-myprinter'
        mockMoonrakerInstance.value = 'moonraker-myprinter'

        const wrapper = await mountComponent({
            state: {
                server: {
                    system_info: {
                        available_services: ['klipper', 'klipper-myprinter', 'moonraker', 'moonraker-myprinter'],
                    },
                },
            },
        })
        await wrapper.vm.$nextTick()

        // Only klipper-myprinter and moonraker-myprinter should remain
        const services = vmAny(wrapper).services
        expect(services).toContain('klipper-myprinter')
        expect(services).toContain('moonraker-myprinter')
        expect(services).not.toContain('klipper')
        expect(services).not.toContain('moonraker')
    })

    // ── 18. Excludes devices starting with underscore ──
    it('excludes power devices starting with underscore', async () => {
        const mockDevices = [
            { device: 'Light', status: 'on', locked_while_printing: false, type: 'gpio' },
            { device: '_hidden', status: 'off', locked_while_printing: false, type: 'gpio' },
        ]
        const wrapper = await mountComponent({
            getters: {
                'server/power/getDevices': () => mockDevices,
            },
        })
        await wrapper.vm.$nextTick()

        const devices = vmAny(wrapper).powerDevices
        expect(devices.length).toBe(1)
        expect(devices[0].device).toBe('Light')
    })
})
