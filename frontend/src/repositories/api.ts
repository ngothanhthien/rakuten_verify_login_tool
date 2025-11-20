import axios from 'axios'
import type { Pagination } from '../types'
import type { Credential } from '../types'

export async function importCredentials(file: File) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await axios.post('/api/credentials/import', formData)
  return response.data
}

export async function listCredentials(params: Record<string, string>) {
  const response = await axios.get('/api/credentials/list', {
    params
  })

  return response.data as Pagination<Credential>
}

export async function startCheck() {
  const response = await axios.post('/api/credentials/start-check')

  return response.data
}

export async function stopCheck() {
  const response = await axios.post('/api/credentials/stop-check')

  return response.data
}

export async function getCheck() {
  const response = await axios.get('/api/credentials/get-check')

  return response.data as boolean
}

export async function bulkDelete(ids: number[]) {
  const response = await axios.post('/api/credentials/bulk-delete', {
    ids: ids
  })

  return response.data
}
