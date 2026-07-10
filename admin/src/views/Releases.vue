<template>
    <v-card>
        <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" color="primary">mdi-package-variant-closed</v-icon>
            Releases
            <v-spacer />
            <v-chip v-if="currentVersion" color="primary" size="small" variant="tonal">
                <v-icon start size="small">mdi-check-decagram</v-icon>
                Active: {{ currentVersion }}
            </v-chip>
        </v-card-title>

        <v-card-text v-if="releases.length === 0" class="text-center pa-6">
            <v-icon size="64" class="mb-2" color="grey">mdi-package-variant-closed-off</v-icon>
            <div class="text-h6">No releases installed</div>
            <div class="text-body-2 text-medium-emphasis mt-1">
                Run the update command to install the latest release.
            </div>
        </v-card-text>

        <v-list v-else lines="two">
            <v-list-item v-for="rel in releases" :key="rel.version" :active="rel.is_active" color="primary">
                <template #prepend>
                    <v-icon :color="rel.is_active ? 'primary' : 'grey'">
                        {{ rel.is_active ? 'mdi-check-decagram' : 'mdi-package-variant-closed' }}
                    </v-icon>
                </template>

                <v-list-item-title>
                    <strong>{{ rel.version }}</strong>
                    <v-chip v-if="rel.is_active" size="x-small" color="primary" class="ml-2" variant="tonal">
                        Active
                    </v-chip>
                </v-list-item-title>

                <v-list-item-subtitle>
                    <span class="text-caption">
                        {{ formatBytes(rel.size_bytes) }} &middot;
                        {{ rel.created_at ? formatDate(rel.created_at) : 'unknown date' }}
                    </span>
                </v-list-item-subtitle>
            </v-list-item>
        </v-list>
    </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/api'

interface ReleaseItem {
    version: string
    is_active: boolean
    size_bytes: number
    created_at: string
}

const releases = ref<ReleaseItem[]>([])
const currentVersion = ref('')

function formatBytes(bytes: number): string {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let i = 0
    let size = bytes
    while (size >= 1024 && i < units.length - 1) {
        size /= 1024
        i++
    }
    return `${size.toFixed(1)} ${units[i]}`
}

function formatDate(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString()
    } catch {
        return iso
    }
}

onMounted(async () => {
    try {
        const res = await api.get('/api/releases')
        currentVersion.value = res.data.current_version || ''
        releases.value = (res.data.releases || []).map((r: any) => ({
            ...r,
            is_active: r.version === currentVersion.value,
        }))
    } catch {
        // server not reachable
    }
})
</script>
