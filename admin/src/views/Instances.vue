<template>
  <v-card>
    <v-card-title class="d-flex align-center">
      <v-icon class="mr-2" color="primary">mdi-server</v-icon>
      All Instances
      <v-spacer />
      <v-btn
        size="small"
        variant="outlined"
        color="primary"
        :loading="loading"
        @click="loadData"
      >
        <v-icon start>mdi-refresh</v-icon>
        Refresh
      </v-btn>
    </v-card-title>

    <v-card-text v-if="loading && instances.length === 0" class="text-center pa-6">
      <v-progress-circular indeterminate color="primary"></v-progress-circular>
      <div class="mt-2 text-medium-emphasis">Loading instances...</div>
    </v-card-text>

    <v-card-text v-else-if="instances.length === 0" class="text-center pa-6">
      <v-icon size="64" class="mb-2" color="grey">mdi-server-off</v-icon>
      <div class="text-h6">No instances found</div>
      <div class="text-body-2 text-medium-emphasis mt-1">
        Run the install wizard to create your first instance.
      </div>
    </v-card-text>

    <v-expansion-panels v-else variant="accordion">
      <v-expansion-panel
        v-for="inst in instances"
        :key="inst.name"
      >
        <v-expansion-panel-title>
          <template #default>
            <div class="d-flex align-center ga-3 w-100">
              <v-icon :color="inst.is_running ? 'success' : 'grey'">
                {{ inst.is_running ? 'mdi-check-circle' : 'mdi-stop-circle' }}
              </v-icon>
              <div>
                <strong>{{ inst.name }}</strong>
                <div class="text-caption text-medium-emphasis">
                  Moonraker :{{ inst.moonraker_port }} &middot;
                  Web :{{ inst.web_port }}
                </div>
              </div>
              <v-spacer />
              <v-chip
                :color="allPassed(inst) ? 'success' : 'warning'"
                size="x-small"
                variant="tonal"
              >
                {{ healthSummary(inst) }}
              </v-chip>
            </div>
          </template>
        </v-expansion-panel-title>

        <v-expansion-panel-text>
          <!-- Health Checks Table -->
          <v-table density="compact">
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="check in inst.health_checks"
                :key="check.name"
                :class="check.passed ? '' : 'bg-warning'"
              >
                <td>{{ check.name }}</td>
                <td>
                  <v-icon :color="check.passed ? 'success' : 'warning'" size="small">
                    {{ check.passed ? 'mdi-check-circle' : 'mdi-alert-circle' }}
                  </v-icon>
                </td>
                <td class="text-caption">{{ check.detail }}</td>
              </tr>
            </tbody>
          </v-table>

          <!-- Actions -->
          <div class="d-flex ga-2 mt-3">
            <v-btn
              size="small"
              variant="outlined"
              :href="`http://${localIP}:${inst.web_port}/`"
              target="_blank"
            >
              <v-icon start>mdi-open-in-new</v-icon>
              Open Web UI
            </v-btn>
            <v-btn
              size="small"
              variant="tonal"
              color="warning"
              :loading="backingUp === inst.name"
              @click="backupInstance(inst.name)"
            >
              <v-icon start>mdi-backup-restore</v-icon>
              Backup
            </v-btn>
          </div>

          <!-- Backup result -->
          <v-alert
            v-if="backupResult && backupResult.instance === inst.name"
            :type="backupResult.error ? 'error' : 'success'"
            density="compact"
            closable
            class="mt-2"
            @click:close="backupResult = null"
          >
            {{ backupResult.error ? backupResult.error : `Backup: ${backupResult.backup_path}` }}
          </v-alert>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>
  </v-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/api'

interface HealthCheck {
  name: string
  passed: boolean
  detail: string
  optional?: boolean
}

interface InstanceData {
  name: string
  moonraker_port: number
  web_port: number
  is_running: boolean
  config_dir: string
  health_checks: HealthCheck[]
}

const loading = ref(true)
const instances = ref<InstanceData[]>([])
const localIP = ref('127.0.0.1')
const backingUp = ref<string | null>(null)

interface BackupResult {
  instance: string
  backup_path?: string
  error?: string
}

const backupResult = ref<BackupResult | null>(null)

function allPassed(inst: InstanceData): boolean {
  return inst.health_checks?.every((h) => h.passed) ?? false
}

function healthSummary(inst: InstanceData): string {
  if (!inst.health_checks?.length) return 'No checks'
  const ok = inst.health_checks.filter((h) => h.passed).length
  return `${ok}/${inst.health_checks.length}`
}

async function loadData() {
  try {
    loading.value = true
    const res = await api.get('/api/instances')
    instances.value = res.data.instances || []
    localIP.value = res.data.local_ip || '127.0.0.1'
  } catch {
    // server not reachable
  } finally {
    loading.value = false
  }
}

async function backupInstance(name: string) {
  backingUp.value = name
  backupResult.value = null
  try {
    const res = await api.post(`/api/backup/${name}`)
    backupResult.value = { instance: name, backup_path: res.data.backup_path }
  } catch (err: any) {
    backupResult.value = {
      instance: name,
      error: err.response?.data?.error || err.message || 'Backup failed',
    }
  } finally {
    backingUp.value = null
  }
}

onMounted(loadData)
</script>