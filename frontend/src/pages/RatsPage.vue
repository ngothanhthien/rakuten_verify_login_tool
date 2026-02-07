<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { CustomRat } from '@/types'
import * as api from '@/repositories/api'

const rats = ref<CustomRat[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const showAddForm = ref(false)
const adding = ref(false)
const updatingId = ref<number | null>(null)

// Form fields
const newComponents = ref('{}')
const componentsError = ref<string | null>(null)

const validComponents = computed(() => {
  try {
    JSON.parse(newComponents.value)
    return true
  } catch {
    return false
  }
})

const canSubmit = computed(() => {
  return validComponents.value
})

async function fetchRats() {
  loading.value = true
  error.value = null
  try {
    rats.value = await api.listRats()
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to load RATs'
  } finally {
    loading.value = false
  }
}

function openAddForm() {
  newComponents.value = '{}'
  componentsError.value = null
  showAddForm.value = true
}

function closeAddForm() {
  showAddForm.value = false
  newComponents.value = '{}'
  componentsError.value = null
}

async function addRat() {
  if (!canSubmit.value) return

  adding.value = true
  error.value = null
  try {
    const components = JSON.parse(newComponents.value)
    await api.addRat(components)
    closeAddForm()
    await fetchRats()
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to add RAT'
  } finally {
    adding.value = false
  }
}

async function toggleStatus(rat: CustomRat) {
  const newStatus = rat.status === 'ACTIVE' ? 'DEAD' : 'ACTIVE'
  const confirmed = confirm(`Change RAT status to ${newStatus}?`)
  if (!confirmed) return

  updatingId.value = rat.id
  error.value = null
  try {
    await api.updateRatStatus(rat.id, newStatus)
    await fetchRats()
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to update RAT'
  } finally {
    updatingId.value = null
  }
}

async function remove(rat: CustomRat) {
  const confirmed = confirm(`Delete RAT "${rat.hash}"?`)
  if (!confirmed) return

  updatingId.value = rat.id
  error.value = null
  try {
    await api.deleteRat(rat.id)
    await fetchRats()
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to delete RAT'
  } finally {
    updatingId.value = null
  }
}

onMounted(fetchRats)
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <div class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight">Custom RAT Management</h1>
      <p class="text-muted-foreground">Manage GPU fingerprinting override RATs</p>
    </div>

    <div v-if="error" class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      {{ error }}
    </div>

    <div class="rounded-lg border bg-card">
      <div class="p-4 border-b flex items-center justify-between">
        <div class="font-medium">RATs</div>
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted-foreground">{{ rats.length }} item(s)</div>
          <div class="flex gap-2">
            <button class="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60" @click="openAddForm">
              Add RAT
            </button>
            <button class="rounded-md border px-3 py-2 text-sm" :disabled="loading" @click="fetchRats">
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="p-6 text-sm text-muted-foreground">Loading RATs...</div>

      <div v-else-if="rats.length === 0" class="p-6 text-sm text-muted-foreground text-center">
        No RATs yet. Add one to get started.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-t bg-muted/40 text-left">
            <tr>
              <th class="p-3 font-medium">Hash</th>
              <th class="p-3 font-medium">Status</th>
              <th class="p-3 font-medium">Failure Count</th>
              <th class="p-3 font-medium w-40"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rats" :key="r.id" class="border-t">
              <td class="p-3 font-mono text-xs max-w-[200px] truncate" :title="r.hash">
                {{ r.hash }}
              </td>
              <td class="p-3">
                <span
                  :class="r.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'"
                  class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                >
                  {{ r.status }}
                  <span v-if="r.status === 'ACTIVE'" class="ml-1">✓</span>
                  <span v-else class="ml-1">✗</span>
                </span>
              </td>
              <td class="p-3 font-mono text-xs">{{ r.failureCount }}</td>
              <td class="p-3 text-right space-x-2">
                <button
                  class="rounded-md border px-3 py-2 text-sm"
                  :disabled="updatingId === r.id"
                  @click="toggleStatus(r)"
                >
                  {{ r.status === 'ACTIVE' ? 'Mark Dead' : 'Activate' }}
                </button>
                <button
                  class="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive"
                  :disabled="updatingId === r.id"
                  @click="remove(r)"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add RAT Modal -->
    <div v-if="showAddForm" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-background rounded-lg border shadow-lg w-full max-w-md p-6 space-y-4">
        <div class="font-medium text-lg">Add New RAT</div>

        <div class="space-y-2">
          <label class="text-sm font-medium">Components (JSON)</label>
          <textarea
            v-model="newComponents"
            rows="4"
            class="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
            placeholder='{"key": "value"}'
          />
          <div v-if="!validComponents && newComponents" class="text-destructive text-xs">
            Invalid JSON: {{ componentsError || 'check syntax' }}
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            class="rounded-md border px-4 py-2 text-sm"
            :disabled="adding"
            @click="closeAddForm"
          >
            Cancel
          </button>
          <button
            class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-60"
            :disabled="adding || !canSubmit"
            @click="addRat"
          >
            {{ adding ? 'Adding...' : 'Add RAT' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
