<template>
    <v-card class="gcode-back-card" @click="goBack">
        <div class="gcode-back-card__icon">
            <v-icon size="48">{{ mdiArrowLeft }}</v-icon>
        </div>
        <div class="gcode-back-card__label">..</div>
        <div class="gcode-back-card__meta">{{ parentName }}</div>
    </v-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGcodeFiles } from '@/composables/useGcodeFiles'
import { mdiArrowLeft } from '@mdi/js'

const { currentPath, setCurrentPath } = useGcodeFiles()

const parentName = computed(() => {
    if (!currentPath.value) return ''
    const parts = currentPath.value.split('/').filter(Boolean)
    if (parts.length === 0) return ''
    return parts[parts.length - 1]
})

function goBack() {
    const parts = currentPath.value.split('/').filter(Boolean)
    parts.pop()
    setCurrentPath(parts.length ? '/' + parts.join('/') : '')
}
</script>

<style scoped>
.gcode-back-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 16px 12px;
    border-radius: 4px;
    background: transparent;
    border: 1px dashed rgba(var(--v-theme-on-surface), 0.16);
    cursor: pointer;
    min-height: 168px;
    transition: border-color 200ms cubic-bezier(0.25, 1, 0.5, 1);
}

.gcode-back-card:hover {
    border-color: rgba(var(--v-theme-primary), 0.4);
}

.gcode-back-card__icon {
    width: 72px;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: rgba(var(--v-theme-on-surface), 0.04);
}

.gcode-back-card__label {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(var(--v-theme-on-surface), 0.7);
}

.gcode-back-card__meta {
    font-size: 0.75rem;
    color: rgba(var(--v-theme-on-surface), 0.5);
}
</style>
