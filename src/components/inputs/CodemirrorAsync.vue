<template>
    <component :is="CodemirrorComp" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { shallowRef, onMounted } from 'vue'

const CodemirrorComp = shallowRef<unknown>(null)

onMounted(async () => {
    const mod = await import('@/components/inputs/Codemirror.vue')
    CodemirrorComp.value = mod.default
})
</script>
