# Finance Anything Landing Page

这是一次针对 Finance Anything 桌面端发布页的全面视觉与动效升级，将其打造为具有大厂发布级别、强视觉冲击力的金融科技类 SaaS 首页。

## 升级亮点 (Visual & Technical Upgrades)

1. **极致聚焦的首屏体验 (Immersive Hero Section)**
   - 彻底移除了顶部的全局导航栏（Navbar），摒弃了普通 SaaS 模板的陈旧布局，使用户首屏视觉毫无干扰地聚焦于核心控制台和万能决策助手。

2. **确定性环形轨道网络 (Deterministic Agent Orbit)**
   - 弃用了杂乱散乱的随机粒子乱飞效果。
   - 重构底层 Canvas 逻辑为一套稳定、优雅、高可控的确定性金融科技粒子系统（Deterministic Orbit System）。
   - 多个专业 Agent 节点围绕 Finance Anything 核心做多层稳定环形轨道运动。
   - 节点之间具备顺时针数据脉冲流，完美呈现周期性循环（需求理解 -> 信息采集 -> 验证 -> 风险 -> 辩论 -> 最终报告）的视觉隐喻。

3. **Finance Anything 调度面板**
   - 第二屏从旧的 Agent 矩阵改为“总控选择 Agent -> 并行执行 -> 汇总报告”的调度面板。
   - 顶部是“决策总规划师”，中间清晰区分“本轮开始工作”的 Agent 和“按场景待命”的 Agent，底部汇总到“决策报告 Agent”。
   - 重点突出了“二手价值 Agent”、“风险 Agent”、“反方辩论”以及最终的“最终支付决策报告”。

4. **右侧宣传图与循环终端**
   - 右侧控制台上方使用 ImageGen 生成的 Finance Anything 中文宣传图，不再使用 CSS 模拟插画或悬浮球组件。
   - 右侧终端放大为核心区域，展示 Finance Anything 委派任务、Agent 回传结果、再次广播给其他 Agent 的循环过程。

## 文件结构说明

当前项目为纯净的前端静态项目，无任何构建工具依赖，开箱即用：

- `index.html`: 骨架结构，包含首屏核心区域及下方 Agent 调度树 (Agent Dispatch Tree)。
- `style.css`: 样式核心。采用黑金/深色金融科技配色（Dark FinTech Theme）。管理静态样式、布局以及 CSS 连贯入场动画。
- `script.js`: 动效核心。控制 Canvas 的轨道生命周期、确定性运动计算、核心数据流脉冲，并包含滚动侦测（Scroll Reveal）。
- `assets/finance-anything-hero.png`: ImageGen 生成的 Finance Anything 中文宣传图，用于右侧控制台上方。

## 如何修改业务逻辑链接

由于移除了顶部导航，目前的转化锚点集中在首屏核心区，请在 `index.html` 中修改如下部分：

```html
<!-- 首屏 CTA 区域 -->
<div class="cta-group animate-in fade-up stagger-5">
    <!-- 修改 href 指向真实系统入口 -->
    <a href="/auth?mode=sign_in&next=%2Ffinance" class="btn btn-primary">
        <span class="btn-text">开始决策</span>
        ...
    </a>
    <!-- 修改 href 指向真实注册页 -->
    <a href="/auth?mode=sign_up&next=%2Ffinance" class="btn btn-secondary">创建账号</a>
</div>
```

## 部署说明 (Deployment)

由于是纯静态资源（HTML/CSS/JS），无需配置 Node.js 环境或构建流。
你可以将其部署到任何静态服务器：

1. **Vercel / Netlify / Cloudflare Pages**:
   - 直接连接代码仓库，设置根目录为 `finance-anything-landing`。
   - 构建命令留空。
   - 发布目录设置为根目录 `/` 或 `.`。

2. **Nginx / Apache**:
   - 将文件夹内的文件直接拷贝到 `www` 或 `html` 目录下即可。

3. **本地预览**:
   - 直接使用浏览器打开 `index.html`。
   - 或者使用 VSCode 插件 "Live Server" 获得最佳体验。

## 替换右侧宣传图

如果后续需要换图，直接替换：

```text
assets/finance-anything-hero.png
```

保持文件名不变即可自动生效。
