import type { Request, Response } from 'express'
import { TopologyService } from './topology.service.js'

const service = new TopologyService()

export class TopologyController {
  // ==================== Topology ====================
  async getPvGridTopology(_req: Request, res: Response) {
    try {
      const data = await service.getPvGridTopology()
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '获取拓扑数据失败' })
    }
  }

  // ==================== 节点查询 ====================
  async listAvailableNodesByType(req: Request, res: Response) {
    try {
      const data = await service.listAvailableNodesByType(req.params.type)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '获取节点列表失败' })
    }
  }

  async listAvailableNodesByTypeBatch(req: Request, res: Response) {
    try {
      const typesStr = req.query.types as string
      if (!typesStr) return res.status(400).json({ code: 400, message: '缺少参数 types' })
      const types = typesStr.split(',').map((t) => t.trim()).filter(Boolean)
      const data = await service.listAvailableNodesByTypeBatch(types)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '批量获取节点列表失败' })
    }
  }

  async createSourceNode(req: Request, res: Response) {
    try {
      const data = await service.createSourceNode(req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '创建电站失败' })
    }
  }

  async createGridNode(req: Request, res: Response) {
    try {
      const data = await service.createGridNode(req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '创建母线失败' })
    }
  }

  // ==================== 连接关系 ====================
  async listConnectionAttrs(req: Request, res: Response) {
    try {
      const data = await service.listConnectionAttrs({
        sourceNodeType: req.query.sourceNodeType as string,
        targetNodeType: req.query.targetNodeType as string,
        page: req.query.page ? Number(req.query.page) : undefined,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      })
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '获取关联属性失败' })
    }
  }

  async createConnectionAttr(req: Request, res: Response) {
    try {
      const data = await service.createConnectionAttr(req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '创建关联属性失败' })
    }
  }

  async updateConnectionAttr(req: Request, res: Response) {
    try {
      const data = await service.updateConnectionAttr(req.params.id, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '更新关联属性失败' })
    }
  }

  async deleteConnectionAttr(req: Request, res: Response) {
    try {
      await service.deleteConnectionAttr(req.params.id)
      res.json({ code: 200, message: 'ok', data: null })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '删除关联属性失败' })
    }
  }

  // ==================== 负荷实体 ====================
  async listLoadEntities(req: Request, res: Response) {
    try {
      const data = await service.listLoadEntities({
        loadType: req.query.loadType as string,
        zone: req.query.zone as string,
      })
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '获取负荷列表失败' })
    }
  }

  async getLoadEntity(req: Request, res: Response) {
    try {
      const data = await service.getLoadEntity(req.params.id)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '获取负荷详情失败' })
    }
  }

  async createLoadEntity(req: Request, res: Response) {
    try {
      const data = await service.createLoadEntity(req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '创建负荷失败' })
    }
  }

  async updateLoadEntity(req: Request, res: Response) {
    try {
      const data = await service.updateLoadEntity(req.params.id, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '更新负荷失败' })
    }
  }

  async deleteLoadEntity(req: Request, res: Response) {
    try {
      await service.deleteLoadEntity(req.params.id)
      res.json({ code: 200, message: 'ok', data: null })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '删除负荷失败' })
    }
  }

  // ==================== 储能实体 ====================
  async listStorageEntities(req: Request, res: Response) {
    try {
      const data = await service.listStorageEntities({
        storageType: req.query.storageType as string,
        zone: req.query.zone as string,
      })
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '获取储能列表失败' })
    }
  }

  async getStorageEntity(req: Request, res: Response) {
    try {
      const data = await service.getStorageEntity(req.params.id)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '获取储能详情失败' })
    }
  }

  async createStorageEntity(req: Request, res: Response) {
    try {
      const data = await service.createStorageEntity(req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '创建储能失败' })
    }
  }

  async updateStorageEntity(req: Request, res: Response) {
    try {
      const data = await service.updateStorageEntity(req.params.id, req.body)
      res.json({ code: 200, message: 'ok', data })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '更新储能失败' })
    }
  }

  async deleteStorageEntity(req: Request, res: Response) {
    try {
      await service.deleteStorageEntity(req.params.id)
      res.json({ code: 200, message: 'ok', data: null })
    } catch (e: any) {
      res.status(500).json({ code: 500, message: e.message || '删除储能失败' })
    }
  }
}
