<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="min-h-screen">
    <header class="border-b bg-background">
      <div class="container mx-auto px-6 py-4 flex items-center justify-between">
        <div class="font-semibold tracking-tight">Rakuten</div>
        <nav class="flex items-center gap-3 text-sm">
          <RouterLink to="/" class="text-muted-foreground hover:text-foreground">Credentials</RouterLink>
          <RouterLink to="/proxies" class="text-muted-foreground hover:text-foreground">Proxies</RouterLink>
          <RouterLink to="/settings" class="text-muted-foreground hover:text-foreground">Settings</RouterLink>
        </nav>
      </div>
    </header>

    <main class="p-4">
      <RouterView />
    </main>
  </div>
</template>
