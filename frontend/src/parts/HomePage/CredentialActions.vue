<script lang="ts" setup>
import { Button } from '@/components/ui/button'
import { Upload, Trash2, Play, StopCircle } from 'lucide-vue-next'
import { ref } from 'vue'

interface Props {
  selectedCount: number
  isChecking: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'import', file: File): void
  (e: 'bulkDelete'): void
  (e: 'startCheck'): void
  (e: 'stopCheck'): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)

function handleImportClick() {
  fileInputRef.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    emit('import', file)
    // Reset input so the same file can be selected again
    target.value = ''
  }
}
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <div class="flex items-center gap-2">
      <input
        ref="fileInputRef"
        type="file"
        accept=".csv,.xlsx,.xls,.txt"
        class="hidden"
        @change="handleFileChange"
      />

      <Button
        variant="outline"
        size="sm"
        @click="handleImportClick"
      >
        <Upload class="mr-2 h-4 w-4" />
        Import Credentials
      </Button>

      <Button
        v-if="selectedCount > 0"
        variant="destructive"
        size="sm"
        @click="emit('bulkDelete')"
      >
        <Trash2 class="mr-2 h-4 w-4" />
        Delete {{ selectedCount }} selected
      </Button>
    </div>

    <div class="flex items-center gap-2">
      <Button
        v-if="!isChecking"
        variant="default"
        size="sm"
        @click="emit('startCheck')"
      >
        <Play class="mr-2 h-4 w-4" />
        Start Checking
      </Button>

      <Button
        v-else
        variant="outline"
        size="sm"
        @click="emit('stopCheck')"
      >
        <StopCircle class="mr-2 h-4 w-4" />
        Stop Checking
      </Button>
    </div>
  </div>
</template>
