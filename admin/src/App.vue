<template>
    <v-app>
        <v-navigation-drawer permanent width="240">
            <v-list>
                <v-list-item title="E3CNC Admin" subtitle="Dashboard" class="px-4 pt-4">
                    <template #prepend>
                        <v-icon color="primary" size="28">mdi-monitor-dashboard</v-icon>
                    </template>
                </v-list-item>
            </v-list>

            <v-divider class="mx-4 my-2"></v-divider>

            <v-list nav density="compact">
                <v-list-item
                    v-for="item in navItems"
                    :key="item.to"
                    :to="item.to"
                    :prepend-icon="item.icon"
                    :title="item.title"
                    color="primary"
                    exact></v-list-item>
            </v-list>

            <template #append>
                <v-divider class="mx-4 my-2"></v-divider>
                <v-list density="compact">
                    <v-list-item :title="`v${status.version}`" subtitle="E3CNC" class="px-4 py-2">
                        <template #prepend>
                            <v-icon size="small" color="primary">mdi-information</v-icon>
                        </template>
                    </v-list-item>
                </v-list>
            </template>
        </v-navigation-drawer>

        <v-app-bar flat density="comfortable">
            <v-app-bar-title>{{ currentTitle }}</v-app-bar-title>
            <template #append>
                <v-chip v-if="status.instance_count !== undefined" size="small" variant="text">
                    <v-icon start size="small">mdi-server</v-icon>
                    {{ status.instance_count }} instance{{ status.instance_count !== 1 ? 's' : '' }}
                </v-chip>
                <v-chip v-if="status.release_count !== undefined" size="small" variant="text" class="ml-1">
                    <v-icon start size="small">mdi-package-variant-closed</v-icon>
                    {{ status.release_count }} release{{ status.release_count !== 1 ? 's' : '' }}
                </v-chip>
            </template>
        </v-app-bar>

        <v-main>
            <v-container fluid class="pa-4">
                <router-view />
            </v-container>
        </v-main>
    </v-app>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from './api'

const route = useRoute()

interface Status {
    version: string
    hostname: string
    instance_count: number
    release_count: number
}

const status = ref<Status>({
    version: '...',
    hostname: '',
    instance_count: 0,
    release_count: 0,
})

const navItems = [
    { to: '/', title: 'Dashboard', icon: 'mdi-view-dashboard' },
    { to: '/instances', title: 'Instances', icon: 'mdi-server' },
    { to: '/releases', title: 'Releases', icon: 'mdi-package-variant-closed' },
]

const currentTitle = computed(() => {
    const item = navItems.find((n) => n.to === route.path)
    return item?.title ?? 'E3CNC Admin'
})

onMounted(async () => {
    try {
        const res = await api.get('/api/status')
        status.value = res.data
    } catch {
        // Server not reachable — keep defaults
    }
})
</script>

<style>
html {
    overflow-y: auto;
}
.v-navigation-drawer {
    border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
}
</style>
