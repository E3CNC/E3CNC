<template>
    <panel
        v-if="socketIsConnected && klipperState !== 'disconnected'"
        :icon="mdiBash"
        title="Host Bash"
        :collapsible="true"
        card-class="host-bash-panel"
        :hide-buttons-on-collapse="true">
        <template #buttons>
            <v-btn :icon="mdiTrashCan" rounded="0" @click="clearTerminal" />
            <v-menu :offset-y="true" :close-on-content-click="false">
                <template #activator="{ props }">
                    <v-btn :icon="mdiCog" rounded="0" v-bind="props" />
                </template>
                <v-list>
                    <v-list-item class="minHeight36">
                        <v-text-field
                            v-model.number="timeoutInput"
                            label="Command timeout (s)"
                            type="number"
                            density="compact"
                            variant="outlined"
                            hide-details
                            :min="1"
                            :max="300" />
                    </v-list-item>
                </v-list>
            </v-menu>
        </template>

        <v-card-text class="pa-0" style="background: #0d0d0d">
            <div ref="terminalContainer" class="terminal-container" />
        </v-card-text>
    </panel>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import { useStore } from 'vuex'
import { useBase } from '@/composables/useBase'
import { execBash } from '@/store/files/cncApi';
import Panel from '@/components/ui/Panel.vue'
import { mdiBash, mdiCog, mdiTrashCan } from '@mdi/js'
import { useToast } from 'vue-toast-notification'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const toast = useToast()
const store = useStore()
const { socketIsConnected, klipperState } = useBase()

const apiUrl = computed(() => store.getters['socket/getUrl'])
const timeoutInput = ref(30)

const terminalContainer = ref<HTMLDivElement | null>(null)
let terminal: Terminal | null = null
let fitAddon: FitAddon | null = null
let inputBuffer = ''
const commandHistory: string[] = []
let historyIndex = -1
let running = false

function getPrompt(): string {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'host'
    return `\x1b[32muser@${host}$\x1b[0m `
}

function writePrompt() {
    terminal?.write(getPrompt())
}

function clearTerminal() {
    terminal?.clear()
    inputBuffer = ''
    historyIndex = commandHistory.length
    writePrompt()
}

async function executeCommand(cmd: string) {
    if (!cmd.trim() || running) return

    running = true
    terminal?.writeln('')

    try {
        const result = await execBash(apiUrl.value, cmd, timeoutInput.value)

        if (result) {
            if (result.stdout) {
                // xterm.js needs \r\n (CRLF), not just \n (LF), otherwise
                // the cursor doesn't return to column 0 on each new line.
                const out = result.stdout.replace(/\r\n/g, '\n').replace(/\n$/, '').replace(/\n/g, '\r\n')
                // Always ensure the output ends with CRLF so the prompt
                // starts on its own line at column 0.
                terminal?.write(out)
                terminal?.write('\r\n')
            }
            if (result.stderr) {
                const err = result.stderr.replace(/\r\n/g, '\n').replace(/\n$/, '').replace(/\n/g, '\r\n')
                terminal?.write('\x1b[31m')
                terminal?.write(err)
                terminal?.write('\x1b[0m')
                terminal?.write('\r\n')
            }
        } else {
            terminal?.writeln('\x1b[31mNo response from server\x1b[0m')
        }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Request failed'
        terminal?.writeln(`\x1b[31m${msg}\x1b[0m`)
        toast.error('Host Bash: request failed')
    } finally {
        running = false
        terminal?.writeln('')
        writePrompt()
    }
}

function handleKey(e: { key: string; domEvent: KeyboardEvent }) {
    const ev = e.domEvent

    if (ev.ctrlKey && ev.key === 'c') {
        // Ctrl+C: clear current line
        terminal?.write('\r\n')
        inputBuffer = ''
        writePrompt()
        return
    }

    if (ev.ctrlKey && ev.key === 'l') {
        // Ctrl+L: clear terminal
        terminal?.clear()
        writePrompt()
        return
    }

    if (ev.key === 'Enter') {
        const cmd = inputBuffer
        inputBuffer = ''
        if (cmd.trim()) {
            commandHistory.push(cmd)
            historyIndex = commandHistory.length
        }
        executeCommand(cmd)
        return
    }

    if (ev.key === 'Backspace') {
        if (inputBuffer.length > 0) {
            inputBuffer = inputBuffer.slice(0, -1)
            terminal?.write('\b \b')
        }
        return
    }

    if (ev.key === 'ArrowUp') {
        ev.preventDefault()
        if (commandHistory.length === 0) return
        historyIndex = Math.max(0, historyIndex - 1)
        const hist = commandHistory[historyIndex]
        // Clear current line
        const clearLen = inputBuffer.length
        terminal?.write('\r' + '\b'.repeat(clearLen) + ' '.repeat(clearLen) + '\b'.repeat(clearLen))
        terminal?.write(getPrompt())
        terminal?.write(hist)
        inputBuffer = hist
        return
    }

    if (ev.key === 'ArrowDown') {
        ev.preventDefault()
        if (historyIndex >= commandHistory.length - 1) {
            historyIndex = commandHistory.length
            const clearLen = inputBuffer.length
            terminal?.write('\r' + '\b'.repeat(clearLen) + ' '.repeat(clearLen) + '\b'.repeat(clearLen))
            terminal?.write(getPrompt())
            inputBuffer = ''
            return
        }
        historyIndex = Math.min(commandHistory.length - 1, historyIndex + 1)
        const hist = commandHistory[historyIndex]
        const clearLen = inputBuffer.length
        terminal?.write('\r' + '\b'.repeat(clearLen) + ' '.repeat(clearLen) + '\b'.repeat(clearLen))
        terminal?.write(getPrompt())
        terminal?.write(hist)
        inputBuffer = hist
        return
    }

    // Ignore other control keys
    if (ev.altKey || ev.metaKey || ev.ctrlKey) return

    // Only write printable characters
    if (e.key.length === 1) {
        inputBuffer += e.key
        terminal?.write(e.key)
    }
}

function fitTerminal() {
    if (!fitAddon || !terminalContainer.value) return
    const w = terminalContainer.value.clientWidth
    const h = terminalContainer.value.clientHeight
    if (w < 100 || h < 50) return
    try {
        fitAddon.fit()
    } catch {
        // silently ignore resize errors
    }
}

onMounted(() => {
    if (!terminalContainer.value) return

    terminal = new Terminal({
        theme: {
            background: '#0d0d0d',
            foreground: '#c8c8c8',
            cursor: '#00ff00',
            selectionBackground: '#ffffff33',
            black: '#000000',
            red: '#ff6464',
            green: '#00c850',
            yellow: '#e5c07b',
            blue: '#61afef',
            magenta: '#c678dd',
            cyan: '#56b6c2',
            white: '#c8c8c8',
            brightBlack: '#5a5a5a',
            brightRed: '#ff6464',
            brightGreen: '#00c850',
            brightYellow: '#e5c07b',
            brightBlue: '#61afef',
            brightMagenta: '#c678dd',
            brightCyan: '#56b6c2',
            brightWhite: '#ffffff',
        },
        fontFamily: "'Cascadia Code', 'Fira Code', 'JetBrains Mono', 'Consolas', 'Courier New', monospace",
        fontSize: 13,
        cursorBlink: true,
        cursorStyle: 'bar',
        allowProposedApi: true,
        cols: 80,
        rows: 12,
    })

    fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(terminalContainer.value)

    terminal.onKey((e) => handleKey(e))

    // Write initial message
    terminal.writeln('E3CNC Host Bash — type a command or \x1b[33mhelp\x1b[0m to get started')
    terminal.writeln('')
    writePrompt()

    // Fit after mount, and keep retrying until the panel is truly visible
    const pollFit = () => {
        if (!fitAddon || !terminalContainer.value) return
        const w = terminalContainer.value.clientWidth
        const h = terminalContainer.value.clientHeight
        if (w >= 200 && h >= 100) {
            fitAddon.fit()
        } else {
            requestAnimationFrame(pollFit)
        }
    }
    requestAnimationFrame(pollFit)
})

onBeforeUnmount(() => {
    terminal?.dispose()
    terminal = null
    fitAddon = null
})

// Resize when container changes size (e.g. panel expand/collapse)
watch(
    () => store.state.gui.console.height,
    () => nextTick(() => fitTerminal())
)

// ResizeObserver for responsive sizing
let resizeObserver: ResizeObserver | null = null

onMounted(() => {
    if (terminalContainer.value) {
        resizeObserver = new ResizeObserver(() => fitTerminal())
        resizeObserver.observe(terminalContainer.value)
    }
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
    resizeObserver = null
})
</script>

<style>
/* Global styles — xterm renders into the container with its own DOM */
.host-bash-panel .terminal-container {
    width: 100%;
    height: 320px;
    padding: 4px 0;
}

.host-bash-panel .terminal-container .xterm {
    padding: 0 8px;
    height: 100% !important;
}

.host-bash-panel .terminal-container .xterm-viewport {
    scrollbar-width: thin;
}

.host-bash-panel .terminal-container .xterm-rows {
    width: 100% !important;
}
</style>
