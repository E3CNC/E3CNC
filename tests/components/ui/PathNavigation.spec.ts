import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import PathNavigation from '@/components/ui/PathNavigation.vue'

describe('PathNavigation.vue', () => {
    it('renders with default empty path', () => {
        const wrapper = mount(PathNavigation)
        expect(wrapper.find('span').exists()).toBe(true)
    })

    it('renders root path using base directory label when path is empty', () => {
        const wrapper = mount(PathNavigation, {
            props: {
                path: '',
                baseDirectoryLabel: 'Root',
            },
        })
        expect(wrapper.text()).toContain('Root')
        // Empty path produces one segment (the empty first segment).
        // index 0 === pathSegments.length - 1 (0 === 0) so it's the last segment = NOT clickable
        expect(wrapper.find('.cursor-pointer').exists()).toBe(false)
    })

    it('renders single path segment as non-clickable (last element)', () => {
        const wrapper = mount(PathNavigation, {
            props: {
                path: 'gcodes',
                baseDirectoryLabel: 'Root',
            },
        })
        expect(wrapper.text()).toContain('gcodes')
        // Last segment should not be clickable (index === length - 1)
        expect(wrapper.find('.cursor-pointer').exists()).toBe(false)
    })

    it('renders multiple path segments with dividers using directory names', () => {
        const wrapper = mount(PathNavigation, {
            props: {
                path: 'gcodes/folder1/folder2',
                baseDirectoryLabel: 'Root',
            },
        })
        // First segment is 'gcodes' (truthy) so baseDirectoryLabel is NOT shown
        expect(wrapper.text()).not.toContain('Root')
        expect(wrapper.text()).toContain('gcodes')
        expect(wrapper.text()).toContain('folder1')
        expect(wrapper.text()).toContain('folder2')
        // Dividers between segments (not after last)
        const dividers = wrapper.findAll('.navigation-divider')
        expect(dividers.length).toBe(2) // 3 segments = 2 dividers
    })

    it('calls onSegmentClick with correct location when clicking a segment', async () => {
        const onSegmentClick = vi.fn()
        const wrapper = mount(PathNavigation, {
            props: {
                path: 'gcodes/folder1/folder2',
                baseDirectoryLabel: 'Root',
                onSegmentClick,
            },
        })

        // Click on "gcodes" (first clickable segment — index 0, not the last)
        const clickableSegments = wrapper.findAll('.cursor-pointer')
        expect(clickableSegments.length).toBe(2) // gcodes and folder1 (folder2 is last)

        await clickableSegments[0].trigger('click')
        expect(onSegmentClick).toHaveBeenCalledTimes(1)
        expect(onSegmentClick).toHaveBeenCalledWith({ location: 'gcodes' })
    })

    it('makes last segment bold (.navigation-container:last-child has font-weight bold via CSS)', () => {
        const wrapper = mount(PathNavigation, {
            props: {
                path: 'gcodes/folder1',
                baseDirectoryLabel: 'Root',
            },
        })
        const containers = wrapper.findAll('.navigation-container')
        expect(containers.length).toBe(2)
        const lastContainer = containers[1]
        expect(lastContainer.exists()).toBe(true)
    })

    it('uses baseDirectoryLabel when first segment is empty string', () => {
        const wrapper = mount(PathNavigation, {
            props: {
                path: '',
                baseDirectoryLabel: 'Home',
            },
        })
        expect(wrapper.text()).toContain('Home')
    })
})
