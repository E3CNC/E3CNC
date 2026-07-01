<template>
    <div>
        <v-btn :icon="mdiCogs" rounded="0" @click="openSettingsMenu" />
        <v-dialog
            v-model="showSettings"
            width="900"
            persistent
            :fullscreen="isMobile"
            scrollable
            :aria-label="$t('Settings.InterfaceSettings')"
            @keydown.esc="closeSettingsMenu">
            <v-card class="settings-menu-dialog">
                <v-toolbar flat density="compact" class="settings-menu-toolbar">
                    <v-icon start :icon="mdiCogs" />
                    <v-toolbar-title>{{ $t('Settings.InterfaceSettings') }}</v-toolbar-title>
                    <v-spacer />
                    <v-btn :icon="mdiCloseThick" rounded="0" @click="closeSettingsMenu" />
                </v-toolbar>
                <v-card-text>
                    <template v-if="isMobile">
                        <v-tabs v-model="activeTab" :center-active="true" :show-arrows="true">
                            <v-tab
                                v-for="(tab, index) of tabTitles"
                                :key="index"
                                :value="tab.name"
                                class="justify-start">
                                <v-icon start>{{ tab.icon }}</v-icon>
                                {{ tab.title }}
                            </v-tab>
                        </v-tabs>
                    </template>
                    <v-row class="flex-row flex-nowrap ma-0 settings-contentrow">
                        <v-col v-if="!isMobile" cols="auto" class="pr-0 settings-contentcol">
                            <OverlayScrollbarsComponent ref="settingsTabsScroll" class="settings-tabs-bar">
                                <v-tabs v-model="activeTab" direction="vertical">
                                    <v-tab
                                        v-for="(tab, index) of tabTitles"
                                        :key="index"
                                        :value="tab.name"
                                        class="justify-start"
                                        style="width: 200px">
                                        <v-icon start>{{ tab.icon }}</v-icon>
                                        <span class="text-truncate">{{ tab.title }}</span>
                                    </v-tab>
                                </v-tabs>
                            </OverlayScrollbarsComponent>
                        </v-col>
                        <v-col :class="isMobile ? '' : 'pl-0'" style="min-width: 0" class="settings-contentcol">
                            <OverlayScrollbarsComponent
                                ref="settingsScroll"
                                class="settings-tabs"
                                :options="{ overflowBehavior: { x: 'hidden' } }"
                                @focusin.capture="scrollFocusedSettingsElementIntoView">
                                <component
                                    :is="tabComponents[activeTab]"
                                    @scroll-to-top="scrollToTop"
                                    @reset-layout="resetDashboardLayout" />
                            </OverlayScrollbarsComponent>
                        </v-col>
                    </v-row>
                </v-card-text>
            </v-card>
        </v-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { Component } from 'vue'
import { useStore } from 'vuex'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useBase } from '@/composables/useBase'
import SettingsGeneralTab from '@/components/settings/SettingsGeneralTab.vue'
import SettingsWebcamsTab from '@/components/settings/SettingsWebcamsTab.vue'
import SettingsMacrosTab from '@/components/settings/SettingsMacrosTab.vue'
import SettingsConsoleTab from '@/components/settings/SettingsConsoleTab.vue'
import SettingsRemotePrintersTab from '@/components/settings/SettingsRemotePrintersTab.vue'
import SettingsUiSettingsTab from '@/components/settings/SettingsUiSettingsTab.vue'
import SettingsDashboardTab from '@/components/settings/SettingsDashboardTab.vue'
import SettingsGCodeViewerTab from '@/components/settings/SettingsGCodeViewerTab.vue'
import SettingsEditorTab from '@/components/settings/SettingsEditorTab.vue'
import SettingsNavigationTab from '@/components/settings/SettingsNavigationTab.vue'
import SettingsMiscellaneousTab from '@/components/settings/SettingsMiscellaneousTab.vue'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-vue'
import {
    mdiCloseThick,
    mdiCodeTags,
    mdiCog,
    mdiCogs,
    mdiConsoleLine,
    mdiDipSwitch,
    mdiFileDocumentEditOutline,
    mdiMonitorDashboard,
    mdiPalette,
    mdiPrinter3d,
    mdiVideo3d,
    mdiWebcam,
    mdiMenu,
} from '@mdi/js'

const { t } = useI18n()
const { isMobile } = useBase()
const store = useStore()
const route = useRoute()
const router = useRouter()

const settingsScroll = ref<{
    osInstance?: () => {
        elements: () => { viewport?: HTMLElement | null }
    }
} | null>(null)
const settingsTabsScroll = ref<{
    osInstance?: () => {
        elements: () => { viewport?: HTMLElement | null }
    }
} | null>(null)
const showSettings = ref(false)
const activeTab = ref('general')
const settingsMenuQueryKey = 'settingsMenu'
const nestedSettingsQueryKeysByTab: Record<string, string[]> = {
    dashboard: ['dashboardViewport'],
    macros: ['macrosMode'],
    miscellaneous: ['miscPage', 'miscType', 'miscName'],
}

const tabComponents: Record<string, Component> = {
    general: SettingsGeneralTab,
    'ui-settings': SettingsUiSettingsTab,
    dashboard: SettingsDashboardTab,
    webcams: SettingsWebcamsTab,
    macros: SettingsMacrosTab,
    console: SettingsConsoleTab,
    'remote-printers': SettingsRemotePrintersTab,
    'g-code-viewer': SettingsGCodeViewerTab,
    editor: SettingsEditorTab,
    miscellaneous: SettingsMiscellaneousTab,
    navigation: SettingsNavigationTab,
}

const tabTitles = computed(() => {
    const tabs = [
        { icon: mdiCog, name: 'general', title: t('Settings.GeneralTab.General') },
        { icon: mdiPalette, name: 'ui-settings', title: t('Settings.UiSettingsTab.UiSettings') },
        { icon: mdiMonitorDashboard, name: 'dashboard', title: t('Settings.DashboardTab.Dashboard') },
        { icon: mdiWebcam, name: 'webcams', title: t('Settings.WebcamsTab.Webcams') },
        { icon: mdiCodeTags, name: 'macros', title: t('Settings.MacrosTab.Macros') },
        { icon: mdiConsoleLine, name: 'console', title: t('Settings.ConsoleTab.Console') },
        { icon: mdiPrinter3d, name: 'remote-printers', title: t('Settings.RemotePrintersTab.RemotePrinters') },
        { icon: mdiVideo3d, name: 'g-code-viewer', title: t('Settings.GCodeViewerTab.GCodeViewer') },
        { icon: mdiFileDocumentEditOutline, name: 'editor', title: t('Settings.EditorTab.Editor') },
        { icon: mdiDipSwitch, name: 'miscellaneous', title: t('Settings.MiscellaneousTab.Miscellaneous') },
        { icon: mdiMenu, name: 'navigation', title: t('Settings.NavigationTab.Navigation') },
    ]

    return tabs.sort((a, b) => {
        if (a.name === 'general') return -1
        if (b.name === 'general') return 1

        const stringA = a.title.toString().toLowerCase()
        const stringB = b.title.toString().toLowerCase()

        if (stringA < stringB) return -1
        if (stringA > stringB) return 1

        return 0
    })
})

function getSettingsMenuTabFromQuery(): string | null {
    const queryValue = route.query[settingsMenuQueryKey]
    const value = Array.isArray(queryValue) ? queryValue[0] : queryValue

    if (typeof value !== 'string') return null
    if (!(value in tabComponents)) return null

    return value
}

async function updateSettingsMenuQuery(tab: string | null): Promise<void> {
    const query = { ...route.query }
    const allowedNestedKeys = new Set(tab ? (nestedSettingsQueryKeysByTab[tab] ?? []) : [])

    Object.values(nestedSettingsQueryKeysByTab)
        .flat()
        .forEach((key) => {
            if (!allowedNestedKeys.has(key)) delete query[key]
        })

    const currentTab = getSettingsMenuTabFromQuery()
    const currentQuery = { ...route.query }

    if (tab) currentQuery[settingsMenuQueryKey] = tab
    else delete currentQuery[settingsMenuQueryKey]

    Object.values(nestedSettingsQueryKeysByTab)
        .flat()
        .forEach((key) => {
            if (!allowedNestedKeys.has(key)) delete currentQuery[key]
        })

    if (tab) query[settingsMenuQueryKey] = tab
    else delete query[settingsMenuQueryKey]

    if (JSON.stringify(query) === JSON.stringify(currentQuery) && tab === currentTab) return

    await router.replace({ path: route.path, query, hash: route.hash })
}

function openSettingsMenu(): void {
    showSettings.value = true
}

function closeSettingsMenu(): void {
    showSettings.value = false
}

watch(
    () => route.query[settingsMenuQueryKey],
    () => {
        const tab = getSettingsMenuTabFromQuery()

        if (tab) {
            if (activeTab.value !== tab) activeTab.value = tab
            if (!showSettings.value) showSettings.value = true
            return
        }

        if (showSettings.value) showSettings.value = false
    },
    { immediate: true }
)

watch(activeTab, async () => {
    if (!showSettings.value) return

    await updateSettingsMenuQuery(activeTab.value)
})

watch(showSettings, async (isOpen) => {
    if (isOpen) {
        await updateSettingsMenuQuery(activeTab.value)
        await nextTick()
        scrollActiveTabIntoView()
        scrollSelectedSettingsElementIntoView()
        return
    }

    await updateSettingsMenuQuery(null)
})

watch(activeTab, async () => {
    await nextTick()
    scrollToTop()
    scrollActiveTabIntoView()
    scrollSelectedSettingsElementIntoView()
})

function scrollToTop() {
    const viewport = (settingsScroll.value as any)?.osInstance()?.elements()?.viewport

    if (viewport) viewport.scrollTop = 0
}

function scrollActiveTabIntoView() {
    const viewport = (settingsTabsScroll.value as any)?.osInstance()?.elements()?.viewport
    const activeTabButton = viewport?.querySelector('.v-tab-item--selected') as HTMLElement | null

    activeTabButton?.scrollIntoView({ block: 'nearest' })
}

function scrollSelectedSettingsElementIntoView() {
    requestAnimationFrame(() => {
        const viewport = (settingsScroll.value as any)?.osInstance()?.elements()?.viewport
        if (!viewport) return

        const selectedElements = Array.from(
            viewport.querySelectorAll(
                [
                    '.v-btn--active',
                    '.v-tab--selected',
                    '.v-tab-item--selected',
                    '.v-list-item--active',
                    '.v-selection-control--dirty',
                    '[aria-selected="true"]',
                    ':focus-visible',
                ].join(', ')
            )
        ) as HTMLElement[]

        const viewportRect = viewport.getBoundingClientRect()
        const selectedElement =
            selectedElements.find((element) => {
                const rect = element.getBoundingClientRect()
                return rect.top < viewportRect.top || rect.bottom > viewportRect.bottom
            }) ?? selectedElements[0]

        selectedElement?.scrollIntoView({ block: 'nearest' })
    })
}

function scrollFocusedSettingsElementIntoView(event: FocusEvent) {
    const target = event.target as HTMLElement | null
    if (!target) return

    requestAnimationFrame(() => {
        target.scrollIntoView({ block: 'nearest' })
    })
}

function resetDashboardLayout() {
    const viewport =
        (Array.isArray(route.query.dashboardViewport)
            ? route.query.dashboardViewport[0]
            : route.query.dashboardViewport) || 'desktop'
    if (viewport === 'mobile') {
        store.dispatch('gui/resetLayout', 'mobileLayout')
    } else {
        store.dispatch('gui/resetLayout', `${viewport}Layout1`)
        store.dispatch('gui/resetLayout', `${viewport}Layout2`)
        if (viewport === 'widescreen') store.dispatch('gui/resetLayout', 'widescreenLayout3')
    }
}
</script>

<style scoped>
.settings-tabs {
    width: 100%;
}

.settings-tabs :deep(.os-content) {
    padding-bottom: 24px;
}

.settings-tabs-bar {
    border-right: 1px solid rgba(var(--v-theme-on-surface), 0.12);
    width: 100%;
    height: 100%;
}

.settings-tabs-bar :deep(.v-tab) {
    justify-content: flex-start;
    min-height: 40px;
    padding-inline: 14px 12px;
}

.settings-tabs-bar :deep(.v-tab .v-icon) {
    margin-inline-end: 8px;
}

.settings-tabs-bar :deep(.v-tab__slider) {
    background: transparent;
}

.settings-tabs-bar :deep(.v-tab--selected .v-tab__slider),
.settings-tabs-bar :deep(.v-tab-item--selected .v-tab__slider) {
    background: rgb(var(--v-theme-primary));
    opacity: 1;
}

.settings-contentrow {
    height: clamp(320px, calc(var(--app-height) - 191px), 500px);
}

.settings-contentcol {
    display: flex;
    flex-direction: column;
    min-height: 0;
}

.settings-contentcol > .settings-tabs,
.settings-contentcol > .settings-tabs-bar {
    flex: 1 1 auto;
    min-height: 0;
    max-height: 100%;
}

:deep(.settings-menu-toolbar .v-toolbar__content) {
    padding-left: 12px;
}
</style>

<style>
.settings-tabs .v-select__selections input {
    width: 100px;
}
</style>
