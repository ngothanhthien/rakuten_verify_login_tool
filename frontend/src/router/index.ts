// src/router/index.ts
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import HomePage from '@/pages/HomePage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'
import ProxiesPage from '@/pages/ProxiesPage.vue'
import RatsPage from '@/pages/RatsPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomePage,
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
  },
  {
    path: '/proxies',
    name: 'proxies',
    component: ProxiesPage,
  },
  {
    path: '/rats',
    name: 'rats',
    component: RatsPage,
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})
