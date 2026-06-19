<style scoped>
.settings-dashboard-tab {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: auto;
}

.settings-dashboard-tab__controls {
    flex: 0 0 auto;
}

.settings-dashboard-tab__content {
    flex: 1 1 auto;
}

.dashboard-rows-container :deep(.v-list-item) {
    min-height: 48px;
}
</style>

<template>
    <v-card flat class="settings-dashboard-tab">
        <v-card-text>
            <v-row class="settings-dashboard-tab__controls">
                <v-col class="text-center">
                    <v-btn-toggle v-model="currentViewport" class="mx-auto" mandatory>
                        <v-btn value="mobile">
                            <span class="hidden-sm-and-down">{{ $t('Settings.DashboardTab.Mobile') }}</span>
                            <v-icon class="hidden-sm-and-down ml-2" :icon="mdiCellphone" />
                            <v-icon class="hidden-md-and-up" :icon="mdiCellphone" />
                        </v-btn>

                        <v-btn value="tablet">
                            <span class="hidden-sm-and-down">{{ $t('Settings.DashboardTab.Tablet') }}</span>
                            <v-icon class="hidden-sm-and-down ml-2" :icon="mdiTablet" />
                            <v-icon class="hidden-md-and-up" :icon="mdiTablet" />
                        </v-btn>

                        <v-btn value="desktop">
                            <span class="hidden-sm-and-down">{{ $t('Settings.DashboardTab.Desktop') }}</span>
                            <v-icon class="hidden-sm-and-down ml-2" :icon="mdiMonitorDashboard" />
                            <v-icon class="hidden-md-and-up" :icon="mdiMonitorDashboard" />
                        </v-btn>

                        <v-btn value="widescreen">
                            <span class="hidden-sm-and-down">{{ $t('Settings.DashboardTab.Widescreen') }}</span>
                            <v-icon class="hidden-sm-and-down ml-2" :icon="mdiMonitorScreenshot" />
                            <v-icon class="hidden-md-and-up" :icon="mdiMonitorScreenshot" />
                        </v-btn>
                    </v-btn-toggle>
                </v-col>
            </v-row>
            <v-row class="settings-dashboard-tab__content">
                <v-col class="dashboard-rows-container">
                    <component :is="currentTab"></component>
                </v-col>
            </v-row>
            <v-row>
                <v-col class="text-center py-2">
                    <v-btn color="error" size="small" @click="$emit('resetLayout')">
                        {{ $t('Settings.DashboardTab.ResetLayout') }}
                    </v-btn>
                </v-col>
            </v-row>
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBase } from '@/composables/useBase'
import SettingsDashboardTabMobile from '@/components/settings/Dashboard/Mobile.vue'
import SettingsDashboardTabTablet from '@/components/settings/Dashboard/Tablet.vue'
import SettingsDashboardTabDesktop from '@/components/settings/Dashboard/Desktop.vue'
import SettingsDashboardTabWidescreen from '@/components/settings/Dashboard/Widescreen.vue'
import { mdiCellphone, mdiMonitorScreenshot, mdiMonitorDashboard, mdiTablet } from '@mdi/js'

defineEmits(['resetLayout'])

const { isMobile, isTablet, isDesktop, isWidescreen } = useBase()
const route = useRoute()
const router = useRouter()

const currentViewport = ref('desktop')
const dashboardViewportQueryKey = 'dashboardViewport'

const viewportComponents: Record<string, Component> = {
    mobile: SettingsDashboardTabMobile,
    tablet: SettingsDashboardTabTablet,
    desktop: SettingsDashboardTabDesktop,
    widescreen: SettingsDashboardTabWidescreen,
}

function getDashboardViewportFromQuery(): string | null {
    const queryValue = route.query[dashboardViewportQueryKey]
    const value = Array.isArray(queryValue) ? queryValue[0] : queryValue

    if (typeof value !== 'string') return null
    if (!(value in viewportComponents)) return null

    return value
}

async function updateDashboardViewportQuery(viewport: string | null): Promise<void> {
    const currentQueryViewport = getDashboardViewportFromQuery()
    if (viewport === currentQueryViewport) return

    const query = { ...route.query }

    if (viewport) query[dashboardViewportQueryKey] = viewport
    else delete query[dashboardViewportQueryKey]

    await router.replace({ path: route.path, query, hash: route.hash })
}

onMounted(() => {
    const queryViewport = getDashboardViewportFromQuery()

    if (queryViewport) {
        currentViewport.value = queryViewport
        return
    }

    if (isMobile.value) currentViewport.value = 'mobile'
    else if (isTablet.value) currentViewport.value = 'tablet'
    else if (isDesktop.value) currentViewport.value = 'desktop'
    else if (isWidescreen.value) currentViewport.value = 'widescreen'
    else currentViewport.value = 'desktop'
})

const currentTab = computed(() => viewportComponents[currentViewport.value] ?? SettingsDashboardTabDesktop)

watch(
    () => route.query[dashboardViewportQueryKey],
    () => {
        const queryViewport = getDashboardViewportFromQuery()
        if (queryViewport && currentViewport.value !== queryViewport) currentViewport.value = queryViewport
    }
)

watch(currentViewport, async () => {
    await updateDashboardViewportQuery(currentViewport.value)
})
</script>
