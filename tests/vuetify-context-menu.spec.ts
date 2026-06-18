import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { resolve } from 'path'

function findVueFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name)
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      files.push(...findVueFiles(full))
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      files.push(full)
    }
  }
  return files
}

describe('Vuetify 3 context menu positioning', () => {
  // Vuetify 3 removed position-x/position-y props from VMenu.
  // Context menus that follow mouse cursor must use :target="[x, y]"
  // with location="bottom start" origin="top left".
  //
  // The old Vuetify 2 pattern :position-x / :position-y is silently
  // ignored in Vuetify 3 — the menu always appears at (0,0).
  //
  // See: commit 3dc64038 (correct :target pattern)

  const srcDir = resolve(__dirname, '../src')
  const vueFiles = findVueFiles(srcDir)

  it('should never use deprecated position-x/position-y on v-menu', () => {
    const violations: string[] = []

    for (const file of vueFiles) {
      const content = readFileSync(file, 'utf-8')

      // Match v-menu with :position-x or :position-y — these are dead
      // props in Vuetify 3 and do nothing.
      const posX = /<v-menu[^>]*\b:position-x\s*=/gi
      const posY = /<v-menu[^>]*\b:position-y\s*=/gi

      let match: RegExpExecArray | null
      while ((match = posX.exec(content)) !== null) {
        const line = content.slice(0, match.index).split('\n').length
        violations.push(`${file}:${line}`)
      }
      while ((match = posY.exec(content)) !== null) {
        const line = content.slice(0, match.index).split('\n').length
        violations.push(`${file}:${line}`)
      }
    }

    const unique = Array.from(new Set(violations))
    expect(unique).toEqual([])
  })
})
