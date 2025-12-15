<script lang="ts" setup generic="T extends { id: string | number }">
import Paginate from './paginate.vue'
import { MoreVertical, Filter } from 'lucide-vue-next'
import type { PaginationProps } from '@/types'
import { useRoute } from 'vue-router'
import { useQueryParams } from '@/composables/useQueryParams'
import { ref } from 'vue'
import type { Component } from 'vue'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

interface Action {
  label: string
  icon?: Component
  destructive?: boolean
  disabled?: boolean | ((item: T) => boolean)
  onClick?: (item: T) => void
}

interface TableColumn {
  label: string
  key: string
  filter?: {
    values: {
      value: string | number
      label: string
    }[]
    multiple: boolean
  }
}

interface Options {
  selectable: boolean
  actions: Action[]
}

interface Props {
  columns: TableColumn[]
  data: T[]
  pagination: PaginationProps
  selectedIds?: Array<string | number>
  options?: Options
}
const props = withDefaults(defineProps<Props>(), {
  options: () => ({
    selectable: true,
    actions: [],
  }),
  selectedIds: () => [],
})

const emit =defineEmits<{
  (e: 'toggleAllSelection'): void
  (e: 'toggleSelection', id: string | number): void
}>()

const route = useRoute()
const { getQueryParam, setQueryParam } = useQueryParams()

const filterMenuOpen = ref<string | null>(null)
const currentFilters = ref<string[] | string | undefined>()

// Helper function to check if a column has active filters
function hasActiveFilter(column: TableColumn): boolean {
  if (!column.filter) return false

  const value = route.query[column.key]
  if (!value) return false

  // Check if it's an array with items or a non-empty string
  if (Array.isArray(value)) {
    return value.length > 0
  }
  return value !== ''
}

function openFilterMenu(column: TableColumn) {
  if (!column.filter) return

  const key = column.key

  if (filterMenuOpen.value === key) {
    filterMenuOpen.value = null
    currentFilters.value = undefined
  } else {
    filterMenuOpen.value = key
    // Read current filter values from URL query parameters
    const value = getQueryParam(key, {
      as: column.filter.multiple ? 'array' : 'string'
    })
    // Initialize currentFilters based on filter type
    currentFilters.value = column.filter.multiple
      ? (value || [])
      : value
  }
}

function toggleSelection(optionValue: string | number, column: TableColumn) {
  if (!column.filter) return

  // Convert to string for consistent comparison with URL params
  const value = String(optionValue)
  const isMultiple = column.filter.multiple

  if (isMultiple) {
    // Handle multiple selection: add/remove from array
    const current = Array.isArray(currentFilters.value) ? currentFilters.value : []
    const currentSet = new Set(current)

    if (currentSet.has(value)) {
      currentSet.delete(value)
    }
    else {
      currentSet.add(value)
    }
    currentFilters.value = Array.from(currentSet)
  }
  else {
    // Handle single selection: replace or clear
    currentFilters.value = currentFilters.value === value ? undefined : value
  }
}

function clearFilterSelection(column: TableColumn) {
  currentFilters.value = undefined
  setQueryParam({
    [column.key]: undefined
  })
  filterMenuOpen.value = null
}

function applyFilterSelection(column: TableColumn) {
  // Update URL query parameters with current filter values
  setQueryParam({
    [column.key]: currentFilters.value
  })
  filterMenuOpen.value = null
}

function getCellValue(item: T, key: string) {
  return (item as any)?.[key]
}
</script>

<template>
  <div class="space-y-4">
    <div class="rounded-lg border bg-card overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/50 hover:bg-muted/50">
            <TableHead v-if="options.selectable">
              <Checkbox
                :checked="selectedIds.length === data.length"
                aria-label="Select all items"
                @update:model-value="emit('toggleAllSelection')"
              />
            </TableHead>
            <TableHead
              v-for="column in columns"
              :key="column.key"
              class="font-bold"
            >
              <div class="flex items-center gap-1">
                {{ column.label }}
                <DropdownMenu
                  v-if="column.filter"
                  :open="filterMenuOpen === column.key"
                  @update:open="openFilterMenu(column)"
                >
                  <DropdownMenuTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      :class="[
                        'h-6 w-6 p-0 hover:bg-muted',
                        hasActiveFilter(column)
                          ? 'text-primary bg-primary/10 hover:text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      ]"
                    >
                      <Filter class="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>

                  <DropdownMenuContent class="w-56 space-y-3 p-3" align="start">
                    <div class="max-h-48 space-y-1 overflow-y-auto pr-1">
                      <label
                        v-for="option in column.filter.values"
                        :key="`${column.key}-${option.value}`"
                        class="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted"
                      >
                        <Checkbox
                          :model-value="Array.isArray(currentFilters)
                            ? currentFilters.includes(String(option.value))
                            : currentFilters === String(option.value)"
                          @update:model-value="() => toggleSelection(option.value, column)"
                        />
                        <span>{{ option.label }}</span>
                      </label>
                    </div>
                    <div class="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        class="flex-1"
                        @click="clearFilterSelection(column)"
                      >
                        Clear
                      </Button>
                      <Button
                        size="sm"
                        class="flex-1"
                        @click="applyFilterSelection(column)"
                      >
                        Apply
                      </Button>
                    </div>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TableHead>
            <TableHead v-if="options.actions.length > 0" class="w-2" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="item in data"
            :key="item.id"
          >
            <TableCell v-if="options.selectable">
              <Checkbox
                :model-value="selectedIds.includes(item.id)"
                :aria-label="`Select item ${item.id}`"
                @update:model-value="emit('toggleSelection', item.id)"
              />
            </TableCell>
            <TableCell
              v-for="column in props.columns"
              :key="column.key"
            >
	              <slot
	                :name="column.key"
	                :item="item"
	              >
	                {{ getCellValue(item, column.key) ?? '-' }}
	              </slot>
	            </TableCell>
            <TableCell v-if="options.actions.length > 0">
              <div class="flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <MoreVertical class="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      v-for="action in options.actions"
                      :key="action.label"
                      :class="action.destructive ? 'text-destructive focus:text-destructive' : ''"
                      :disabled="typeof action.disabled === 'function' ? action.disabled(item) : action.disabled ?? false"
                      @click="action.onClick?.(item)"
                    >
                      <component :is="action.icon" class="mr-2 h-4 w-4" />
                      {{ action.label }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <Paginate
      :total-pages="pagination.totalPages"
      :total-rows="pagination.totalRows"
      :total-selected-rows="pagination.totalSelectedRows ?? 0"
    />
  </div>
</template>
