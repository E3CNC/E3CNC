<style scoped>
.cursor--pointer {
    cursor: pointer;
}
</style>

<template v-if="hostStats">
    <div>
        <v-row class="system-load-row py-0 pr-4 flex-nowrap" align="center">
            <v-col class="v-col system-load-row__info pl-6 pr-4">
                <div class="system-host-header">
                    <strong class="system-host-title" @click="hostDetailsDialog = true">Host</strong>
                    <v-tooltip top>
                        <template #activator="{ props: activatorProps }">
                            <span v-if="hostStats.cpuName" class="system-host-chip" v-bind="activatorProps">
                                {{ cpuName }}
                            </span>
                        </template>
                        <span>{{ cpuDesc }}</span>
                    </v-tooltip>
                </div>

                <div class="system-host-meta text-body-2">
                    <div v-if="hostStats.version" class="system-host-meta__item">
                        {{ $t('Machine.SystemPanel.Values.Version', { version: hostStats.version }) }}
                    </div>
                    <div v-if="hostStats.os" class="system-host-meta__item">
                        {{ $t('Machine.SystemPanel.Values.Os', { os: hostStats.os }) }}
                    </div>
                    <div v-if="releaseName" class="system-host-meta__item">
                        {{
                            $t('Machine.SystemPanel.Values.Distro', {
                                name: releaseName,
                                version_id: hostStats.release_info.version_id,
                            })
                        }}
                        <template v-if="hostStats.release_info.codename">
                            ({{ hostStats.release_info.codename }})
                        </template>
                    </div>
                </div>

                <div class="system-host-stats text-body-2">
                    <div class="system-host-stats__item">
                        {{ $t('Machine.SystemPanel.Values.Load', { load: hostStats.load }) }}
                    </div>
                    <div v-if="hostStats.memoryFormat" class="system-host-stats__item">
                        {{ $t('Machine.SystemPanel.Values.Memory', { memory: hostStats.memoryFormat }) }}
                    </div>
                    <div v-if="hostStats.tempSensor" class="system-host-stats__item">
                        <template
                            v-if="
                                hostStats.tempSensor.measured_min_temp !== null &&
                                hostStats.tempSensor.measured_max_temp !== null
                            ">
                            <v-tooltip top>
                                <template #activator="{ props: activatorProps }">
                                    <span v-bind="activatorProps">
                                        {{
                                            $t('Machine.SystemPanel.Values.Temp', {
                                                temp: hostStats.tempSensor.temperature,
                                            })
                                        }}
                                    </span>
                                </template>
                                <span>
                                    {{
                                        $t('Machine.SystemPanel.Values.TempMax', {
                                            temp: hostStats.tempSensor.measured_max_temp,
                                        })
                                    }}
                                    <br />
                                    {{
                                        $t('Machine.SystemPanel.Values.TempMin', {
                                            temp: hostStats.tempSensor.measured_min_temp,
                                        })
                                    }}
                                </span>
                            </v-tooltip>
                        </template>
                        <template v-else>
                            {{
                                $t('Machine.SystemPanel.Values.Temp', {
                                    temp: hostStats.tempSensor.temperature,
                                })
                            }}
                        </template>
                    </div>
                </div>

                <div v-if="networkInterfaces" class="system-host-network text-body-2">
                    <div
                        v-for="(interfaceStats, interfaceName) in networkInterfaces"
                        :key="interfaceName"
                        class="system-host-network__item">
                        <div class="system-host-network__header">
                            <span class="system-host-network__name">{{ interfaceName }}</span>
                            <span v-if="'details' in interfaceStats" class="system-host-network__ip">
                                {{ getIpAddress(interfaceStats.details.ip_addresses) }}
                            </span>
                        </div>
                        <ul class="system-host-network__stats">
                            <li class="system-host-network__stat">
                                {{
                                    $t('Machine.SystemPanel.Values.Bandwidth', {
                                        bandwidth: formatFilesize(interfaceStats.bandwidth),
                                    })
                                }}
                            </li>
                            <li class="system-host-network__stat">
                                {{
                                    $t('Machine.SystemPanel.Values.Received', {
                                        received: formatFilesize(interfaceStats.rx_bytes),
                                    })
                                }}
                            </li>
                            <li class="system-host-network__stat">
                                {{
                                    $t('Machine.SystemPanel.Values.Transmitted', {
                                        transmitted: formatFilesize(interfaceStats.tx_bytes),
                                    })
                                }}
                            </li>
                        </ul>
                    </div>
                </div>
            </v-col>
            <v-col class="system-load-row__gauges v-col-auto px-2">
                <div class="system-load-gauges">
                    <div
                        v-if="cpuUsage !== null"
                        class="system-load-gauge d-flex flex-column align-center justify-center">
                        <v-progress-circular
                            :rotate="-90"
                            :size="55"
                            :width="7"
                            :value="cpuUsage"
                            :color="cpuUsageColor"
                            :aria-label="`${$t('Machine.SystemPanel.Cpu')} ${cpuUsage}%`">
                            {{ cpuUsage }}%
                        </v-progress-circular>
                        <span class="mt-2">{{ $t('Machine.SystemPanel.Cpu') }}</span>
                    </div>
                    <div v-else class="system-load-gauge d-flex flex-column align-center justify-center">
                        <v-progress-circular
                            :rotate="-90"
                            :size="55"
                            :width="7"
                            :value="hostStats.loadPercent"
                            :color="hostStats.loadProgressColor"
                            :aria-label="`${$t('Machine.SystemPanel.Load')} ${hostStats.loadPercent}%`">
                            {{ hostStats.loadPercent }}%
                        </v-progress-circular>
                        <span class="mt-2">{{ $t('Machine.SystemPanel.Load') }}</span>
                    </div>
                    <div
                        v-if="hostStats.memUsage !== null"
                        class="system-load-gauge d-flex flex-column align-center justify-center">
                        <v-progress-circular
                            :rotate="-90"
                            :size="55"
                            :width="7"
                            :value="hostStats.memUsage"
                            :color="hostStats.memUsageColor"
                            :aria-label="`${$t('Machine.SystemPanel.Memory')} ${hostStats.memUsage}%`">
                            {{ hostStats.memUsage }}%
                        </v-progress-circular>
                        <span class="mt-2">{{ $t('Machine.SystemPanel.Memory') }}</span>
                    </div>
                </div>
            </v-col>
        </v-row>
        <v-dialog v-model="hostDetailsDialog" :max-width="600" :max-height="500" scrollable>
            <panel
                :title="$t('Machine.SystemPanel.HostDetails')"
                :icon="mdiTextBoxSearchOutline"
                card-class="machine-systemload-host-details-dialog"
                :margin-bottom="false">
                <template #buttons>
                    <v-btn :icon="mdiCloseThick" rounded="0" @click="hostDetailsDialog = false" />
                </template>
                <v-card-text class="pt-5 px-0">
                    <OverlayScrollbarsComponent style="height: 350px" class="px-6">
                        <template v-if="Object.keys(systemInfo).length">
                            <div v-for="(infoGroup, key, index) of systemInfo" :key="key">
                                <template v-if="key !== 'available_services'">
                                    <v-row :class="index ? 'mt-5' : ''">
                                        <v-col>
                                            <span class="headline">{{ key }}</span>
                                        </v-col>
                                    </v-row>
                                    <div v-for="(value, key2, index2) in infoGroup" :key="key2">
                                        <v-divider v-if="index2" class="my-3"></v-divider>
                                        <v-row>
                                            <v-col>{{ key2 }}</v-col>
                                            <v-col class="text-right">{{ value }}</v-col>
                                        </v-row>
                                    </div>
                                </template>
                            </div>
                        </template>
                        <template v-else>
                            <v-row class="mt-5">
                                <v-col>
                                    <p>{{ $t('Machine.SystemPanel.NoMoreInfos') }}</p>
                                </v-col>
                            </v-row>
                        </template>
                    </OverlayScrollbarsComponent>
                </v-card-text>
            </panel>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStore } from 'vuex'
import Panel from '@/components/ui/Panel.vue'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-vue'
import { formatFilesize } from '@/plugins/helpers'
import { mdiTextBoxSearchOutline, mdiCloseThick } from '@mdi/js'

const store = useStore()

const hostDetailsDialog = ref(false)

const hostStats = computed(() => store.getters['server/getHostStats'] ?? null)

const systemInfo = computed(() => store.state.server?.system_info ?? {})

const releaseName = computed(() => {
    const stats = hostStats.value
    if (!stats) return null
    const name = stats.release_info?.name ?? ''
    if (name.startsWith('#')) return stats.release_info?.id ?? null
    if (name.startsWith('0.')) return null
    return name
})

const cpuUsage = computed(() => store.getters['server/getCpuUsage'] ?? null)

const cpuUsageColor = computed(() => {
    let color = 'primary'
    if (cpuUsage.value > 95) color = 'error'
    else if (cpuUsage.value > 80) color = 'warning'
    return color
})

const networkInterfaces = computed(() => store.getters['server/getNetworkInterfaces'] ?? null)

function getIpAddress(ip_addresses: { family: string; address: string }[]) {
    const ipv4 = ip_addresses.find((address) => address.family === 'ipv4')
    if (ipv4) return ` (${ipv4.address})`
    const ipv6 = ip_addresses.find((address) => address.family === 'ipv6')
    if (ipv6) return ` (${ipv6.address})`
    return null
}

const cpuDesc = computed(() => hostStats.value?.cpuDesc ?? '')

const cpuName = computed(() => {
    const stats = hostStats.value
    if (!stats) return ''
    let output = stats.cpuName
    if (stats.bits) output += `, ${stats.bits}`
    return output
})
</script>

<style scoped>
.system-load-row {
    width: 100%;
}

.system-load-row__info {
    min-width: 0;
}

.system-host-header {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 10px;
}

.system-host-title {
    cursor: pointer;
    font-size: 1rem;
    font-weight: 700;
}

.system-host-chip {
    background: rgba(var(--v-theme-on-surface), 0.08);
    border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    border-radius: 999px;
    color: rgba(var(--v-theme-on-surface), 0.78);
    display: inline-flex;
    font-size: 0.75rem;
    line-height: 1;
    padding: 6px 10px;
}

.system-host-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.system-host-meta__item {
    color: rgba(var(--v-theme-on-surface), 0.88);
    line-height: 1.35;
}

.system-host-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
}

.system-host-stats__item {
    background: rgba(var(--v-theme-on-surface), 0.05);
    border-radius: 10px;
    color: rgba(var(--v-theme-on-surface), 0.92);
    padding: 6px 10px;
    white-space: nowrap;
}

.system-host-network {
    border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 14px;
    padding-top: 12px;
}

.system-host-network__item {
    background: rgba(var(--v-theme-on-surface), 0.035);
    border-radius: 12px;
    padding: 10px 12px;
}

.system-host-network__header {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 6px;
}

.system-host-network__name {
    color: rgb(var(--v-theme-on-surface));
    font-weight: 600;
}

.system-host-network__ip {
    color: rgba(var(--v-theme-on-surface), 0.6);
    font-size: 0.8rem;
}

.system-host-network__stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    list-style: none;
    margin: 0;
    padding: 0;
}

.system-host-network__stat {
    color: rgba(var(--v-theme-on-surface), 0.82);
    white-space: nowrap;
}

.system-load-row__gauges {
    flex: 0 0 auto;
    width: fit-content;
}

.system-load-gauges {
    align-items: center;
    display: inline-flex;
    gap: 10px;
    justify-content: flex-end;
    width: fit-content;
}

.system-load-gauge {
    min-width: 0;
}

@media (max-width: 960px) {
    .system-load-row {
        flex-wrap: wrap;
    }

    .system-load-row__gauges {
        width: 100%;
    }

    .system-load-gauges {
        justify-content: flex-start;
        padding: 0 24px 16px;
    }
}
</style>
