<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { Setting, SettingType } from '@/types'
import * as api from '@/repositories/api'

const loading = ref(false)
const savingKey = ref<string | null>(null)
const error = ref<string | null>(null)

const settings = ref<Setting[]>([])
const activeTab = ref<string>('')

const groups = computed(() => {
  const unique = new Set(settings.value.map(s => s.group))
  return Array.from(unique).sort()
})

const filteredSettings = computed(() => {
  const group = activeTab.value.trim()
  if (!group) return settings.value
  return settings.value.filter(s => s.group === group)
})

// Initialize activeTab to the first group when settings are loaded
watch(settings, (newSettings) => {
  if (newSettings.length > 0 && !activeTab.value) {
    const allGroups = Array.from(new Set(newSettings.map(s => s.group))).sort()
    activeTab.value = allGroups[0] || ''
  }
}, { immediate: true })

async function fetchSettings() {
  loading.value = true
  error.value = null
  try {
    settings.value = await api.listSettings()
  } catch (e: any) {
    error.value = e?.message ?? 'Failed to load settings'
  } finally {
    loading.value = false
  }
}

function coerceToString(setting: Setting): string {
  if (setting.type === 'boolean') {
    const normalized = setting.value.toLowerCase()
    return normalized === 'true' ? 'true' : 'false'
  }
  return setting.value
}

function updateBooleanValue(setting: Setting, checked: boolean) {
  setting.value = checked ? 'true' : 'false'
}

async function save(setting: Setting) {
  savingKey.value = setting.key
  error.value = null
  try {
    const payload: Setting = {
      ...setting,
      key: setting.key.trim(),
      name: setting.name.trim(),
      group: setting.group.trim(),
      value: coerceToString(setting),
    }
    const saved = await api.saveSetting(payload)

    const idx = settings.value.findIndex(s => s.key === saved.key)
    if (idx !== -1) {
      settings.value[idx] = saved
    } else {
      settings.value.unshift(saved)
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to save setting'
  } finally {
    savingKey.value = null
  }
}

function typeOptions(): SettingType[] {
  return ['string', 'number', 'boolean', 'json']
}

onMounted(fetchSettings)
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <div v-if="error" class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      {{ error }}
    </div>

    <div class="rounded-lg border bg-card">
      <div class="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b">
        <div class="font-medium">Settings</div>
        <button class="rounded-md border px-3 py-2 text-sm" :disabled="loading" @click="fetchSettings">
          Refresh
        </button>
      </div>

      <!-- Tabs Navigation -->
      <div v-if="!loading && groups.length > 0" class="border-b bg-muted/20">
        <nav class="flex space-x-8 px-4" aria-label="Settings groups">
          <button
            v-for="group in groups"
            :key="group"
            @click="activeTab = group"
            :class="[
              'py-3 px-1 border-b-2 font-medium text-sm transition-colors',
              activeTab === group
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/50'
            ]"
          >
            {{ group }}
            <span class="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-muted/50">
              {{ settings.filter(s => s.group === group).length }}
            </span>
          </button>
        </nav>
      </div>

      <div v-if="loading" class="p-6 text-sm text-muted-foreground">Loading settings...</div>

      <div v-else-if="filteredSettings.length === 0" class="p-6 text-sm text-muted-foreground text-center">
        No settings found for this group.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-t bg-muted/40 text-left">
            <tr>
              <th class="p-3 font-medium">Name</th>
              <th class="p-3 font-medium">Type</th>
              <th class="p-3 font-medium">Value</th>
              <th class="p-3 font-medium w-28"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in filteredSettings" :key="s.key" class="border-t">
              <td class="p-3 font-mono text-xs">{{ s.name }}</td>
              <td class="p-3">
                <select v-model="s.type" class="w-full rounded-md border bg-background px-2 py-1 text-sm">
                  <option v-for="t in typeOptions()" :key="t" :value="t">{{ t }}</option>
                </select>
              </td>
              <td class="p-3">
                <input
                  v-if="s.type !== 'boolean'"
                  v-model="s.value"
                  class="w-full min-w-64 rounded-md border bg-background px-2 py-1 text-sm"
                />
                <label v-else class="flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-sm w-fit">
                  <input
                    type="checkbox"
                    :checked="s.value.toLowerCase() === 'true'"
                    @change="updateBooleanValue(s, ($event.target as HTMLInputElement).checked)"
                  />
                  <span>{{ s.value.toLowerCase() === 'true' ? 'true' : 'false' }}</span>
                </label>
              </td>
              <td class="p-3 text-right">
                <button
                  class="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
                  :disabled="savingKey === s.key"
                  @click="save(s)"
                >
                  {{ savingKey === s.key ? 'Saving...' : 'Save' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
