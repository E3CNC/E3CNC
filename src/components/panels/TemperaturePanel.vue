<template>
    <panel
        v-if="klipperReadyForGui"
        :icon="mdiThermometerLines"
        :title="$t('Panels.TemperaturePanel.Headline')"
        :collapsible="true"
        card-class="temperature-panel">
        <template #buttons>
            <temperature-panel-settings />
        </template>
        <v-card-text class="pa-0">
            <temperature-panel-list />
            <template v-if="boolTempchart">
                <v-divider class="my-0" />
                <temp-chart />
            </template>
        </v-card-text>
    </panel>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import { useControl } from '@/composables/useControl'
import TempChart from '@/components/charts/TempChart.vue'
import Panel from '@/components/ui/Panel.vue'
import { mdiThermometerLines } from '@mdi/js'

const { klipperReadyForGui } = useBase()
useControl()

const store = useStore()

const boolTempchart = computed(() => store.state.gui.view.tempchart.boolTempchart ?? false)
</script>
