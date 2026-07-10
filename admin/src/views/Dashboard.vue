<template>
    <v-row>
        <!-- System Overview -->
        <v-col cols="12" md="4">
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="mr-2" color="primary">mdi-information</v-icon>
                    System
                </v-card-title>
                <v-card-text>
                    <v-list density="compact">
                        <v-list-item>
                            <template #prepend><v-icon small>mdi-package-up</v-icon></template>
                            <v-list-item-title>Version</v-list-item-title>
                            <v-list-item-subtitle>{{ status.version || '...' }}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                            <template #prepend><v-icon small>mdi-monitor</v-icon></template>
                            <v-list-item-title>Hostname</v-list-item-title>
                            <v-list-item-subtitle>{{ status.hostname || '...' }}</v-list-item-subtitle>
                        </v-list-item>
                        <v-list-item>
                            <template #prepend><v-icon small>mdi-clock-outline</v-icon></template>
                            <v-list-item-title>Admin Server</v-list-item-title>
                            <v-list-item-subtitle>Port {{ adminPort }}</v-list-item-subtitle>
                        </v-list-item>
                    </v-list>
                </v-card-text>
            </v-card>
        </v-col>

        <!-- Counts -->
        <v-col cols="12" md="4">
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="mr-2" color="primary">mdi-server</v-icon>
                    Instances
                </v-card-title>
                <v-card-text class="text-center">
                    <div class="text-h2 font-weight-bold" :class="instanceCountColor">
                        {{ status.instance_count ?? 0 }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis mt-1">
                        {{ status.instance_count === 1 ? 'instance configured' : 'instances configured' }}
                    </div>
                </v-card-text>
                <v-card-actions class="justify-center pb-4">
                    <v-btn to="/instances" variant="outlined" color="primary" size="small">View Instances</v-btn>
                </v-card-actions>
            </v-card>
        </v-col>

        <!-- Releases -->
        <v-col cols="12" md="4">
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="mr-2" color="primary">mdi-package-variant-closed</v-icon>
                    Releases
                </v-card-title>
                <v-card-text class="text-center">
                    <div class="text-h2 font-weight-bold" :class="releaseCountColor">
                        {{ status.release_count ?? 0 }}
                    </div>
                    <div class="text-body-2 text-medium-emphasis mt-1">
                        {{ status.release_count === 1 ? 'release installed' : 'releases installed' }}
                    </div>
                </v-card-text>
                <v-card-actions class="justify-center pb-4">
                    <v-btn to="/releases" variant="outlined" color="primary" size="small">View Releases</v-btn>
                </v-card-actions>
            </v-card>
        </v-col>

        <!-- All Instances Mini Table -->
        <v-col cols="12">
            <v-card>
                <v-card-title class="d-flex align-center">
                    <v-icon class="mr-2" color="primary">mdi-view-list</v-icon>
                    Instance Overview
                </v-card-title>
                <v-card-text v-if="instances.length === 0" class="text-center text-medium-emphasis pa-6">
                    <v-icon size="48" class="mb-2">mdi-server-off</v-icon>
                    <div>No instances detected</div>
                </v-card-text>
                <v-table v-else>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Port</th>
                            <th>Status</th>
                            <th>Health</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="inst in instances" :key="inst.name">
                            <td>
                                <v-icon size="small" class="mr-1">mdi-server</v-icon>
                                <strong>{{ inst.name }}</strong>
                            </td>
                            <td>
                                <code>{{ inst.moonraker_port }}</code>
                            </td>
                            <td>
                                <v-chip :color="inst.is_running ? 'success' : 'grey'" size="x-small" variant="tonal">
                                    {{ inst.is_running ? 'Running' : 'Stopped' }}
                                </v-chip>
                            </td>
                            <td>
                                <v-chip :color="healthColor(inst)" size="x-small" variant="tonal">
                                    {{ healthLabel(inst) }}
                                </v-chip>
                            </td>
                            <td>
                                <v-btn
                                    v-if="inst.web_port"
                                    :href="`http://${localIP}:${inst.web_port}/`"
                                    target="_blank"
                                    size="x-small"
                                    variant="text"
                                    icon>
                                    <v-icon>mdi-open-in-new</v-icon>
                                    <v-tooltip activator="parent">Open Web UI</v-tooltip>
                                </v-btn>
                            </td>
                        </tr>
                    </tbody>
                </v-table>
            </v-card>
        </v-col>
    </v-row>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { api } from '@/api'

const adminPort = ref(8081)
const localIP = ref('127.0.0.1')

interface Status {
    version: string
    hostname: string
    instance_count: number
    release_count: number
}

interface HealthCheck {
    name: string
    passed: boolean
    detail: string
    optional?: boolean
}

interface InstanceData {
    name: string
    moonraker_port: number
    web_port: number
    is_running: boolean
    health_checks: HealthCheck[]
}

const status = ref<Status>({
    version: '',
    hostname: '',
    instance_count: 0,
    release_count: 0,
})

const instances = ref<InstanceData[]>([])

const instanceCountColor = computed(() => {
    const c = status.value.instance_count ?? 0
    return c > 0 ? 'text-primary' : 'text-grey'
})

const releaseCountColor = computed(() => {
    const c = status.value.release_count ?? 0
    return c > 0 ? 'text-primary' : 'text-grey'
})

function healthColor(inst: InstanceData): string {
    if (!inst.health_checks?.length) return 'grey'
    const allOk = inst.health_checks.every((h) => h.passed)
    return allOk ? 'success' : 'warning'
}

function healthLabel(inst: InstanceData): string {
    if (!inst.health_checks?.length) return 'Unknown'
    const ok = inst.health_checks.filter((h) => h.passed).length
    const total = inst.health_checks.length
    return `${ok}/${total}`
}

onMounted(async () => {
    try {
        const [statusRes, instRes] = await Promise.all([api.get('/api/status'), api.get('/api/instances')])
        status.value = statusRes.data
        instances.value = instRes.data.instances || []
        localIP.value = instRes.data.local_ip || '127.0.0.1'
    } catch {
        // Server not reachable
    }
})
</script>
