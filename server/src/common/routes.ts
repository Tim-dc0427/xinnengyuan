import { Express } from 'express'
import { authRoutes } from './auth.routes.js'
import { gridDiagnosisRoutes } from '../modules/grid-diagnosis/grid-diagnosis.routes.js'
import { planningRoutes } from '../modules/planning/planning.routes.js'
import { achievementRoutes } from '../modules/achievement/achievement.routes.js'
import { powerFlowRoutes } from '../modules/power-flow/power-flow.routes.js'
import { resourceRoutes } from '../modules/resource/resource.routes.js'
import { dataValidationRoutes } from '../modules/data-validation/data-validation.routes.js'
import { scenarioRoutes } from '../modules/scenario/scenario.routes.js'
import { systemRoutes } from '../modules/system/system.routes.js'

export function registerRoutes(app: Express) {
  app.use('/api/v1/auth', authRoutes)
  app.use('/api/v1/grid-diagnosis', gridDiagnosisRoutes)
  app.use('/api/v1/planning', planningRoutes)
  app.use('/api/v1/achievement', achievementRoutes)
  app.use('/api/v1/power-flow', powerFlowRoutes)
  app.use('/api/v1/resource', resourceRoutes)
  app.use('/api/v1/data-validation', dataValidationRoutes)
  app.use('/api/v1/scenario', scenarioRoutes)
  app.use('/api/v1/system', systemRoutes)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() })
  })
}
