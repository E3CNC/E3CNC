<template>
    <div>
        <v-card flat>
            <v-card-text>
                <settings-row :title="$t('Settings.GeneralTab.PrinterName')">
                    <v-text-field
                        v-model="printerName"
                        hide-details
                        variant="outlined"
                        density="compact"></v-text-field>
                </settings-row>
                <v-divider class="my-2" />
                <settings-row :title="$t('Settings.GeneralTab.Language')">
                    <v-select
                        v-model="currentLanguage"
                        :items="availableLanguages"
                        item-title="text"
                        item-value="value"
                        hide-details
                        variant="outlined"
                        density="compact" />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row :title="$t('Settings.GeneralTab.DateFormat')">
                    <v-select
                        v-model="dateFormat"
                        :items="dateFormatItems"
                        item-title="text"
                        item-value="value"
                        hide-details
                        variant="outlined"
                        density="compact" />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row :title="$t('Settings.GeneralTab.TimeFormat')">
                    <v-select
                        v-model="timeFormat"
                        :items="timeFormatItems"
                        item-title="text"
                        item-value="value"
                        hide-details
                        variant="outlined"
                        density="compact" />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row
                    :title="$t('Settings.GeneralTab.CalcPrintProgress')"
                    :sub-title="$t('Settings.GeneralTab.CalcPrintProgressDescription')">
                    <v-select
                        v-model="calcPrintProgress"
                        :items="calcPrintProgressItems"
                        item-title="text"
                        item-value="value"
                        hide-details
                        density="compact"
                        variant="outlined" />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row
                    :title="$t('Settings.GeneralTab.CalcEtaTime')"
                    :sub-title="$t('Settings.GeneralTab.CalcEtaTimeDescription')">
                    <v-select
                        v-model="calcEtaTime"
                        :items="calcEtaTimeItems"
                        item-title="text"
                        item-value="value"
                        multiple
                        hide-details
                        density="compact"
                        variant="outlined" />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row :title="$t('Settings.GeneralTab.MainsailSettingsMoonrakerDb')" :dynamic-slot-width="true">
                    <settings-general-tab-backup-database />
                    <settings-general-tab-restore-database />
                </settings-row>
                <v-divider class="my-2" />
                <settings-row :title="$t('Settings.GeneralTab.FactoryReset')" :dynamic-slot-width="true">
                    <settings-general-tab-reset-database />
                </settings-row>
            </v-card-text>
        </v-card>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStore } from 'vuex'
import { useI18n } from 'vue-i18n'
import { useBase } from '@/composables/useBase'
import { useSettingsDatabase } from '@/composables/useSettingsDatabase'
import SettingsRow from '@/components/settings/SettingsRow.vue'
import SettingsGeneralTabBackupDatabase from '@/components/settings/General/GeneralBackup.vue'
import SettingsGeneralTabRestoreDatabase from '@/components/settings/General/GeneralRestore.vue'
import SettingsGeneralTabResetDatabase from '@/components/settings/General/GeneralReset.vue'

const store = useStore()
const { t } = useI18n()
const { browserLocale, formatDate } = useBase()
useSettingsDatabase()

const availableLanguages = ref<{ text: string; value: string }[]>([])

async function loadLanguages() {
    const locales = import.meta.glob('../../locales/*.json', { import: 'default' })
    const languages: { text: string; value: string }[] = []

    for (const file in locales) {
        const langKey = file.slice(file.lastIndexOf('/') + 1, file.lastIndexOf('.'))
        const locale = (await locales[file]()) as { title: string }

        languages.push({
            text: locale.title,
            value: langKey,
        })
    }

    availableLanguages.value = languages.sort((a, b) => a.text.localeCompare(b.text))
}

loadLanguages()

const printerName = computed({
    get: () => store.state.gui.general.printername,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'general.printername', value: newVal })
    },
})

const currentLanguage = computed({
    get: () => store.state.gui.general.language,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'general.language', value: newVal })
    },
})

const dateFormat = computed({
    get: () => store.state.gui.general.dateFormat,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'general.dateFormat', value: newVal })
    },
})

const dateFormatItems = computed(() => {
    const date = new Date()
    const availableFormats = [
        null,
        'short',
        'iso',
        'mm-dd-yyyy',
        'mm-dd-yy',
        'm-d-yyyy',
        'm-d-yy',
        'dd-mm-yyyy',
        'dd-mm-yy',
        'dd.mm.yyyy',
        'dd.mm.yy',
        'd.m.yyyy',
        'd.m.yy',
        'yyyy. mm. dd.',
        'yy. mm. dd.',
    ]

    return availableFormats.map((format) => {
        let name = format
        if (name === null) name = 'Browser'
        else if (['short', 'iso'].includes(name)) name = name.toUpperCase()

        let example = formatDate(date, format)
        if (format === null) example = date.toLocaleDateString(browserLocale.value, { dateStyle: 'medium' })

        return {
            value: format,
            text: `${name} (${example})`,
        }
    })
})

const timeFormat = computed({
    get: () => store.state.gui.general.timeFormat,
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'general.timeFormat', value: newVal })
    },
})

const timeFormatItems = computed(() => {
    const date = new Date()
    const userLocale = navigator.languages && navigator.languages.length ? navigator.languages[0] : navigator.language

    return [
        { value: null, text: `Browser (${date.toLocaleTimeString(userLocale, { timeStyle: 'short' })})` },
        {
            value: '24hours',
            text: t('Settings.GeneralTab.24hours', {
                time: date.toLocaleTimeString(userLocale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
            }),
        },
        {
            value: '12hours',
            text: t('Settings.GeneralTab.12hours', {
                time: date.toLocaleTimeString(userLocale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h12' }),
            }),
        },
    ]
})

const allowedCalcPrintProgressValues = ['file-relative', 'file-absolute', 'slicer'] as const
const allowedCalcEtaValues = ['file', 'slicer'] as const

const calcPrintProgressItems = computed(() => [
    { value: 'file-relative', text: t('Settings.GeneralTab.CalcPrintProgressItems.FileRelative') },
    { value: 'file-absolute', text: t('Settings.GeneralTab.CalcPrintProgressItems.FileAbsolute') },
    { value: 'slicer', text: t('Settings.GeneralTab.CalcPrintProgressItems.Slicer') },
])

const calcPrintProgress = computed({
    get: () =>
        allowedCalcPrintProgressValues.includes(store.state.gui.general.calcPrintProgress)
            ? store.state.gui.general.calcPrintProgress
            : 'file-relative',
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'general.calcPrintProgress', value: newVal })
    },
})

const calcEtaTimeItems = computed(() => [
    { value: 'file', text: t('Settings.GeneralTab.EstimateValues.File') },
    { value: 'slicer', text: t('Settings.GeneralTab.EstimateValues.Slicer') },
])

const calcEtaTime = computed({
    get: () =>
        (store.state.gui.general.calcEtaTime ?? []).filter((value: string) =>
            allowedCalcEtaValues.includes(value as (typeof allowedCalcEtaValues)[number])
        ),
    set: (newVal) => {
        store.dispatch('gui/saveSetting', { name: 'general.calcEtaTime', value: newVal })
    },
})

watch(
    () => store.state.gui.general.calcPrintProgress,
    (value) => {
        if (!allowedCalcPrintProgressValues.includes(value)) {
            store.dispatch('gui/saveSetting', { name: 'general.calcPrintProgress', value: 'file-relative' })
        }
    },
    { immediate: true }
)

watch(
    () => store.state.gui.general.calcEtaTime,
    (value) => {
        const normalized = (value ?? []).filter((item: string) =>
            allowedCalcEtaValues.includes(item as (typeof allowedCalcEtaValues)[number])
        )

        if (JSON.stringify(value ?? []) !== JSON.stringify(normalized)) {
            store.dispatch('gui/saveSetting', { name: 'general.calcEtaTime', value: normalized })
        }
    },
    { immediate: true }
)
</script>
