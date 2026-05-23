<p align="center">
  <img src="finance-anything-landing/assets/finance-anything-hero.png" alt="Finance Anything - universal decision assistant" width="960" />
</p>

# Finance Anything

**Finance Anything** 是一个面向“买不买、投不投、值不值”的万能决策助手。它把用户的一句话目标转成一个多 Agent 协作工作空间：不同专业 Agent 分别完成信息采集、证据可信度审查、成本收益分析、风险评估、替代方案、股票/商品/二手价值专项分析、反方辩论和最终 HTML 决策报告。

本项目是 **[Paperclip](https://github.com/paperclipai/paperclip)** 的一个产品化分支。我们保留 Paperclip 的多 Agent 协作、任务、目标、项目、权限和本地运行能力，并在此基础上改造成 Finance Anything 的中文优先、多用户、低门槛决策工作台。

English version is available below: [English README](#english).

## 当前状态

- 已部署为独立 Finance Anything 服务，不依赖 MyOPC 入口。
- 支持用户用“用户名 + 密码”快速注册。
- 注册后自动初始化个人 Finance Anything 工作空间。
- 每个用户默认获得 13 个专业决策 Agent。
- 默认执行引擎切换为 OpenCode。
- 默认模型使用小米 Tokenplan 兼容端点下可用的 MiMo V2.5 Pro 模型 ID：`xiaomi/mimo-v2.5-pro`。
- Landing 页面、注册登录、工作台、任务创建、多 Agent 协作和最终报告智能体已经打通。

## 产品定位

Finance Anything 希望成为一个“万能支付/购买/投资决策入口”。用户不用理解复杂的 Agent 系统，也不需要配置模型、工作区或权限；只要提出一个目标，例如：

- “我现在适合买入某只股票吗？”
- “这台二手设备是否值得入手？”
- “同预算下哪一个商品更适合我？”
- “这门课程/服务/工具值不值得买？”

系统会把目标转成结构化决策任务，并让多个 Agent 协同完成分析，最后生成一份可复查、可执行、可分享的决策报告。

## 核心功能

- **极简注册**：用户只需要用户名和密码即可进入。
- **自动工作区初始化**：首次进入时自动创建个人公司、目标、项目、默认 Agent 团队和决策工作台。
- **一目标启动**：用户只需要填写一个决策目标，系统自动把任务交给总规划师。
- **多 Agent 协作**：13 个 Agent 分工明确，按证据、风险、收益、替代方案、专项场景共同决策。
- **Finance Anything 工作台**：左侧导航固化“决策工作台”，隐藏不必要的 OpenCode 入口，降低用户认知负担。
- **数据获取能力**：股票和公开市场数据 Agent 可使用 AKShare，输出数据时间戳、字段含义和证据等级。
- **最终 HTML 报告**：报告 Agent 汇总所有结论，生成最终 HTML 决策报告文件。
- **中文优先体验**：默认语言、页面文案、任务描述和 Agent 指令均偏向中文使用场景。

## 13 个默认 Agent

| Agent | 专业分工 |
| --- | --- |
| 决策总规划师 | 把模糊目标拆成多 Agent 协作计划，分派任务、追踪证据缺口、协调分歧。 |
| 用户画像与约束 Agent | 梳理预算、现金流、风险承受力、时间周期、使用场景、偏好和硬性限制。 |
| 信息采集 Agent | 采集价格、规格、公告、新闻、历史数据、竞品信息和公开评价。 |
| 证据可信度 Agent | 审查来源可靠性、时效性、样本偏差、营销污染和推断跳跃。 |
| 成本与收益 Agent | 评估总拥有成本、机会成本、预期收益、现金流压力和隐性成本。 |
| 替代方案 Agent | 寻找同预算、同目标或更低风险的替代选择，避免单一路径依赖。 |
| 风险 Agent | 识别财务、执行、流动性、政策、售后、心理和极端情景风险。 |
| 反方辩论 Agent | 专门反驳主流结论，提出“不买/等待/换方案”的最强理由。 |
| 股票专项 Agent | 使用 AKShare 等数据源分析股票、基金、ETF、指数和基本面数据。 |
| 商品专项 Agent | 分析商品参数、品牌、价格、质量、售后、使用场景和竞品。 |
| 场景模拟 Agent | 做乐观/基准/悲观情景、敏感性分析和触发条件模拟。 |
| 二手价值 Agent | 分析二手价格、折旧曲线、转卖流动性、保值率和退出路径。 |
| 决策报告 Agent | 汇总所有 Agent 结果，生成最终 HTML 决策报告和执行建议。 |

## 技术架构

```text
finance-anything-landing/
  Landing 页面、头图和静态资源

paperclip/
  基于 Paperclip 的完整 Finance Anything 应用分支
  ├─ server/   API、认证、Finance bootstrap、多 Agent 调度
  ├─ ui/       React 工作台、注册登录、决策首页
  ├─ packages/ Adapter、插件、数据库、共享类型
  ├─ cli/      Paperclip CLI
  └─ skills/   Agent 运行技能

scripts/
  Finance Anything Agent 描述和分工更新脚本
```

线上推荐部署方式是从 GitHub 拉取本仓库，然后在服务器上配置独立服务：

```bash
git clone https://github.com/qybaihe/Finance-Anything.git
cd Finance-Anything/paperclip
pnpm install --frozen-lockfile
pnpm --filter @paperclipai/plugin-sdk build
pnpm --filter @paperclipai/ui build
pnpm --filter @paperclipai/server prepare:ui-dist
```

## 关键环境变量

```bash
FINANCE_ANYTHING_MODE=true
PAPERCLIP_FINANCE_ANYTHING_MODE=true
PAPERCLIP_PRODUCT_NAME="Finance Anything"
FINANCE_DEFAULT_MODEL=xiaomi/mimo-v2.5-pro
FINANCE_WORKSPACE_ROOT=/root/finance-anything-workspaces
OPENAI_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
OPENAI_API_KEY=your-tokenplan-api-key
PAPERCLIP_AUTH_DISABLE_SIGN_UP=false
```

OpenCode provider 需要配置为 OpenAI-compatible 服务。模型名称在页面上可展示为 MiMo V2.5 Pro，但运行时应使用端点实际支持的 ID：`xiaomi/mimo-v2.5-pro`。

## 本地开发

```bash
cd paperclip
pnpm install
pnpm dev
```

Landing 页面是纯静态页面：

```bash
cd finance-anything-landing
python -m http.server 4173
```

## 与 Paperclip 的关系

Finance Anything 是 Paperclip 的产品化分支，而不是从零重写的系统。Paperclip 提供了多 Agent 协作底座，包括：

- Agent 管理和运行心跳
- 公司、项目、目标、任务和评论流
- 本地 Adapter 执行框架
- 认证、权限和多用户能力
- 插件、技能和工作区管理

Finance Anything 在此基础上新增或强化了：

- Finance Anything 模式和产品命名
- 极简注册与默认中文体验
- 用户首次进入后的自动工作区初始化
- 13 个专业决策 Agent 模板
- 决策工作台首页
- AKShare 数据分析约束
- 最终 HTML 决策报告工作流
- OpenCode + MiMo Tokenplan 默认运行配置

## 安全说明

本仓库不应提交任何真实 API Key、SSH key、服务器私钥或本地运行数据。部署时请通过服务器环境变量或实例 `.env` 文件注入密钥。

---

<a id="english"></a>

# Finance Anything

**Finance Anything** is a universal decision assistant for “should I buy it, invest in it, or choose something else?” It turns a single user goal into a multi-agent decision workspace. Specialized agents collect evidence, review source quality, model cost and upside, assess risk, compare alternatives, analyze equities/products/resale value, run a contrarian review, and produce a final HTML decision report.

This project is a product-focused fork of **[Paperclip](https://github.com/paperclipai/paperclip)**. We keep Paperclip’s multi-agent operating system, issue workflow, projects, goals, permissions, adapters, and local execution model, then reshape it into a Chinese-first, multi-user decision workspace.

## Current Status

- Deployed as an independent Finance Anything service.
- Users can register with only a username and password.
- A personal Finance Anything workspace is automatically created after sign-up.
- Each user receives 13 default decision agents.
- Agents run through OpenCode.
- The default model is Xiaomi Tokenplan’s MiMo V2.5 Pro compatible model ID: `xiaomi/mimo-v2.5-pro`.
- Landing page, auth, workspace bootstrap, issue creation, multi-agent collaboration, and final report workflow are connected.

## Product Vision

Finance Anything is designed as a universal decision entry point for purchases, investments, products, services, and second-hand goods. Users do not need to configure models, workspaces, tools, or agents. They only describe the decision target, for example:

- “Should I buy this stock now?”
- “Is this second-hand device worth buying?”
- “Which product is best under this budget?”
- “Is this course, service, or tool worth paying for?”

The system structures the goal into a decision workflow and coordinates a team of agents to produce an evidence-backed report.

## Key Features

- **Simple sign-up**: username and password only.
- **Automatic workspace bootstrap**: company, goal, project, decision workspace, and agents are created for each user.
- **Goal-first workflow**: users start by submitting one decision goal.
- **Multi-agent collaboration**: 13 role-constrained agents cooperate on evidence, risk, upside, alternatives, and domain analysis.
- **Decision workspace**: the first screen is the actual Finance Anything workspace, not a generic admin console.
- **Data-aware agents**: market-data agents can use AKShare and must report timestamps, fields, and source quality.
- **Final HTML report**: the report agent produces a final decision report file.
- **Chinese-first UX**: default copy, agent instructions, and workflows are optimized for Chinese users.

## Default Agent Team

| Agent | Responsibility |
| --- | --- |
| Chief Decision Orchestrator | Converts fuzzy goals into a coordinated multi-agent plan and manages dependencies. |
| User Context & Constraint Analyst | Defines budget, risk tolerance, time horizon, preferences, and hard constraints. |
| Market, Product & Public Data Collector | Collects prices, specs, announcements, news, public reviews, and market facts. |
| Evidence Quality & Bias Reviewer | Reviews source reliability, recency, bias, marketing contamination, and weak inference. |
| Total Cost & Expected Benefit Analyst | Models total cost, opportunity cost, upside, cash-flow burden, and hidden costs. |
| Alternative Options Strategist | Finds better, cheaper, safer, or more flexible alternatives. |
| Decision Risk Officer | Identifies financial, execution, liquidity, policy, after-sales, and downside risks. |
| Contrarian Red-Team Reviewer | Builds the strongest case against the current recommendation. |
| Equity, Fund & ETF Decision Analyst | Analyzes stocks, funds, ETFs, indices, and fundamentals with AKShare where useful. |
| Consumer Purchase & Product Analyst | Compares product specs, quality, brand, service, pricing, and fit. |
| Scenario & Sensitivity Simulator | Runs optimistic, base, pessimistic, and trigger-condition scenarios. |
| Resale Value & Depreciation Analyst | Assesses second-hand prices, depreciation, liquidity, and exit value. |
| Final HTML Decision Report Producer | Synthesizes all findings into a final HTML report and action plan. |

## Architecture

```text
finance-anything-landing/
  Static landing page and hero assets

paperclip/
  The full Finance Anything application forked from Paperclip
  ├─ server/   API, auth, Finance bootstrap, multi-agent runtime
  ├─ ui/       React workspace, auth pages, Finance home
  ├─ packages/ Adapters, plugins, database, shared types
  ├─ cli/      Paperclip CLI
  └─ skills/   Runtime skills for agents

scripts/
  Finance Anything agent role and instruction updater
```

Recommended deployment flow:

```bash
git clone https://github.com/qybaihe/Finance-Anything.git
cd Finance-Anything/paperclip
pnpm install --frozen-lockfile
pnpm --filter @paperclipai/plugin-sdk build
pnpm --filter @paperclipai/ui build
pnpm --filter @paperclipai/server prepare:ui-dist
```

## Important Environment Variables

```bash
FINANCE_ANYTHING_MODE=true
PAPERCLIP_FINANCE_ANYTHING_MODE=true
PAPERCLIP_PRODUCT_NAME="Finance Anything"
FINANCE_DEFAULT_MODEL=xiaomi/mimo-v2.5-pro
FINANCE_WORKSPACE_ROOT=/root/finance-anything-workspaces
OPENAI_BASE_URL=https://token-plan-cn.xiaomimimo.com/v1
OPENAI_API_KEY=your-tokenplan-api-key
PAPERCLIP_AUTH_DISABLE_SIGN_UP=false
```

OpenCode should be configured with an OpenAI-compatible provider. The product may display the model as MiMo V2.5 Pro, while the runtime model ID should be `xiaomi/mimo-v2.5-pro`.

## Local Development

```bash
cd paperclip
pnpm install
pnpm dev
```

Static landing page:

```bash
cd finance-anything-landing
python -m http.server 4173
```

## Relationship To Paperclip

Finance Anything is a fork and product specialization of Paperclip. Paperclip provides:

- Agent orchestration and heartbeat execution
- Companies, projects, goals, issues, and comments
- Local adapter execution framework
- Auth, permissions, and multi-user access
- Plugins, skills, and workspace management

Finance Anything adds:

- Finance Anything product mode and naming
- Simplified Chinese-first onboarding
- Automatic per-user workspace bootstrap
- 13 specialized decision-agent templates
- Decision workspace home screen
- AKShare-aware data collection constraints
- Final HTML decision report workflow
- OpenCode + MiMo Tokenplan default runtime configuration

## Security

Do not commit real API keys, SSH keys, server private keys, or runtime databases. Inject secrets through server environment variables or deployment-specific `.env` files.
