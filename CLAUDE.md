# 电网在线计算与分析平台

> **重要约定**：你是一个中国的拥有十年经验的产品经理+全栈开发师。从现在开始，请严格使用中文进行你的内部思考和最终回答。注意：不是翻译英文思考，而是整个推理过程都必须用中文表达。
# CLAUDE.md — 项目通用配置

## 语言
始终使用中文回复。代码、命令、变量名可以保持英文。
请严格遵守：所有回复、解释、注释和文档都必须使用中文。


## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Element Plus + ECharts 5.5 |
| 后端 | Express 5 + TypeScript + better-sqlite3 + Knex |
| 共享 | packages/shared (类型定义、常量、工具函数) |
| 数据库 | SQLite3 (多数据库: 电网数据、任务队列、配置) |

## 项目结构 (Monorepo)

```
e:\test\
├── client/                 # Vue 3 前端
│   └── src/
│       ├── api/            # API 请求封装
│       ├── components/     # 公共组件
│       │   ├── calculation/   # CalcProgress.vue (任务进度)
│       │   ├── common/        # ChartContainer.vue (ECharts 容器)
│       │   └── power-flow/    # PowerFlowTopology.vue (拓扑图)
│       ├── composables/    # 组合式函数 (useTaskProgress.ts)
│       ├── router/         # 路由配置 (28+ 路由)
│       ├── stores/         # Pinia 状态管理
│       └── views/          # 页面视图
│           ├── power-flow/ # 潮流计算 4 个子页面
│           ├── relay/      # 继电保护
│           ├── stability/  # 稳定分析
│           └── .../
├── server/                 # Express 后端
│   └── src/
│       ├── modules/        # 功能模块 (6 个)
│       │   ├── power-flow/ # 潮流计算引擎 (NR 法)
│       │   ├── grid-diagnosis/
│       │   ├── planning/
│       │   ├── achievement/
│       │   ├── resource/
│       │   └── data-validation/
│       ├── database/       # 迁移 + 种子 + 数据库管理
│       ├── middleware/      # 认证、错误处理等
│       └── routes/         # 路由注册
└── packages/shared/        # 共享类型与工具
```

## 服务端架构

### 数据库
- 多数据库文件: `grid.db` (电网数据), `tasks.db` (任务队列), `config.db` (配置)
- 9 个迁移文件: 001_initial_schema ~ 009_solar_pv_stations
- 5 个种子文件: 001_seed_data ~ 005_solar_pv_stations

### 潮流计算引擎
- 自定义 Newton-Raphson 实现 (非调用外部求解器)
- Y-bus 导纳矩阵构建 + Jacobian 矩阵 + 高斯消元
- PQ / PV / Slack 节点类型支持
- 4 种计算模式:
  - **标准潮流**: 单次 NR 迭代求解
  - **三相潮流**: 3 路独立 NR 求解，每相分配 load/gen 比例，Fortescue 变换计算 VUF
  - **概率潮流**: Monte Carlo 模拟 (Box-Muller 变换)，统计均值/方差/概率分布
  - **反向潮流**: 调整 PV 节点出力进行反向功率映射
- 3 种场景模式:
  - **normal**: 原始拓扑 + 原始出力
  - **fault (N-1)**: 断开指定支路后重新计算
  - **solar (光伏接入)**: 从 `solar_pv_stations` + `pv_output_measurements` 查实际出力数据，替换对应母线发电机 Pg
- 异步执行: `setImmediate` 循环 + `BetterSqlite3` 轮询进度

### 认证
- JWT (jsonwebtoken)，开发模式支持 `x-device-id` 绕过
- 中间件: `authenticate`, `requireRole`
- 角色: admin, engineer, viewer

### 已安装依赖
- express 5, cors, helmet, morgan, compression
- better-sqlite3, knex, sqlite3
- jsonwebtoken, bcryptjs, multer, exceljs
- zod, dayjs, winston, uuid, dotenv
- typescript, tsx, vitest, supertest

## 客户端架构

### 路由 (部分)
| 路径 | 页面 | 权限 |
|------|------|------|
| `/` | 首页 | public |
| `/login` | 登录 | public |
| `/power-flow/standard` | 标准潮流计算 | auth |
| `/power-flow/reverse` | 反向潮流计算 | auth |
| `/power-flow/probabilistic` | 概率潮流计算 | auth |
| `/power-flow/three-phase` | 三相不平衡计算 | auth |
| `/relay/` | 继电保护整定 | auth |
| `/stability/` | 稳定分析 | auth |
| `/grid-diagnosis/online-monitor` | 在线监测 | auth |
| `/grid-diagnosis/fault-analysis` | 故障分析 | auth |
| 共 28+ 路由，覆盖电网诊断、规划、评估、资料、资源等模块 |

### 关键组件
- **ChartContainer.vue**: ECharts 统一封装，已注册 GraphChart/LineChart/BarChart/PieChart/ScatterChart/RadarChart/GaugeChart/HeatmapChart
- **CalcProgress.vue**: 异步任务进度条，支持暂停/继续
- **PowerFlowTopology.vue**: 电网拓扑力导向图，节点按电压等级着色，边按负载率着色，悬浮 tooltip + 点击详情抽屉
- **ResultSummary.vue**: 计算结果摘要卡片

### 已安装依赖
- vue 3, vue-router 4, pinia, pinia-plugin-persistedstate
- element-plus, @element-plus/icons-vue
- echarts 5.5, vue-echarts
- axios, dayjs, wangeditor, @vueuse/core
- typescript, vite, sass, unplugin-auto-import

## 开发工作流

```bash
# 安装依赖 (根目录)
npm install

# 启动服务端
cd server && npm run dev

# 启动客户端
cd client && npm run dev

# 数据库迁移
cd server && npm run migrate

# 类型检查
cd client && npx vue-tsc --noEmit

# 构建
cd client && npm run build
```

### 数据流
1. 前端提交计算参数 → `POST /api/power-flow/*` 返回 `taskId`
2. 后端创建任务记录 → 异步执行计算 → 每步更新 DB 进度
3. 前端轮询 `GET /api/power-flow/tasks/:taskId/progress` (1s 间隔)
4. 计算完成 → 前端 `GET /api/power-flow/tasks/:taskId/result` 获取结果
5. 结果包含: `summary` (概要), `node_results` (节点数据), `branch_results` (支路数据)

## 编码约定

- TypeScript 严格模式
- 组件使用 `<script setup lang="ts">` + 命名导出
- API 封装统一放在 `client/src/api/`
- 后端模块化架构，每个模块在 `server/src/modules/` 下独立目录
- 数据库查询使用 Knex query builder
- 异步任务使用 `setImmediate` 非阻塞执行 + SQLite 进度持久化
- CSS 使用 scoped style，不引入大型 CSS 框架

### 种子数据管理（重要约定）

- **种子数据是唯一数据源**：所有需要写入数据库的初始数据（包括坐标、配置、拓扑等）必须通过种子文件（`server/src/common/db/seeds/`）管理
- **禁止查询层动态补充数据**：不允许在 Service/Controller 层对查询结果动态补充缺失字段——字段缺失说明种子数据不完整，应修复种子数据并重新运行 `npm run seed`
- **新增字段的流程**：
  1. 新建迁移（`server/src/common/db/migrations/`）添加列
  2. 在对应种子文件中填充数据
  3. 运行 `cd server && npm run migrate && npm run seed`
  4. 查询层直接返回数据库原始数据，不做二次加工
- **种子文件的删除顺序**：必须按外键依赖反向顺序删除（先删子表再删父表），新增关联表后要同步更新相关种子文件中的删除列表

## UI 规范（重要约定）

- **极致简洁**：不做任何多余的样式装饰，保留最符合实际后台的样式即可
- **白底灰框文字**：配色使用基础灰白，不要彩色点缀、渐变背景、装饰条
- **功能控件**：只放操作核心数据所必需的控件（按钮、输入框、下拉框），不要启用/禁用开关、图标装饰等无关元素
- **无说明文字**：界面上不要加解释性文字，用户自己能看懂
- **如需例外**：只有用户明确要求加 UI 样式（如"加个图标"、"加个颜色"）时才做，否则默认极简
