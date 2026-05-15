# 技术栈

## 客户端（Client）

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | React 18 | UI 框架 |
| 语言 | TypeScript | ESM 模式，target ES2020 |
| 构建 | Vite 4 + SWC | 开发服务器端口 5678，SWC 编译 React |
| UI 组件库 | Ant Design 5 | 表格、树等高级组件 |
| CSS 方案 | Tailwind CSS 3 + CVA | 实用优先样式，CVA 管理组件变体 |
| CSS 工具 | clsx + tailwind-merge | 条件类名拼接与智能合并 |
| Radix UI | AlertDialog、Progress | 无障碍弹窗和进度条 |
| 路由 | react-router-dom v6 | 客户端路由（/home、/model、/fvcom） |
| 状态管理 | Zustand + Immer | 轻量状态管理，Immer 处理不可变更新 |
| 地图 | Mapbox GL JS 2 | Web 地图引擎，含 Draw 绘制工具和自定义 WebGL 图层（流场可视化） |
| 图表 | ECharts 5 | 模型数据可视化（时间序列、群组图等） |
| 图可视化 | @antv/g6 4 | 生态模型流程图/网络图 |
| HTTP | fetch + Axios | 自定义 fetch 封装（超时、重试），Axios 用于 EWE store |
| 运行时校验 | @sinclair/typebox | 与后端共用模式定义 |
| 测试 | Vitest + jsdom | 浏览器环境模拟 |
| 格式化 | ESLint + Prettier | standard 规范，Tailwind 类排序插件 |

## 服务端（Server）

| 类别 | 技术 | 说明 |
|------|------|------|
| 框架 | Fastify 4 | ESM 模式，端口 3456 |
| 语言 | TypeScript | strict 模式，target ES2020 |
| 运行时校验 | @sinclair/typebox | 请求/响应模式验证，与 Fastify 类型提供者集成 |
| ORM | Prisma 5 | 连接 PostgreSQL |
| 数据库 | PostgreSQL | 关系型数据库 |
| 生产构建 | esbuild | 打包压缩输出 ESM 至 dist/ |
| 开发热重载 | tsx watch | TypeScript 开发服务器 |
| Fastify 插件 | cors、helmet、formbody、multipart | 跨域、安全头、表单解析、文件上传（最大 1GB） |
| 进程执行 | execa 8 | 调用外部命令/脚本 |
| CSV 处理 | fast-csv 5 | CSV 解析与生成 |
| 科学计算 | Python 3 | 水动力、水质、泥沙、抛泥等科学模型脚本 |
| 地理空间 | GDAL（原生 DLL） | 地理空间数据处理（含 GEOS、NetCDF、PROJ） |
| 测试 | Vitest + v8 coverage | 单元测试与覆盖率 |
| 格式化 | ESLint + Prettier | standard 规范 |
