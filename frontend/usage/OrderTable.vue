<script lang="ts" setup>
import type { Order } from '~/types/order'
import TableTemplate from '~/components/table/template.vue'
import { Pencil, Trash2, UserPlus } from 'lucide-vue-next'
import OrderStatusBadge from './OrderStatusBadge.vue'
import OrderPlatformBadge from './OrderPlatformBadge.vue'

interface OrderTableProps {
  orders: Order[]
  selectedIds: Array<string | number>
  pagination: PaginationProps
}

defineProps<OrderTableProps>()

const emit = defineEmits<{
  (e: 'toggleAllSelection'): void
  (e: 'toggleSelection', id: string | number): void
  (e: 'viewOrder', order: Order): void
  (e: 'editOrder', order: Order): void
  (e: 'assignOrder', order: Order): void
  (e: 'deleteOrder', order: Order): void
}>()

// Column definitions
const columns = [
  { label: 'Order Name', key: 'order_name' as const },
  { label: 'SKU', key: 'sku' as const },
  { label: 'Product', key: 'name' as const },
  { label: 'Design', key: 'design' as const },
  { label: 'Status', key: 'design_status' as const },
  { label: 'Paid At', key: 'paid_at' as const },
]

// Actions configuration
const actions = computed(() => [
  {
    label: 'Edit',
    icon: Pencil,
    onClick: (order: Order) => emit('editOrder', order),
  },
  {
    label: 'Assign Designer',
    icon: UserPlus,
    onClick: (order: Order) => emit('assignOrder', order),
  },
  {
    label: 'Delete',
    icon: Trash2,
    destructive: true,
    onClick: (order: Order) => emit('deleteOrder', order),
  },
])

// Utility functions for slots
function formatDate(dateString: string | null) {
  if (!dateString) return 'N/A'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <TableTemplate
    :columns="columns"
    :data="orders"
    :pagination="pagination"
    :selected-ids="selectedIds"
    :options="{ selectable: true, actions }"
    @toggle-all-selection="emit('toggleAllSelection')"
    @toggle-selection="(id) => emit('toggleSelection', id)"
  >
    <template #order_name="{ item }">
      <div class="flex gap-1">
        <div class="font-medium">{{ item.order_name }}</div>
        <OrderPlatformBadge :platform="item.platform" />
      </div>
    </template>

    <template #sku="{ item }">
      <span class="text-xs text-muted-foreground">{{ item.sku }}</span>
    </template>

    <template #name="{ item }">
      <div class="flex items-center gap-2">
        <img v-if="item.image_url" :src="item.image_url" :alt="item.name" class="w-14 h-14 object-cover rounded" />
        <div class="flex flex-col">
          <span class="font-medium line-clamp-1">{{ item.name }}</span>
          <span class="text-xs text-muted-foreground">{{ item.detail }}</span>
          <span class="text-xs text-muted-foreground">x{{ item.quantity }}</span>
        </div>
      </div>
    </template>

    <template #design="{ item }">
      <div v-if="item.design">
        <div>
          <a :href="item.design.link" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline truncate block w-36">{{ item.design.link }}</a>
          <div class="text-xs text-muted-foreground">{{ item.design.type }}</div>
          <ColorPreview :color="item.design.color" size="sm" />
          <div class="text-xs text-muted-foreground">{{ item.design.style }}</div>
        </div>
      </div>
      <div v-else>
        <span class="text-xs text-muted-foreground">No design</span>
      </div>
    </template>

    <template #design_status="{ item }">
      <OrderStatusBadge :status="item.design_status" />
    </template>

    <template #paid_at="{ item }">
      <span class="text-muted-foreground text-sm">{{ formatDate(item.paid_at) }}</span>
    </template>
  </TableTemplate>
</template>
