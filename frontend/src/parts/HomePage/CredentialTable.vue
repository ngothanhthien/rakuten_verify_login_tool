<script lang="ts" setup>
import type { Credential, PaginationProps } from '@/types'
import TableTemplate from '@/components/table/template.vue'
import { Trash2 } from 'lucide-vue-next'
import CredentialStatusBadge from './CredentialStatusBadge.vue'

interface CredentialTableProps {
  credentials: Credential[]
  selectedIds: Array<string | number>
  pagination: PaginationProps
}

defineProps<CredentialTableProps>()

const emit = defineEmits<{
  (e: 'toggleAllSelection'): void
  (e: 'toggleSelection', id: string | number): void
  (e: 'deleteCredential', credential: Credential): void
}>()

// Column definitions
const columns = [
  {
    label: 'Email',
    key: 'email' as const
  },
  {
    label: 'Password',
    key: 'password' as const
  },
  {
    label: 'Status',
    key: 'status' as const,
    filter: {
      values: [
        { value: 'ACTIVE', label: 'Active' },
        { value: 'INACTIVE', label: 'Inactive' },
        { value: 'UNKNOWN', label: 'Unknown' }
      ],
      multiple: false
    }
  },
  {
    label: 'Checked At',
    key: 'checkedAt' as const
  }
]

// Actions configuration
const actions = [
  {
    label: 'Delete',
    icon: Trash2,
    destructive: true,
    onClick: (credential: Credential) => emit('deleteCredential', credential),
  }
]

// Utility function to format date
function formatDate(dateString: string | null) {
  if (!dateString) return 'Not checked yet'
  const date = new Date(dateString)
  return date.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>

<template>
  <TableTemplate
    :columns="columns"
    :data="credentials"
    :pagination="pagination"
    :selected-ids="selectedIds"
    :options="{ selectable: true, actions }"
    @toggle-all-selection="emit('toggleAllSelection')"
    @toggle-selection="(id) => emit('toggleSelection', id)"
  >
    <template #email="{ item }">
      <div class="font-medium">{{ item.email }}</div>
    </template>

    <template #password="{ item }">
      <span class="font-mono text-xs text-muted-foreground">{{ item.password }}</span>
    </template>

    <template #status="{ item }">
      <CredentialStatusBadge :status="item.status" />
    </template>

    <template #checkedAt="{ item }">
      <span class="text-muted-foreground text-sm">{{ formatDate(item.checkedAt) }}</span>
    </template>
  </TableTemplate>
</template>
