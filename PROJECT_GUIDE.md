# Yuki-zik 项目补充说明（开发与运维指南）

> 本文件用于补充 `README.md`，并以不同文件名存放，避免直接作为仓库首页主说明展示。

## 1. 项目定位

该项目是一个 GitHub 年报自动生成系统，目标是定期产出可直接展示在个人主页的年度报告资产，核心产物包括：

- 年报图片：`assets/github-annual-report.png`
- 兼容 SVG：`assets/github-annual-report.svg`
- 数据快照：`assets/github-annual-report.json`

项目同时支持本地手动生成与 GitHub Actions 定时更新。

## 2. 核心功能

- 拉取 GitHub GraphQL 年度贡献数据（贡献日历、仓库贡献、语言分布、Issues 参与数）。
- 计算年度统计指标（总贡献、日均、最长连续、最长空窗、月度/周度分布等）。
- 生成 AI 年度总结（失败时自动降级为规则模板文案）。
- 渲染高分辨率年报 PNG，并封装为 GitHub 兼容的 PNG 内嵌 SVG。
- 输出 JSON 快照用于追踪运行模式、速率限制、回退原因和统计结果。

## 3. 目录结构

```text
.github/workflows/yearly-report.yml   # 自动化任务
scripts/year-report/generate-report.mjs  # 主入口
scripts/year-report/github-client.mjs    # GitHub GraphQL 客户端
scripts/year-report/stats.mjs            # 统计计算
scripts/year-report/ai-summary.mjs       # AI 与降级摘要
scripts/year-report/report-html.mjs      # 年报 HTML 模板
scripts/year-report/png-renderer.mjs     # Playwright 截图 + PNG 回退
scripts/year-report/svg-renderer.mjs     # PNG -> 内嵌 SVG
scripts/year-report/design-spec.mjs      # 画布尺寸与布局网格
scripts/year-report/__tests__/*.test.mjs # 测试
assets/                                   # 生成产物目录
```

## 4. 工作流程与逻辑设计

1. 参数解析与年份确定。
2. 拉取 GitHub 年度数据与 Issue 计数。
3. 统计聚合与排行榜计算。
4. 生成 AI 摘要（或降级摘要）。
5. 渲染 HTML -> PNG -> SVG，并写入 JSON 快照。

### 4.1 参数与时间逻辑

- CLI 参数：`--year`、`--dry-run`、`--no-ai`。
- 未指定 `--year` 时，按 `REPORT_TZ` 时区的当前年份计算。
- 当前年份统计会自动忽略“未来日期”，避免把尚未发生的日期计入空窗或贡献。

### 4.2 数据获取策略

- 使用 GitHub GraphQL API：`https://api.github.com/graphql`。
- `commitContributionsByRepository(maxRepositories: 100)` 用于仓库排行榜。
- 每个仓库读取前 20 个语言体积用于语言占比统计。
- Issue 数量通过 `search(type: ISSUE)` + `involves:<user> created:<year-range>` 聚合。

### 4.3 统计策略

`deriveYearlyStatistics` 输出完整指标集合：

1. 总贡献与有效统计天数。
2. 日均贡献。
3. 最长连续贡献区间（streak）。
4. 最长无贡献区间（gap）。
5. 单日峰值与对应日期。
6. 月度贡献数组（12 项）与周内贡献数组（7 项）。
7. 年热力图矩阵（53 周 x 7 天）。

### 4.4 摘要生成策略

- AI 模式：调用 OpenAI 兼容 `chat/completions`，要求 JSON 输出。
- 降级模式：当 `--no-ai`、缺少 `OPENAI_API_KEY`、请求失败、返回 JSON 非法时，自动使用规则文案。
- JSON 中会保留 `aiMode` 与 `aiReason`，便于追踪降级原因。
- 模板层当前只展示 `sections` 前 2 项（即使 AI/降级返回 3 项）。

### 4.5 渲染与兼容策略

- 首选 Playwright Chromium 截图生成 PNG。
- 若 Playwright 不可用或渲染失败，生成纯色回退 PNG，保证流程不中断。
- SVG 并非矢量重绘，而是把 PNG base64 内嵌到 `<image>`，提高 GitHub 展示兼容性。

### 4.6 稳定性原则

- 关键链路均有回退分支（AI 回退、PNG 回退、占位仓库/语言）。
- 快照记录 `render.mode` 与 `rateLimit`，便于排查外部依赖问题。
- 布局和统计有自动化测试，防止视觉结构与统计逻辑回归。

## 5. 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `GH_STATS_TOKEN` | 是 | 无 | GitHub Token（用于 GraphQL 拉取） |
| `GH_USERNAME` | 否 | `Yuki-zik` | 目标用户名 |
| `REPORT_TZ` | 否 | `Asia/Shanghai` | 年份与“今天”的时区基准 |
| `OPENAI_API_KEY` | 否 | 无 | AI 摘要密钥，不填则自动降级 |
| `OPENAI_BASE_URL` | 否 | `https://api.openai.com/v1` | OpenAI 兼容接口根地址 |
| `OPENAI_MODEL` | 否 | `gpt-4o-mini` | 摘要模型 |
| `REPORT_YEAR_MODE` | 否 | `current` | 目前仅支持 `current`，其它值会被忽略并警告 |

## 6. 本地使用说明

### 6.1 前置条件

- Node.js 22+
- 可用的 GitHub Token（`GH_STATS_TOKEN`）
- 若需真实截图渲染，需安装 `playwright` 或 `playwright-core`
- 若需真实截图渲染，需安装 Chromium 浏览器：`npx playwright install chromium`

### 6.2 运行命令

```bash
# 干跑：只输出摘要，不写入 assets
node scripts/year-report/generate-report.mjs --dry-run

# 指定年份生成
node scripts/year-report/generate-report.mjs --year 2025

# 禁用 AI 摘要
node scripts/year-report/generate-report.mjs --year 2025 --no-ai
```

### 6.3 测试命令

```bash
node --test scripts/year-report/__tests__/*.test.mjs
```

## 7. 自动化工作流

文件：`.github/workflows/yearly-report.yml`

触发方式：

1. 定时：`cron: "15 2 * * 1"`（UTC 每周一 02:15）。
2. 手动：`workflow_dispatch`，可选输入 `year` 和 `no_ai`。

任务流程：

1. `Checkout`。
2. `Setup Node 22`。
3. 安装 Playwright Chromium。
4. 运行生成脚本。
5. 若产物有变更，自动提交并推送更新。

## 8. 输出产物说明

### 8.1 `assets/github-annual-report.png`

最终展示主图，可能来源于：

- `playwright` 真正渲染截图
- 回退纯色图（渲染失败时）

### 8.2 `assets/github-annual-report.svg`

PNG 的兼容封装文件，内部 `<image href="data:image/png;base64,...">`。

### 8.3 `assets/github-annual-report.json`

运行快照，关键字段包括：

- `generatedAt`：生成时间
- `year` / `timezone` / `username`
- `stats` / `issuesCount` / `topRepos` / `topLanguages`
- `aiMode` / `aiReason`
- `render.mode` / `render.reason`
- `rateLimit`：GitHub GraphQL 剩余额度信息

## 9. 常见问题与排查

- 报错 `GH_STATS_TOKEN is required`：未设置 GitHub Token。
- AI 总是 fallback：检查 `OPENAI_API_KEY`、`OPENAI_BASE_URL`、模型名、网络可达性。
- 只有纯色 PNG：Playwright 或 Chromium 不可用，查看 JSON 的 `render.reason`。
- 仓库/语言为空：当年贡献数据不足，会自动填充占位项，这是预期行为。

## 10. 维护建议

- 若调整版式，请先改 `design-spec.mjs`，再联动更新 `report-html.mjs`。
- 若调整统计口径，请同步更新 `stats.test.mjs` 以锁定行为。
- 若变更 AI 输出结构，请同步检查模板对 `sections` 的消费数量。
