import { Express } from 'express'
import { Router } from 'express'
import { makeClassInvoker } from 'awilix-express'
import CredentialController from './CredentialController'
import SettingController from './SettingController'
import ProxyController from './ProxyController'
import multer from 'multer'

export function registerRoutes(app: Express) {
  const router = Router()

  const api = makeClassInvoker(CredentialController)
  const settingsApi = makeClassInvoker(SettingController)
  const proxiesApi = makeClassInvoker(ProxyController)
  const upload = multer({ storage: multer.memoryStorage() })

  router.post('/credentials/import', upload.single('file'), api('import'))
  router.get('/credentials/export', api('export'))
  router.get('/credentials/list', api('list'))
  router.get('/credentials/statistics', api('statistics'))
  router.post('/credentials/start-check', api('startCheck'))
  router.post('/credentials/stop-check', api('stopCheck'))
  router.get('/credentials/get-check', api('getCheck'))
  router.post('/credentials/bulk-delete', api('bulkDelete'))
  router.post('/credentials/delete-unchecked', api('deleteUnchecked'))

  router.get('/settings/list', settingsApi('list'))
  router.get('/settings/get', settingsApi('get'))
  router.post('/settings/save', settingsApi('save'))

  router.get('/proxies/list', proxiesApi('list'))
  router.get('/proxies/get', proxiesApi('get'))
  router.post('/proxies/create', proxiesApi('create'))
  router.post('/proxies/update', proxiesApi('update'))
  router.post('/proxies/delete', proxiesApi('delete'))
  router.post('/proxies/test', proxiesApi('test'))
  router.post('/proxies/bulk-import', proxiesApi('bulkImport'))

  app.use('/api', router)
}
