<template>
    <div class="vue-load-image" :style="{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }">
        <template v-if="status === 'loading' || status === 'pending'">
            <slot name="preloader" />
        </template>
        <template v-else-if="status === 'failed'">
            <slot name="error" />
        </template>
        <!-- Once loaded, render the image slot (hidden during preload) -->
        <div v-show="status === 'loaded'" style="display: contents">
            <slot name="image" />
        </div>
        <!-- Detect image load/error via a clone rendered off-screen during preload -->
        <img
            v-if="(status === 'loading' || status === 'pending') && imgSrc"
            :src="imgSrc"
            :crossorigin="imgCrossOrigin"
            style="position: absolute; width: 1px; height: 1px; opacity: 0.01; pointer-events: none"
            @load="onImageLoaded"
            @error="onImageError" />
    </div>
</template>

<script setup lang="ts">
/**
 * Vue 3 replacement for the Vue 2 vue-load-image package.
 *
 * Works by scanning the #image slot content for an <img> element,
 * extracting its src, and preloading it while showing the preloader slot.
 * Once loaded, the #image slot is displayed.
 */
import { ref, useSlots, onMounted, onBeforeUnmount, type VNode } from 'vue'

const slots = useSlots()
const status = ref<'pending' | 'loading' | 'loaded' | 'failed'>('pending')
const imgSrc = ref<string | null>(null)
const imgCrossOrigin = ref<string | null>(null)

function extractSrcFromVNodes(vnodes: VNode[]): { src: string | null; crossOrigin: string | null } {
    for (const vnode of vnodes) {
        if (typeof vnode.type === 'object' && (vnode.type as any).name === 'VueLoadImage') continue
        if (vnode.type === 'img') {
            const src = (vnode.props?.src as string) ?? (vnode.props?.['data-src'] as string) ?? null
            const crossOrigin = (vnode.props?.crossorigin as string) ?? (vnode.props?.crossOrigin as string) ?? null
            if (src) return { src, crossOrigin }
        }
        if (vnode.children && Array.isArray(vnode.children)) {
            const found = extractSrcFromVNodes(vnode.children as VNode[])
            if (found.src) return found
        }
    }
    return { src: null, crossOrigin: null }
}

function startLoading() {
    const imageVNodes = slots.image?.()
    if (!imageVNodes) {
        status.value = 'pending'
        return
    }
    const { src, crossOrigin } = extractSrcFromVNodes(imageVNodes)
    if (src) {
        imgSrc.value = src
        imgCrossOrigin.value = crossOrigin
        status.value = 'loading'
    } else {
        // No image found in slot — show preloader
        status.value = 'pending'
    }
}

function onImageLoaded() {
    status.value = 'loaded'
}

function onImageError() {
    status.value = 'failed'
}

onMounted(() => {
    // Delay to let the slot content render
    requestAnimationFrame(startLoading)
})
</script>
