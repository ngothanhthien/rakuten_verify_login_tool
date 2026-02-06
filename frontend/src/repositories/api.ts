import axios from 'axios'
import type { Pagination, CredentialStatistics } from '../types'
import type { Credential } from '../types'
import type { Setting } from '../types'
import type { Proxy } from '../types'

export async function importCredentials(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await createAxios({ 'Content-Type': 'multipart/form-data' })
                            .post('/api/credentials/import', formData)
  return response.data
}

export async function listCredentials(params: Record<string, string>) {
  const response = await createAxios().get('/api/credentials/list', {
    params
  })

  return response.data as Pagination<Credential>
}

export async function startCheck() {
  const response = await createAxios().post('/api/credentials/start-check')

  return response.data
}

export async function stopCheck() {
  const response = await createAxios().post('/api/credentials/stop-check')

  return response.data
}

export async function getCheck() {
  const response = await createAxios().get('/api/credentials/get-check')

  return response.data as boolean
}

export async function bulkDelete(ids: number[]) {
  const response = await createAxios().post('/api/credentials/bulk-delete', {
    ids: ids
  })

  return response.data
}

export async function deleteUnchecked() {
  const response = await createAxios().post('/api/credentials/delete-unchecked')

  return response.data as { message: string; deletedCount: number }
}

export async function exportActiveCredentials() {
  const response = await createAxios().get('/api/credentials/export', {
    responseType: 'blob'
  })

  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'credentials.txt')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

export async function getStatistics() {
  const response = await createAxios().get('/api/credentials/statistics')
  return response.data as CredentialStatistics
}

export async function listSettings(params?: { group?: string }) {
  const response = await createAxios().get('/api/settings/list', { params })
  return response.data as Setting[]
}

export async function getSetting(key: string) {
  const response = await createAxios().get('/api/settings/get', { params: { key } })
  return response.data as Setting
}

export async function saveSetting(setting: Setting) {
  const response = await createAxios().post('/api/settings/save', setting)
  return response.data as Setting
}

export async function listProxies() {
  const response = await createAxios().get('/api/proxies/list')
  return response.data as Proxy[]
}

export async function updateProxy(
  id: number,
  payload: { server?: string; username?: string | null; password?: string | null; status?: Proxy['status'] },
) {
  const response = await createAxios().post('/api/proxies/update', { id, ...payload })
  return response.data as Proxy
}

export async function deleteProxy(id: number) {
  const response = await createAxios().post('/api/proxies/delete', { id })
  return response.data as { message: string }
}

export async function testProxy(id: number) {
  const response = await createAxios().post('/api/proxies/test', { id })
  return response.data as {
    ok: boolean
    statusCode?: number
    ip?: string
    error?: string
    elapsedMs: number
  }
}

export async function bulkImportProxies(proxies: string): Promise<{
  created: number
  updated: number
  skipped: number
  errors: Array<{ line: number, raw: string, error: string }>
}> {
  const response = await createAxios().post('/api/proxies/bulk-import', { proxies });
  return response.data;
}

export async function deleteAllProxies(): Promise<{ message: string; count: number }> {
  const response = await createAxios().post('/api/proxies/delete-all')
  return response.data
}

function createAxios(headers?: Record<string, string>) {
  return axios.create({
    baseURL: 'http://localhost:3000',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers
    },
  })
}
