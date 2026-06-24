import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MainsailLogo from '@/components/ui/MainsailLogo.vue'

describe('MainsailLogo.vue', () => {
    it('renders an SVG', () => {
        const wrapper = mount(MainsailLogo)
        expect(wrapper.find('svg').exists()).toBe(true)
    })

    it('renders with empty style when no color prop (default prop is blank)', () => {
        const wrapper = mount(MainsailLogo)
        const path = wrapper.find('path')
        // Vue's style binding adds space after colon when value is blank
        expect(path.attributes('style')).toBe('')
    })

    it('uses provided color prop', () => {
        const wrapper = mount(MainsailLogo, {
            props: { color: '#ff0000' },
        })
        const path = wrapper.find('path')
        expect(path.attributes('style')).toContain('#ff0000')
        expect(path.attributes('style')).toContain('fill')
    })

    it('updates color when prop changes', async () => {
        const wrapper = mount(MainsailLogo, {
            props: { color: '#ff0000' },
        })
        await wrapper.setProps({ color: '#00ff00' })
        const path = wrapper.find('path')
        expect(path.attributes('style')).toContain('#00ff00')
    })

    it('renders with empty style when color prop cleared', async () => {
        const wrapper = mount(MainsailLogo, {
            props: { color: '#ff0000' },
        })
        await wrapper.setProps({ color: '' })
        const path = wrapper.find('path')
        expect(path.attributes('style')).toBe('')
    })

    it('renders 3 path elements', () => {
        const wrapper = mount(MainsailLogo)
        const paths = wrapper.findAll('path')
        expect(paths.length).toBe(3)
    })
})
