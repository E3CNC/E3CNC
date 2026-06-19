<style scoped></style>

<template>
    <v-menu bottom :offset-x="true">
        <template #activator="{ props }">
            <v-icon class="nav-arrow right" v-bind="props">{{ mdiChevronDown }}</v-icon>
        </template>

        <v-list density="compact">
            <v-list-item
                v-for="printer in printers"
                :key="printer._namespace"
                lines="two"
                :disabled="!printer.socket.isConnected"
                link
                :title="getPrinterName(printer._namespace)"
                :subtitle="getPrinterDescription(printer)"
                @click="changePrinter(printer)"></v-list-item>
        </v-list>
    </v-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import type { FarmPrinterState } from '@/store/farm/printer/types'
import { mdiChevronDown } from '@mdi/js'

const store = useStore()
useBase()

const printers = computed(() => store.getters['farm/getPrinters'])

function getPrinterName(namespace: string) {
    return store.getters['farm/' + namespace + '/getPrinterName']
}

function getPrinterDescription(printer: FarmPrinterState) {
    return store.getters['farm/' + printer._namespace + '/getStatus']
}

function changePrinter(printer: FarmPrinterState) {
    if (printer.socket.isConnected) {
        store.dispatch('changePrinter', { printer: printer._namespace })
    }
}
</script>
