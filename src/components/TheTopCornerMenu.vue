<template>
    <div>
        <v-menu v-model="showMenu" location="bottom end" :close-on-content-click="false">
            <template #activator="{ props }">
                <v-btn :icon="mdiPowerStandby" rounded="0" v-bind="props" />
            </template>
            <v-list density="compact">
                <!-- E3CNC Instance Info -->
                <v-list-subheader v-if="instanceInfo" class="" style="height: auto">Instance</v-list-subheader>
                <v-list-item v-if="instanceInfo" class="minHeight30 pr-2" density="compact">
                    <template #title>
                        <div class="text-caption">
                            <div class="font-weight-bold">{{ instanceInfo.name }}</div>
                            <div class="text-disabled">Port {{ instanceInfo.port }}</div>
                        </div>
                    </template>
                    <template #append>
                        <v-icon :color="instanceInfo.running ? 'green' : 'red'" size="small">
                            {{ instanceInfo.running ? mdiCheckCircle : mdiAlertCircle }}
                        </v-icon>
                    </template>
                </v-list-item>
                <v-divider v-if="instanceInfo" class="mt-0" />
                <template v-if="klipperState !== 'disconnected'">
                    <v-list-subheader class="" style="height: auto">
                        {{ $t('App.TopCornerMenu.KlipperControl') }}
                    </v-list-subheader>
                    <v-list-item
                        class="minHeight30 pr-2"
                        link
                        @click="checkDialog(klipperRestart, 'klipper', 'restart')">
                        <template #title>{{ $t('App.TopCornerMenu.KlipperRestart') }}</template>
                        <template #append>
                            <div class="my-0 d-flex flex-row" style="min-width: auto">
                                <v-icon class="mr-2" size="small">{{ mdiRestart }}</v-icon>
                            </div>
                        </template>
                    </v-list-item>
                    <v-list-item
                        class="minHeight30 pr-2"
                        link
                        @click="checkDialog(klipperFirmwareRestart, 'klipper', 'firmwareRestart')">
                        <template #title>{{ $t('App.TopCornerMenu.KlipperFirmwareRestart') }}</template>
                        <template #append>
                            <div class="my-0 d-flex flex-row" style="min-width: auto">
                                <v-icon class="mr-2" size="small">{{ mdiRestart }}</v-icon>
                            </div>
                        </template>
                    </v-list-item>
                </template>
                <template v-if="services.length">
                    <v-divider v-if="klipperState !== 'disconnected'" class="mt-0" />
                    <v-list-subheader class="pt-2" style="height: auto">
                        {{ $t('App.TopCornerMenu.ServiceControl') }}
                    </v-list-subheader>
                    <top-corner-menu-service
                        v-for="service in services"
                        :key="service"
                        :service="service"
                        @close-menu="showMenu = false" />
                </template>
                <template v-if="powerDevices.length">
                    <v-divider class="mt-0"></v-divider>
                    <v-list-subheader class="pt-2" style="height: auto">
                        {{ $t('App.TopCornerMenu.PowerDevices') }}
                    </v-list-subheader>
                    <v-list-item
                        v-for="(device, index) in powerDevices"
                        :key="index"
                        class="minHeight30 pr-2"
                        :disabled="
                            device.status === 'error' ||
                            (device.locked_while_printing && ['printing', 'paused'].includes(printer_state))
                        "
                        @click="changeSwitch(device, device.status)">
                        <template #title>{{ device.device }}</template>
                        <template #append>
                            <div class="my-0 d-flex flex-row" style="min-width: auto">
                                <v-icon class="mr-2" :color="device.status === 'on' ? '' : 'disabled'">
                                    {{ device.status === 'on' ? mdiToggleSwitch : mdiToggleSwitchOff }}
                                </v-icon>
                            </div>
                        </template>
                    </v-list-item>
                </template>
                <!-- E3CNC Stack Control -->
                <v-divider class="mt-0"></v-divider>
                <v-list-subheader class="pt-2" style="height: auto">
                    E3CNC
                    <span v-if="instanceInfo?.current_version" class="text-caption text-disabled">
                        {{ instanceInfo.current_version }}
                    </span>
                </v-list-subheader>
                <v-list-item class="minHeight30 pr-2" link :disabled="e3cncUpdating" @click="e3cncUpdate()">
                    <template #title>{{ e3cncUpdating ? 'Updating...' : 'Update Stack' }}</template>
                    <template #append>
                        <v-icon v-if="e3cncUpdating" class="mr-2" size="small" color="primary">
                            {{ mdiLoading }}
                        </v-icon>
                        <v-icon v-else class="mr-2" size="small">{{ mdiPackageUp }}</v-icon>
                    </template>
                </v-list-item>
                <v-list-item class="minHeight30 pr-2" link @click="e3cncRollback()">
                    <template #title>Rollback</template>
                    <template #append>
                        <v-icon class="mr-2" size="small">{{ mdiUndoVariant }}</v-icon>
                    </template>
                </v-list-item>
                <v-divider class="mt-0"></v-divider>
                <v-list-subheader class="pt-2" style="height: auto">
                    {{ $t('App.TopCornerMenu.HostControl') }}
                </v-list-subheader>
                <v-list-item class="minHeight30 pr-2" link @click="checkDialog(hostReboot, 'host', 'reboot')">
                    <template #title>{{ $t('App.TopCornerMenu.Reboot') }}</template>
                    <template #append>
                        <div class="my-0 d-flex flex-row" style="min-width: auto">
                            <v-icon class="mr-2" size="small">{{ mdiPower }}</v-icon>
                        </div>
                    </template>
                </v-list-item>
                <v-list-item class="minHeight30 pr-2" link @click="checkDialog(hostShutdown, 'host', 'shutdown')">
                    <template #title>{{ $t('App.TopCornerMenu.Shutdown') }}</template>
                    <template #append>
                        <div class="my-0 d-flex flex-row" style="min-width: auto">
                            <v-icon class="mr-2" size="small">{{ mdiPower }}</v-icon>
                        </div>
                    </template>
                </v-list-item>
            </v-list>
        </v-menu>
        <confirmation-dialog
            v-model="dialogPowerDeviceChange.show"
            :title="powerDeviceDialogTitle"
            :text="$t('PowerDeviceChangeDialog.AreYouSure')"
            :action-button-text="$t('Buttons.Yes')"
            :cancel-button-text="$t('Buttons.No')"
            @action="powerDeviceToggle" />
        <confirmation-dialog
            v-model="dialogConfirmation.show"
            :title="dialogConfirmation.title"
            :text="dialogConfirmation.description"
            :action-button-text="dialogConfirmation.actionButtonText"
            @action="executeDialog" />

        <!-- E3CNC update overlay -->
        <v-overlay v-model="e3cncUpdating" class="align-center justify-center" persistent>
            <v-card class="pa-6 text-center" elevation="6">
                <v-progress-circular :size="48" :width="4" color="primary" indeterminate />
                <p class="mt-4 mb-0 text-body-2">Updating E3CNC stack...</p>
            </v-card>
        </v-overlay>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useStore } from 'vuex'
import { useI18n } from 'vue-i18n'
import { useBase } from '@/composables/useBase'
import { useServices } from '@/composables/useServices'
import { useSocket } from '@/composables/useSocket'
import { useToast } from 'vue-toast-notification'
import { ServerPowerStateDevice } from '@/store/server/power/types'
import {
    mdiPowerStandby,
    mdiRestart,
    mdiPower,
    mdiToggleSwitch,
    mdiToggleSwitchOff,
    mdiCheckCircle,
    mdiAlertCircle,
    mdiLoading,
    mdiPackageUp,
    mdiUndoVariant,
    mdiRefresh,
} from '@mdi/js'
import TopCornerMenuService from '@/components/ui/TopCornerMenuService.vue'
import ConfirmationDialog from '@/components/dialogs/ConfirmationDialog.vue'

interface instanceInfo {
    name: string
    port: number
    web_root: string
    running: boolean
    current_version?: string
}

const store = useStore()
const { t } = useI18n()
const { klipperState, printer_state, printerIsPrinting, apiUrl } = useBase()
const { hideOtherInstances, klipperInstance, moonrakerInstance } = useServices()
const socket = useSocket()

const showMenu = ref(false)
const instanceInfo = ref<instanceInfo | null>(null)
const e3cncUpdating = ref(false)
const $toast = useToast()

async function e3cncFetchInfo() {
    const url = apiUrl.value + '/machine/e3cnc/info'
    try {
        const response = await fetch(url)
        const data = await response.json()
        if (data?.result?.ok && data?.result?.instances?.length) {
            const running = data.result.instances.find((i: instanceInfo) => i.running)
            const matched = running ?? data.result.instances[0]
            matched.current_version = data.result.current_version
            instanceInfo.value = matched
        }
    } catch {
        // Endpoint not available
    }
}

async function e3cncUpdate() {
    e3cncUpdating.value = true
    try {
        const response = await fetch(apiUrl.value + '/machine/e3cnc/update', { method: 'POST' })
        const data = await response.json()
        if (data?.result?.status === 'started') {
            // Poll for completion — check releases endpoint every 5s
            $toast.success('Update started')
            for (let i = 0; i < 24; i++) {
                // 2 minutes max
                await new Promise((r) => setTimeout(r, 5000))
                try {
                    const info = await fetch(apiUrl.value + '/machine/e3cnc/info')
                    const infoData = await info.json()
                    if (infoData?.result?.ok) {
                        // Update completed — refresh instance info
                        if (infoData.result.instances?.length) {
                            const running = infoData.result.instances.find((i: any) => i.running)
                            const matched = running ?? infoData.result.instances[0]
                            matched.current_version = infoData.result.current_version
                            instanceInfo.value = matched
                        }
                        $toast.success('E3CNC stack updated')
                        e3cncUpdating.value = false
                        showMenu.value = false
                        return
                    }
                } catch {
                    // Moonraker may restart during update — retry
                }
            }
            $toast.error('Update timed out — check ~/printer_data/logs/moonraker.log')
        } else {
            $toast.error('Update failed to start')
        }
    } catch {
        $toast.error('Update request failed')
    }
    e3cncUpdating.value = false
    showMenu.value = false
}

async function e3cncRollback() {
    try {
        const response = await fetch(apiUrl.value + '/machine/e3cnc/rollback', { method: 'POST' })
        const data = await response.json()
        if (data?.result?.ok) {
            await e3cncFetchInfo()
            $toast.success('Rollback successful')
        } else {
            $toast.error('Rollback failed')
        }
    } catch {
        $toast.error('Rollback request failed')
    }
    showMenu.value = false
}

onMounted(async () => {
    const url = apiUrl.value + '/machine/e3cnc/info'
    try {
        const response = await fetch(url)
        const data = await response.json()
        if (data?.result?.ok && data?.result?.instances?.length) {
            // Show the first running instance, or the first instance
            const running = data.result.instances.find((i: instanceInfo) => i.running)
            const matched = running ?? data.result.instances[0]
            matched.current_version = data.result.current_version
            instanceInfo.value = matched
        }
    } catch {
        // Endpoint not available — ignore
    }
})

interface dialogPowerDeviceChange {
    show: boolean
    device: string
    value: string
}

interface dialogConfirmation {
    show: boolean
    serviceName: string | null
    executableFunction: ((serviceName: string) => void) | null
    title: string
    description: string
    actionButtonText: string
}

const dialogPowerDeviceChange = ref<dialogPowerDeviceChange>({
    show: false,
    device: '',
    value: '',
})
const dialogConfirmation = ref<dialogConfirmation>({
    show: false,
    serviceName: null,
    executableFunction: null,
    title: '',
    description: '',
    actionButtonText: '',
})

const services = computed(() => {
    let services =
        store.state.server.system_info?.available_services?.filter((name: string) => name !== 'klipper_mcu') ?? []

    // Always filter to current instance services
    if (klipperInstance.value !== '') {
        services = services.filter(
            (name: string) =>
                (!name.toLowerCase().startsWith('klipper-') && name.toLowerCase() !== 'klipper') ||
                name === klipperInstance.value
        )
    }

    if (moonrakerInstance.value !== '') {
        services = services.filter(
            (name: string) =>
                (!name.toLowerCase().startsWith('moonraker-') && name.toLowerCase() !== 'moonraker') ||
                name === moonrakerInstance.value
        )
    }

    return services.sort()
})

const powerDevices = computed(() => {
    const devices = store.getters['server/power/getDevices'] ?? []
    return devices.filter((device: ServerPowerStateDevice) => !device.device.startsWith('_'))
})

const powerDeviceDialogTitle = computed((): string => {
    return dialogPowerDeviceChange.value.value === 'off'
        ? t('PowerDeviceChangeDialog.TurnDeviceOn', {
              device: dialogPowerDeviceChange.value.device,
          }).toString()
        : t('PowerDeviceChangeDialog.TurnDeviceOff', {
              device: dialogPowerDeviceChange.value.device,
          }).toString()
})

function checkDialog(executableFunction: (serviceName: string) => void, serviceName: string, action: string) {
    if (!printerIsPrinting.value) {
        executableFunction(serviceName)
        return
    }

    dialogConfirmation.value.executableFunction = executableFunction
    dialogConfirmation.value.serviceName = serviceName

    const actionUppercase = action.trim().charAt(0).toUpperCase() + action.trim().slice(1)
    let titleKey = 'App.TopCornerMenu.ConfirmationDialog.Title.Service' + actionUppercase
    let descriptionKey = 'App.TopCornerMenu.ConfirmationDialog.Description.Service' + actionUppercase
    let buttonKey = 'App.TopCornerMenu.' + actionUppercase

    if (serviceName === 'klipper' && ['stop', 'restart', 'firmwareRestart'].includes(action)) {
        titleKey =
            'App.TopCornerMenu.ConfirmationDialog.Title.' +
            (action !== 'stop' ? 'Klipper' : 'Service') +
            actionUppercase
        descriptionKey = 'App.TopCornerMenu.ConfirmationDialog.Description.Klipper' + actionUppercase

        if (action === 'firmwareRestart') buttonKey = 'App.TopCornerMenu.KlipperFirmwareRestart'
    } else if (serviceName === 'host') {
        titleKey = 'App.TopCornerMenu.ConfirmationDialog.Title.Host' + actionUppercase
        descriptionKey = 'App.TopCornerMenu.ConfirmationDialog.Description.Host' + actionUppercase
    }

    dialogConfirmation.value.title = t(titleKey).toString()
    dialogConfirmation.value.description = t(descriptionKey).toString()
    dialogConfirmation.value.actionButtonText = t(buttonKey).toString()
    dialogConfirmation.value.show = true
}

function executeDialog() {
    const serviceName = dialogConfirmation.value.serviceName
    if (serviceName !== null && dialogConfirmation.value.executableFunction !== null) {
        dialogConfirmation.value.executableFunction(serviceName)
    }
}

function klipperRestart() {
    showMenu.value = false
    store.dispatch('server/addEvent', { message: 'RESTART', type: 'command' })
    socket.emit('printer.gcode.script', { script: 'RESTART' })
}

function klipperFirmwareRestart() {
    showMenu.value = false
    store.dispatch('server/addEvent', { message: 'FIRMWARE_RESTART', type: 'command' })
    socket.emit('printer.gcode.script', { script: 'FIRMWARE_RESTART' })
}

function changeSwitch(device: ServerPowerStateDevice, value: string) {
    dialogPowerDeviceChange.value.device = device.device
    dialogPowerDeviceChange.value.value = value

    const confirmOnPowerDeviceChange = store.state.gui.uiSettings.confirmOnPowerDeviceChange
    if (confirmOnPowerDeviceChange) {
        dialogPowerDeviceChange.value.show = true
    } else {
        powerDeviceToggle()
    }
}

function powerDeviceToggle() {
    const rpc = dialogPowerDeviceChange.value.value === 'off' ? 'machine.device_power.on' : 'machine.device_power.off'
    socket.emit(rpc, { [dialogPowerDeviceChange.value.device]: null }, { action: 'server/power/responseToggle' })
}

function hostReboot() {
    showMenu.value = false
    socket.emit('machine.reboot', {})
}

function hostShutdown() {
    showMenu.value = false
    socket.emit('machine.shutdown', {})
}
</script>
