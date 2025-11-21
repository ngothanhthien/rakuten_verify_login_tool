import { Express } from 'express'
import { Router } from 'express'
import { makeClassInvoker } from 'awilix-express'
import CredentialController from './CredentialController'
import multer from 'multer'

export function registerRoutes(app: Express) {
  const router = Router()

  const api = makeClassInvoker(CredentialController)
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

  app.use('/api', router)
}
