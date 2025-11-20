<script setup lang="ts">
import { computed } from 'vue'
import { ChevronLeftIcon, ChevronsLeftIcon as DoubleArrowLeftIcon, ChevronsRightIcon as DoubleArrowRightIcon, ChevronRightIcon } from 'lucide-vue-next'
import type { PaginationProps } from '@/types'
import { useRoute } from 'vue-router'
import { useQueryParams } from '@/composables/useQueryParams'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Button } from '@/components/ui/button'

defineProps<PaginationProps>()

const pageSizes = [25, 50, 100, 200, 500]
const route = useRoute()

const currentPerPage = computed(() => {
  return route.query.per_page as string || String(pageSizes[0])
})
const currentPage = computed(() => {
  return Number(route.query.page) || 1
})

const { setQueryParam } = useQueryParams()

function handlePerPageChange(value: string | number) {
  setQueryParam({ per_page: value, page: 1 })
}

function handlePageChange(page: number) {
  setQueryParam({ page })
}
</script>

<template>
  <div class="flex items-center justify-between px-2">
    <div
      v-if="totalSelectedRows"
      class="flex-1 text-sm text-muted-foreground"
    >
      {{ totalSelectedRows }} row(s) selected.
    </div>
    <div class="flex items-center space-x-6 lg:space-x-8 ml-auto">
      <div class="flex items-center space-x-2">
        <p class="text-sm font-medium">
          Rows per page
        </p>
        <Select
          :model-value="currentPerPage"
          @update:model-value="($event) => { handlePerPageChange($event as string) }"
        >
          <SelectTrigger class="h-8 w-[70px]">
            <SelectValue :placeholder="currentPerPage" />
          </SelectTrigger>
          <SelectContent side="top">
            <SelectItem
              v-for="pageSize in pageSizes"
              :key="pageSize"
              :value="`${pageSize}`"
            >
              {{ pageSize }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex w-[100px] items-center justify-center text-sm font-medium">
        Page {{ currentPage }} of
        {{ totalPages }}
      </div>
      <div class="flex items-center space-x-2">
        <Button
          variant="outline"
          class="hidden h-8 w-8 p-0 lg:flex"
          :disabled="currentPage <= 1"
          @click="handlePageChange(1)"
        >
          <span class="sr-only">Go to first page</span>
          <DoubleArrowLeftIcon class="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          class="h-8 w-8 p-0"
          :disabled="currentPage <= 1"
          @click="handlePageChange(currentPage - 1)"
        >
          <span class="sr-only">Go to previous page</span>
          <ChevronLeftIcon class="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          class="h-8 w-8 p-0"
          :disabled="currentPage >= totalPages"
          @click="handlePageChange(currentPage + 1)"
        >
          <span class="sr-only">Go to next page</span>
          <ChevronRightIcon class="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          class="hidden h-8 w-8 p-0 lg:flex"
          :disabled="currentPage >= totalPages"
          @click="handlePageChange(totalPages)"
        >
          <span class="sr-only">Go to last page</span>
          <DoubleArrowRightIcon class="h-4 w-4" />
        </Button>
      </div>
    </div>
  </div>
</template>
