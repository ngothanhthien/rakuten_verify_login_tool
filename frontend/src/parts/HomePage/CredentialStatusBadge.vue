<script lang="ts" setup>
import type { CredentialStatus } from '@/types'

interface Props {
  status: CredentialStatus
}

defineProps<Props>()

const statusConfig: Record<CredentialStatus, { label: string; class: string }> = {
  ACTIVE: {
    label: 'Active',
    class: 'bg-green-100 text-green-800 border-green-200'
  },
  INACTIVE: {
    label: 'Inactive',
    class: 'bg-red-100 text-red-800 border-red-200'
  },
  UNKNOWN: {
    label: 'Unknown',
    class: 'bg-gray-100 text-gray-800 border-gray-200'
  }
}
</script>

<template>
  <span
    :class="[
      'inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border',
      statusConfig[status].class
    ]"
  >
    {{ statusConfig[status].label }}
  </span>
</template>
