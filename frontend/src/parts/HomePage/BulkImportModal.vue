<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import * as api from '@/repositories/api'

interface ImportResult {
  created: number
  updated: number
  skipped: number
  errors: Array<{ line: number, raw: string, error: string }>
}

interface Props {
  modelValue: boolean
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
  (e: 'imported'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const text = ref('')
const importing = ref(false)
const result = ref<ImportResult | null>(null)
const error = ref<string | null>(null)
const timeoutId = ref<number | null>(null)

const isOpen = ref(props.modelValue)

watch(() => props.modelValue, (val) => {
  isOpen.value = val
  if (val) {
    // Reset state when opening
    text.value = ''
    result.value = null
    error.value = null
  }
})

function close() {
  emit('update:modelValue', false)
}

async function doImport() {
  const trimmed = text.value.trim()
  if (!trimmed) {
    error.value = 'Please enter at least one proxy'
    return
  }

  importing.value = true
  error.value = null
  result.value = null

  try {
    const response = await api.bulkImportProxies(trimmed)
    result.value = response
    emit('imported')

    // Auto-close after 2 seconds if successful
    timeoutId.value = setTimeout(() => {
      close()
    }, 2000) as unknown as number
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Import failed'
  } finally {
    importing.value = false
  }
}

onUnmounted(() => {
  if (timeoutId.value) {
    clearTimeout(timeoutId.value)
  }
})
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div class="bg-background rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b">
        <h2 class="text-lg font-semibold">Bulk Import Proxies</h2>
        <button
          @click="close"
          :disabled="importing"
          class="rounded-md px-2 py-1 text-sm hover:bg-muted disabled:opacity-50"
        >
          ✕
        </button>
      </div>

      <!-- Body -->
      <div class="p-4 overflow-y-auto flex-1 space-y-4">
        <!-- Instructions -->
        <div class="text-sm text-muted-foreground space-y-1">
          <p><strong>Format:</strong> ip:port:username:password (one per line)</p>
          <p class="text-xs">Proxies will be tested before import (latency < 2000ms required)</p>
        </div>

        <!-- Error message -->
        <div v-if="error" class="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {{ error }}
        </div>

        <!-- Result summary -->
        <div v-if="result" class="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
          <p><strong>Import Complete:</strong></p>
          <p>✅ Created: {{ result.created }}</p>
          <p>🔄 Updated: {{ result.updated }}</p>
          <p>⏭️ Skipped: {{ result.skipped }}</p>
          <p v-if="result.errors.length" class="text-destructive">❌ Errors: {{ result.errors.length }}</p>
        </div>

        <!-- Textarea -->
        <div class="space-y-2">
          <textarea
            v-model="text"
            :disabled="importing"
            class="w-full h-64 rounded-md border bg-background px-3 py-2 text-sm font-mono"
            placeholder="103.49.63.100:2649:user1:pass1&#10;103.49.63.100:2176:user2:pass2&#10;..."
          />
        </div>

        <!-- Example -->
        <div class="text-xs text-muted-foreground">
          <p><strong>Example:</strong></p>
          <pre class="font-mono bg-muted p-2 rounded mt-1">103.49.63.100:2649:username1:password1
103.49.63.100:2176:username2:password2</pre>
        </div>
      </div>

      <!-- Footer -->
      <div class="flex justify-end gap-2 p-4 border-t">
        <button
          @click="close"
          :disabled="importing"
          class="rounded-md border px-4 py-2 text-sm disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          @click="doImport"
          :disabled="importing || !text.trim()"
          class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
        >
          {{ importing ? 'Importing...' : 'Import' }}
        </button>
      </div>
    </div>
  </div>
</template>
