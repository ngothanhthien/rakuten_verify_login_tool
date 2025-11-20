<script lang="ts" setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useQueryParams } from '@/composables/useQueryParams'
import { useRoute } from 'vue-router'
import type { Credential, PaginationProps } from '@/types'
import * as api from '@/repositories/api'
import CredentialTable from '@/parts/HomePage/CredentialTable.vue'
import CredentialActions from '@/parts/HomePage/CredentialActions.vue'

const route = useRoute()
const { getAllQueryParams, queryKey } = useQueryParams()

// State
const credentials = ref<Credential[]>([])
const selectedIds = ref<number[]>([])
const pagination = ref<PaginationProps>({
  totalPages: 0,
  totalRows: 0,
  totalSelectedRows: 0
})
const isChecking = ref(false)
const loading = ref(false)

// Computed
const selectedCount = computed(() => selectedIds.value.length)

// Fetch credentials from API
async function fetchCredentials() {
  loading.value = true
  try {
    const queryParams = getAllQueryParams()
    const response = await api.listCredentials(queryParams as Record<string, string>)

    credentials.value = response.data
    pagination.value = {
      totalPages: response.totalPages,
      totalRows: response.totalRecords,
      totalSelectedRows: selectedIds.value.length
    }
  } catch (error) {
    console.error('Failed to fetch credentials:', error)
  } finally {
    loading.value = false
  }
}

// Fetch check status
async function fetchCheckStatus() {
  try {
    isChecking.value = await api.getCheck()
  } catch (error) {
    console.error('Failed to fetch check status:', error)
  }
}

// Selection handlers
function toggleAllSelection() {
  if (selectedIds.value.length === credentials.value.length) {
    selectedIds.value = []
  } else {
    selectedIds.value = credentials.value.map(c => c.id)
  }
  updatePaginationSelectedCount()
}

function toggleSelection(id: string | number) {
  const numId = typeof id === 'string' ? parseInt(id) : id
  const index = selectedIds.value.indexOf(numId)

  if (index === -1) {
    selectedIds.value.push(numId)
  } else {
    selectedIds.value.splice(index, 1)
  }
  updatePaginationSelectedCount()
}

function updatePaginationSelectedCount() {
  pagination.value = {
    ...pagination.value,
    totalSelectedRows: selectedIds.value.length
  }
}

// Action handlers
async function handleImport(file: File) {
  try {
    await api.importCredentials(file)
    await fetchCredentials()
    selectedIds.value = []
  } catch (error) {
    console.error('Failed to import credentials:', error)
  }
}

async function handleExport() {
  try {
    await api.exportActiveCredentials()
  } catch (error) {
    console.error('Failed to export credentials:', error)
    alert('Failed to export credentials. Please try again.')
  }
}

async function handleBulkDelete() {
  if (selectedIds.value.length === 0) return

  const confirmed = confirm(`Are you sure you want to delete ${selectedIds.value.length} credential(s)?`)
  if (!confirmed) return

  try {
    await api.bulkDelete(selectedIds.value)
    await fetchCredentials()
    selectedIds.value = []
  } catch (error) {
    console.error('Failed to delete credentials:', error)
  }
}

async function handleDeleteCredential(credential: Credential) {
  const confirmed = confirm(`Are you sure you want to delete the credential for ${credential.email}?`)
  if (!confirmed) return

  try {
    await api.bulkDelete([credential.id])
    await fetchCredentials()
    // Remove from selection if it was selected
    const index = selectedIds.value.indexOf(credential.id)
    if (index !== -1) {
      selectedIds.value.splice(index, 1)
    }
  } catch (error) {
    console.error('Failed to delete credential:', error)
  }
}

async function handleStartCheck() {
  try {
    await api.startCheck()
    isChecking.value = true
  } catch (error) {
    console.error('Failed to start check:', error)
  }
}

async function handleStopCheck() {
  try {
    await api.stopCheck()
    isChecking.value = false
  } catch (error) {
    console.error('Failed to stop check:', error)
  }
}

// Watch for query param changes
watch(queryKey, () => {
  fetchCredentials()
})

// Initial load
onMounted(async () => {
  await Promise.all([
    fetchCredentials(),
    fetchCheckStatus()
  ])
})
</script>

<template>
  <div class="container mx-auto p-6 space-y-6">
    <div class="space-y-2">
      <h1 class="text-3xl font-bold tracking-tight">Credentials Management</h1>
      <p class="text-muted-foreground">
        Manage and monitor your Rakuten credentials
      </p>
    </div>

    <CredentialActions
      :selected-count="selectedCount"
      :is-checking="isChecking"
      @import="handleImport"
      @export="handleExport"
      @bulk-delete="handleBulkDelete"
      @start-check="handleStartCheck"
      @stop-check="handleStopCheck"
    />

    <div v-if="loading" class="flex justify-center p-8">
      <div class="text-muted-foreground">Loading credentials...</div>
    </div>

    <CredentialTable
      v-else
      :credentials="credentials"
      :selected-ids="selectedIds"
      :pagination="pagination"
      @toggle-all-selection="toggleAllSelection"
      @toggle-selection="toggleSelection"
      @delete-credential="handleDeleteCredential"
    />
  </div>
</template>
