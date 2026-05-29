import { db } from '../../config/database.js'

export class AchievementService {
  async listProjects(query: { status?: string; projectType?: string }) {
    return db('projects').modify((qb) => {
      if (query.status) qb.where('status', query.status)
      if (query.projectType) qb.where('project_type', query.projectType)
    }).orderBy('created_at', 'desc')
  }

  async createProject(data: any, userId: string) {
    const [project] = await db('projects').insert({
      project_code: data.projectCode,
      project_name: data.projectName,
      project_type: data.projectType,
      pv_type: data.pvType,
      plan_id: data.planId,
      capacity_kw: data.capacityKw,
      budget: data.budget,
      custom_fields: data.customFields ? JSON.stringify(data.customFields) : '{}',
      created_by: userId,
    }).returning('*')
    return project
  }

  async updateProject(id: string, data: any) {
    const [project] = await db('projects').where('id', id).update({
      project_name: data.projectName,
      status: data.status,
      actual_cost: data.actualCost,
      actual_completion_date: data.actualCompletionDate,
      updated_at: new Date().toISOString(),
    }).returning('*')
    return project
  }

  async getAccessConditions(projectId: string) {
    return db('access_conditions').where('project_id', projectId)
  }

  async setAccessConditions(projectId: string, conditions: any[]) {
    await db('access_conditions').where('project_id', projectId).delete()
    if (conditions.length > 0) {
      await db('access_conditions').insert(
        conditions.map((c) => ({
          project_id: projectId,
          condition_type: c.conditionType,
          requirement: c.requirement,
          actual_value: c.actualValue,
          is_satisfied: c.isSatisfied,
        })),
      )
    }
    return this.getAccessConditions(projectId)
  }

  async runFeasibility(projectId: string, weights?: any) {
    const w = weights || { technical: 0.35, economic: 0.30, environmental: 0.20, social: 0.15 }
    const scores = {
      technicalScore: 75 + Math.random() * 20,
      economicScore: 70 + Math.random() * 20,
      environmentalScore: 80 + Math.random() * 15,
      socialScore: 65 + Math.random() * 25,
    }
    const comprehensive =
      scores.technicalScore * w.technical +
      scores.economicScore * w.economic +
      scores.environmentalScore * w.environmental +
      scores.socialScore * w.social

    const [result] = await db('feasibility_assessments')
      .insert({
        project_id: projectId,
        technical_score: scores.technicalScore,
        economic_score: scores.economicScore,
        environmental_score: scores.environmentalScore,
        social_score: scores.socialScore,
        comprehensive_score: comprehensive,
      })
      .onConflict('project_id')
      .merge()
      .returning('*')

    return result
  }

  async getFeasibility(projectId: string) {
    return db('feasibility_assessments').where('project_id', projectId).first()
  }

  async verifyEffectiveness(projectId: string, data: any) {
    const [verification] = await db('effectiveness_verifications').insert({
      project_id: projectId,
      verification_date: new Date().toISOString(),
      planned_output_kwh: data.plannedOutputKwh,
      actual_output_kwh: data.actualOutputKwh,
      absorption_rate_pct: data.absorptionRatePct,
      voltage_compliance_pct: data.voltageCompliancePct,
      is_effective: data.isEffective,
      remarks: data.remarks,
    }).returning('*')
    return verification
  }

  async traceHistory(projectId: string) {
    return db('project_audit').where('project_id', projectId).orderBy('created_at', 'desc')
  }
}
