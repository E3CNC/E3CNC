<template>
    <v-icon v-if="item.isDirectory">{{ mdiFolder }}</v-icon>
    <v-tooltip
        v-else-if="showTooltip"
        location="top"
        content-class="tooltip__content-opacity1"
        :color="bigThumbnailTooltipColor"
        :disabled="!bigThumbnailUrl || bigThumbnailFailed">
        <template #activator="{ props: activatorProps }">
            <img
                :src="displayThumbnailUrl"
                :alt="item.filename"
                :class="thumbnailClass"
                v-bind="activatorProps"
                @error="handleDisplayError" />
        </template>
        <span v-if="bigThumbnailUrl && !bigThumbnailFailed">
            <img :src="bigThumbnailUrl" width="250" :alt="item.filename" @error="bigThumbnailFailed = true" />
        </span>
    </v-tooltip>
    <img
        v-else-if="displayThumbnailUrl && !displayThumbnailFailed"
        :src="displayThumbnailUrl"
        :alt="item.filename"
        :class="thumbnailClass"
        @error="handleDisplayError" />
    <v-icon v-else :class="thumbnailFallbackClass">{{ mdiFile }}</v-icon>
</template>
<script setup lang="ts">
import { computed, ref, watch, withDefaults } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import type { FileStateGcodefile } from '@/store/files/types'
import { mdiFile, mdiFolder } from '@mdi/js'
import { defaultBigThumbnailBackground, thumbnailBigMin, thumbnailSmallMax, thumbnailSmallMin } from '@/store/variables'
import { escapePath } from '@/plugins/helpers'

const props = withDefaults(
    defineProps<{
        item: FileStateGcodefile
        variant?: 'icon' | 'card'
    }>(),
    {
        variant: 'icon',
    }
)

const store = useStore()
const { apiUrl } = useBase()

const smallThumbnailFailed = ref(false)
const bigThumbnailFailed = ref(false)

const bigThumbnailBackground = computed(
    () => store.state.gui.uiSettings.bigThumbnailBackground ?? defaultBigThumbnailBackground
)

const bigThumbnailTooltipColor = computed(() => {
    if (defaultBigThumbnailBackground.toLowerCase() === bigThumbnailBackground.value.toLowerCase()) {
        return undefined
    }
    return bigThumbnailBackground.value
})

const fileTimestamp = computed(() =>
    props.item.modified && typeof props.item.modified.getTime === 'function' ? props.item.modified.getTime() : 0
)

const thumbnails = computed(() => props.item.thumbnails ?? [])

const fullFilename = computed(() => props.item.full_filename ?? props.item.filename)

const subdirectory = computed(() => {
    if (!fullFilename.value.includes('/')) return null
    return escapePath(fullFilename.value.substring(0, fullFilename.value.lastIndexOf('/')))
})

const smallThumbnail = computed(() =>
    thumbnails.value.find(
        (thumbnail) =>
            thumbnail.width >= thumbnailSmallMin &&
            thumbnail.width <= thumbnailSmallMax &&
            thumbnail.height >= thumbnailSmallMin &&
            thumbnail.height <= thumbnailSmallMax
    )
)

const smallThumbnailUrl = computed(() => {
    if (smallThumbnail.value === undefined || !('relative_path' in smallThumbnail.value)) return null
    return buildUrl(smallThumbnail.value.relative_path)
})

const bigThumbnail = computed(() => thumbnails.value.find((thumbnail) => thumbnail.width >= thumbnailBigMin))

const bigThumbnailUrl = computed(() => {
    if (bigThumbnail.value === undefined || !('relative_path' in bigThumbnail.value)) return null
    return buildUrl(bigThumbnail.value.relative_path)
})

const displayThumbnailUrl = computed(() =>
    props.variant === 'card' ? (bigThumbnailUrl.value ?? smallThumbnailUrl.value) : smallThumbnailUrl.value
)

const displayThumbnailFailed = computed(() =>
    props.variant === 'card' ? bigThumbnailFailed.value && smallThumbnailFailed.value : smallThumbnailFailed.value
)

const showTooltip = computed(() => props.variant === 'icon' && !!smallThumbnailUrl.value && !smallThumbnailFailed.value)

const thumbnailClass = computed(() => [
    'gcode-thumbnail',
    props.variant === 'card' ? 'gcode-thumbnail--card' : 'gcode-thumbnail--icon',
])

const thumbnailFallbackClass = computed(() => [
    props.variant === 'card' ? 'gcode-thumbnail-fallback gcode-thumbnail-fallback--card' : '',
])

watch([smallThumbnailUrl, bigThumbnailUrl], () => {
    smallThumbnailFailed.value = false
    bigThumbnailFailed.value = false
})

function handleDisplayError() {
    if (props.variant === 'card') {
        if (displayThumbnailUrl.value === bigThumbnailUrl.value && bigThumbnailUrl.value && !bigThumbnailFailed.value) {
            bigThumbnailFailed.value = true
            return
        }
        smallThumbnailFailed.value = true
        return
    }
    smallThumbnailFailed.value = true
}

function buildUrl(relativePath: string) {
    const baseArray = [apiUrl.value, 'server/files/gcodes']
    if (subdirectory.value !== null) {
        let sub = subdirectory.value
        if (sub.startsWith('/')) sub = sub.substring(1)
        baseArray.push(sub)
    }
    baseArray.push(escapePath(relativePath))
    const baseUrl = baseArray.join('/')
    return `${baseUrl}?timestamp=${fileTimestamp.value}`
}
</script>

<style scoped>
.gcode-thumbnail {
    display: block;
}

.gcode-thumbnail--icon {
    width: 32px;
    height: 32px;
}

.gcode-thumbnail--card {
    width: 100%;
    height: 100%;
    object-fit: contain;
}

.gcode-thumbnail-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
}

.gcode-thumbnail-fallback--card {
    width: 100%;
    height: 100%;
    font-size: 3rem;
    color: rgba(var(--v-theme-on-surface), 0.35);
}
</style>
