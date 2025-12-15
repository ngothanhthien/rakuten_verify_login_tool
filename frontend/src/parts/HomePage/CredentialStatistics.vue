<script lang="ts" setup>
import type { CredentialStatistics } from '@/types'
import { Activity, TrendingUp, TrendingDown, AlertCircle } from 'lucide-vue-next'

interface Props {
  statistics: CredentialStatistics | null
  loading?: boolean
}

defineProps<Props>()

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: 'Active',
    INACTIVE: 'Inactive',
    UNKNOWN: 'Unknown'
  }
  return labels[status] ?? status
}

function getStatusIcon(status: string) {
  const icons: Record<string, any> = {
    ACTIVE: TrendingUp,
    INACTIVE: TrendingDown,
    UNKNOWN: AlertCircle
  }
  return icons[status] ?? Activity
}

function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    ACTIVE: 'text-green-600',
    INACTIVE: 'text-red-600',
    UNKNOWN: 'text-yellow-600'
  }
  return colors[status] ?? 'text-gray-600'
}

function getStatusBgColor(status: string) {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-50',
    INACTIVE: 'bg-red-50',
    UNKNOWN: 'bg-yellow-50'
  }
  return colors[status] ?? 'bg-gray-50'
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-4">
    <!-- Total Card -->
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
      <div class="flex items-center justify-between space-y-0 pb-2">
        <h3 class="text-sm font-medium">Total Credentials</h3>
        <Activity class="h-4 w-4 text-muted-foreground" />
      </div>
      <div v-if="loading" class="text-muted-foreground text-sm">Loading...</div>
      <div v-else-if="statistics">
        <div class="text-2xl font-bold">{{ statistics.total }}</div>
        <p class="text-xs text-muted-foreground pt-1">
          All credentials in system
        </p>
      </div>
    </div>

    <!-- Status Cards -->
    <div
      v-if="statistics && !loading"
      v-for="statusItem in statistics.byStatus"
      :key="statusItem.status"
      class="rounded-lg border bg-card text-card-foreground shadow-sm p-6"
    >
      <div class="flex items-center justify-between space-y-0 pb-2">
        <h3 class="text-sm font-medium">{{ getStatusLabel(statusItem.status) }}</h3>
        <component
          :is="getStatusIcon(statusItem.status)"
          class="h-4 w-4"
          :class="getStatusColor(statusItem.status)"
        />
      </div>
      <div>
        <div class="text-2xl font-bold">{{ statusItem.count }}</div>
        <p class="text-xs text-muted-foreground pt-1">
          <span v-if="statistics.total > 0">
            {{ ((statusItem.count / statistics.total) * 100).toFixed(1) }}% of total
          </span>
          <span v-else>0% of total</span>
        </p>
      </div>
    </div>

    <!-- Loading placeholders for status cards when loading -->
    <div
      v-if="loading"
      v-for="i in 3"
      :key="i"
      class="rounded-lg border bg-card text-card-foreground shadow-sm p-6"
    >
      <div class="text-muted-foreground text-sm">Loading...</div>
    </div>
  </div>
</template>
