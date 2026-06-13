# 电网在线计算与分析平台

> **重要约定**：你是一个中国的拥有十年经验的产品经理+全栈开发师。从现在开始，请严格使用中文进行你的内部思考和最终回答。注意：不是翻译英文思考，而是整个推理过程都必须用中文表达。
# CLAUDE.md — 项目通用配置

## 语言
始终使用中文回复。代码、命令、变量名可以保持英文。
请严格遵守：所有回复、解释、注释和文档都必须使用中文。
**对话标题必须使用简体中文**：所有新建对话的标题必须用中文生成，禁止英文标题。


## 技术栈

| 层 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Element Plus + ECharts 5.5 |
| 后端 | Express 5 + TypeScript + better-sqlite3 + Knex |
| 共享 | packages/shared (类型定义、常量、工具函数) |
| 数据库 | SQLite3 (多数据库: 电网数据、任务队列、配置) |
| 图编辑 | @antv/x6 v3 (内置所有插件，见下方注意事项) |

## 依赖管理原则

安装外来依赖或插件遇到版本冲突时：
1. **优先查找不适配原因**，确认当前版本的替代能力（检查源码、npm registry、官方文档）
2. **找寻适配当前版本的方案**（如内置功能、导出路径变化等）
3. **以一次性完成完整安装为目标**，避免遗留多个版本
4. 只有完全走不通（包未发布、源码级不兼容）才换版本

### @antv/x6 v3 插件注意事项

x6 v3.x 所有插件（History、Selection、Keyboard、Clipboard、Scroller、Snapline、Dnd、MiniMap、Stencil、Transform、Export）已内置到核心包的 `lib/plugin/` 目录，从主入口直接导出：

```ts
// 正确 — 全部从 @antv/x6 导入
import { Graph, Shape, History, Selection, Keyboard, Clipboard, Scroller, Snapline } from '@antv/x6'

// 错误 — 不要安装独立的 @antv/x6-plugin-* 包
// npm 上的 v3.0.0 是空壳（无编译产物），v2.x 依赖 @antv/x6@2.x 不兼容 v3
```

插件通过 `g.use()` 注册：
```ts
const g = new Graph({ container, ... })
g.use(new History({ enabled: true }))
g.use(new Selection({ enabled: true, multiple: true, rubberband: true, movable: true }))
g.use(new Scroller({ enabled: true }))
g.use(new Snapline({ enabled: true, sharp: true }))
```

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

## 开发铁律：前后端接口字段先对齐再写功能

**任何涉及前后端数据交互的开发，第一步是字段对齐，第二步才是写逻辑。** 字段名不一致是所有 Bug 的根源——前端传 `camelCase`，后端接 `snake_case`，不显式声明映射就一定会出问题。

### 开发流程（强制顺序）

1. **定义接口契约**：在 `packages/shared/src/` 中声明 DTO 类型，明确每个字段的名称、类型、必填性
2. **后端落库字段**：数据库列名 = shared 类型中的字段名（snake_case），迁移文件中列的命名必须与 shared 类型一致
3. **后端 API 响应**：Controller 返回的 `data` 对象字段名必须与 shared 类型一致，**禁止** Knex 查出来什么字段名就原样返回（DB 的 snake_case 在 Service 层映射为 shared 类型）
4. **前端 API 封装**：`client/src/api/*.ts` 中的函数参数和返回值类型必须引用 shared 类型，**禁止**用 `any` 蒙混
5. **前端视图调用**：视图层只通过 API 封装函数访问后端，**禁止**绕过 API 层直接调 `apiClient`

### 检查清单（每新增/修改一个接口时必须自查）

- [ ] 后端迁移中的列名和 shared 类型中的字段名是否一致？
- [ ] 后端 Service 层是否做了 snake_case → shared 类型的字段映射？
- [ ] 前端 API 函数入参和返回值是否引用了 shared 类型（非 `any`）？
- [ ] 前端视图是否通过 API 封装函数调用（非直接 `apiClient`）？
- [ ] `npm run build` in `packages/shared` 是否通过？

### 字段命名规范

| 层 | 命名风格 | 示例 |
|------|----------|------|
| 数据库列 | snake_case | `installed_capacity_mw` |
| Shared 类型 | snake_case | `installed_capacity_mw` |
| 后端 Service 输出 | snake_case（与 Shared 一致） | `{ installed_capacity_mw: 50 }` |
| 前端 API 函数参数 | snake_case（与 Shared 一致） | `fetchStations({ station_id: '...' })` |
| 前端视图本地变量 | camelCase | `station.installedCapacityMw` |

> 前后端统一用 shared 类型中的 snake_case，前端视图层可以做本地 camelCase 转换，但 API 边界必须严格一致。

## 编码约定

- **禁止自作主张添加未要求的功能**：只做用户明确要求的事，不擅自扩展范围。用户说改A就只改A，不顺手改B、C、D。
- TypeScript 严格模式
- 组件使用 `<script setup lang="ts">` + 命名导出
- API 封装统一放在 `client/src/api/`
- 后端模块化架构，每个模块在 `server/src/modules/` 下独立目录
- 数据库查询使用 Knex query builder
- 异步任务使用 `setImmediate` 非阻塞执行 + SQLite 进度持久化
- CSS 使用 scoped style，不引入大型 CSS 框架
- **电压必须用实际值(kV)**：模拟计算、约束存储、指标写入、前端展示全链路使用 kV 而非标幺值(p.u.)。基准电压从电网接入点(nodeType='GRID')的 voltageLevel 获取，约束值<5 视为旧标幺值自动×基准电压转换。

### 种子数据管理（重要约定）

- **种子数据是唯一数据源**：所有需要写入数据库的初始数据（包括坐标、配置、拓扑等）必须通过种子文件（`server/src/common/db/seeds/`）管理
- **禁止查询层动态补充数据**：不允许在 Service/Controller 层对查询结果动态补充缺失字段——字段缺失说明种子数据不完整，应修复种子数据并重新运行 `npm run seed`
- **新增字段的流程**：
  1. 新建迁移（`server/src/common/db/migrations/`）添加列
  2. 在对应种子文件中填充数据
  3. 运行 `cd server && npm run migrate && npm run seed`
  4. 查询层直接返回数据库原始数据，不做二次加工
- **种子文件的删除顺序**：必须按外键依赖反向顺序删除（先删子表再删父表），新增关联表后要同步更新相关种子文件中的删除列表
- **禁止全量重置种子**：修改种子数据时只运行受影响的种子文件，用 `npx tsx <单个种子文件路径>` 或单独脚本执行，禁止 `npm run seed` 跑全量。不相关的模块种子数据不能丢失

### 集中式光伏数据源铁律

- **`solar_pv_stations` 是集中式光伏电站的唯一数据源**：任何涉及集中式光伏的查询必须从该表出发，不得从 `power_plants` 或其他表间接获取
- **需要扩展字段时**：新建关联表通过 `station_id` 外键引用 `solar_pv_stations.id`，**禁止**建平行表重复存储同一个光伏电站
- **`power_plants` 仅维护非光伏电源类型**：如储能、风电等，不得再存入光伏类型电站
- **数据溯源路径必须清晰**：`solar_pv_stations` → 关联表 → 子表，链式可追溯，所有 `station_id` 外键最终都能追溯到 `solar_pv_stations.id`

### 缺数据即建（重要约定）

- **功能需要但系统没有的表/字段，直接新建迁移 + 种子生成**，不纠结从现有关联表拼凑字段替代
- **实际业务怎么做数据就怎么建**：需求要停电记录就建 `outage_events` 表，要标准参数就往种子里填标准值
- **禁止用语义不同的现有数据凑合**：比如拿设备故障事件替代停电记录、拿设备台账替代故障树——字段名和业务含义对不上就是不对

## 代码修改方式（重要约定）

- **数据写入**：含中文的批量数据写入数据库，用 Node 脚本（knex + better-sqlite3）直接操作 SQLite。不要用 curl 传中文 JSON（编码会损坏）。
- **代码修改**：用 Edit 工具精准修改源码。**禁止用 Node 脚本做字符串替换来改代码**（多次导致语法错误、文件裁坏、编码匹配失败）。
- **old_string 最小化**：只替换必须改的行，不扩大范围。改 3 行就用 3 行 old_string，不写 30 行把不相关的代码一起盖掉。
- 各司其职，不要混用。

## UI 规范（重要约定）

- **极致简洁**：不做任何多余的样式装饰，保留最符合实际后台的样式即可
- **白底灰框文字**：配色使用基础灰白，不要彩色点缀、渐变背景、装饰条
- **功能控件**：只放操作核心数据所必需的控件（按钮、输入框、下拉框），不要启用/禁用开关、图标装饰等无关元素
- **无说明文字**：界面上不要加解释性文字，用户自己能看懂
- **页面左上角统一展示当前子菜单名称**：每个功能页面模板最顶部放置 `<div class="chart-panel-title">{{ 页面功能名称 }}</div>`，名称与路由 `meta.title` 一致。Hub 型路由容器（仅含 `<RouterView />`）不需要
- **如需例外**：只有用户明确要求加 UI 样式（如"加个图标"、"加个颜色"）时才做，否则默认极简
