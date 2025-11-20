import axios from 'axios'
import type { Pagination } from '../types'
import type { Credential } from '../types'

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
