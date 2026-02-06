<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { Proxy } from '@/types'
import * as api from '@/repositories/api'
import BulkImportModal from '@/parts/HomePage/BulkImportModal.vue'

const proxies = ref<Proxy[]>([])
const loading = ref(false)
const testingId = ref<number | null>(null)
const rotating = ref(false)
const deletingAll = ref(false)
const error = ref<string | null>(null)
const showBulkImport = ref(false)

async function fetchProxies() {
  loading.value = true
  error.value = null
  try {
    proxies.value = await api.listProxies()
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to load proxies'
  } finally {
    loading.value = false
  }
}

async function remove(proxy: Proxy) {
  const confirmed = confirm(`Delete proxy "${proxy.server}"?`)
  if (!confirmed) return

  error.value = null
  try {
    await api.deleteProxy(proxy.id)
    await fetchProxies()
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to delete proxy'
  }
}

async function test(proxy: Proxy) {
  testingId.value = proxy.id
  error.value = null
  try {
    const result = await api.testProxy(proxy.id)
    if (result.ok) {
      alert(`Proxy OK. IP: ${result.ip} (${result.elapsedMs}ms)`)
    } else {
      alert(`Proxy FAIL: ${result.error ?? 'unknown error'} (${result.elapsedMs}ms)`)
    }
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to test proxy'
  } finally {
    testingId.value = null
  }
}

async function rotate() {
  rotating.value = true
  error.value = null
  try {
    const proxy = await api.rotateProxy()
    await fetchProxies()
    alert(`Selected proxy: ${proxy.server} (usedAt updated)`)
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to rotate proxy'
  } finally {
    rotating.value = false
  }
}

async function deleteAll() {
  const confirmed = confirm(`Delete all ${proxies.value.length} proxies? This cannot be undone.`)
  if (!confirmed) return

  deletingAll.value = true
  error.value = null
  try {
    const result = await api.deleteAllProxies()
    alert(result.message)
    await fetchProxies()
  } catch (e: any) {
    error.value = e?.response?.data?.message ?? e?.message ?? 'Failed to delete proxies'
  } finally {
    deletingAll.value = false
  }
}

function openBulkImport() {
  showBulkImport.value = true
}

onMounted(fetchProxies)
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <div class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight">Proxy Management</h1>
      <p class="text-muted-foreground">Create, update, and delete proxies</p>
    </div>

    <div v-if="error" class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      {{ error }}
    </div>

    <div class="rounded-lg border bg-card">
      <div class="p-4 border-b flex items-center justify-between">
        <div class="font-medium">Proxies</div>
        <div class="flex items-center gap-3">
          <div class="text-sm text-muted-foreground">{{ proxies.length }} item(s)</div>
          <div class="flex gap-2">
            <button class="rounded-md border px-3 py-2 text-sm" :disabled="rotating" @click="rotate">
              {{ rotating ? 'Rotating...' : 'Rotate' }}
            </button>
            <button class="rounded-md border px-3 py-2 text-sm" @click="openBulkImport">
              Bulk Import
            </button>
            <button class="rounded-md border px-3 py-2 text-sm" :disabled="loading" @click="fetchProxies">
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="p-6 text-sm text-muted-foreground">Loading proxies...</div>

      <div v-else-if="proxies.length === 0" class="p-6 text-sm text-muted-foreground text-center">
        No proxies yet.
      </div>

      <div v-else class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-t bg-muted/40 text-left">
            <tr>
              <th class="p-3 font-medium">Server</th>
              <th class="p-3 font-medium">Status</th>
              <th class="p-3 font-medium">Usage</th>
              <th class="p-3 font-medium">Used At</th>
              <th class="p-3 font-medium">Username</th>
              <th class="p-3 font-medium">Password</th>
              <th class="p-3 font-medium w-40"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in proxies" :key="p.id" class="border-t">
              <td class="p-3 font-mono text-xs">{{ p.server }}</td>
              <td class="p-3">
                <span
                  :class="p.status === 'ACTIVE' ? 'text-green-700' : 'text-muted-foreground'"
                  class="text-xs font-mono"
                >
                  {{ p.status }}
                </span>
              </td>
              <td class="p-3 font-mono text-xs">{{ p.usageCount ?? 0 }}</td>
              <td class="p-3 font-mono text-xs">{{ p.usedAt ?? '-' }}</td>
              <td class="p-3">{{ p.username ?? '-' }}</td>
              <td class="p-3">
                <span v-if="p.password" class="font-mono text-xs">••••••••</span>
                <span v-else>-</span>
              </td>
              <td class="p-3 text-right space-x-2">
                <button
                  class="rounded-md border px-3 py-2 text-sm"
                  :disabled="testingId === p.id"
                  @click="test(p)"
                >
                  {{ testingId === p.id ? 'Testing...' : 'Test' }}
                </button>
                <button class="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive" @click="remove(p)">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <BulkImportModal v-model="showBulkImport" @imported="fetchProxies" />
  </div>
</template>
