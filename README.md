# frontend-workflow

A Claude Code plugin for a plan-first frontend workflow: analyze a requirement into a plan, implement it with risk-based RED-GREEN testing, verify supported browser platforms, and finish with an independent frontend review and report.

规范前端开发中“需求分析 → 实现 → 单元测试 → 浏览器功能测试 → 审核 → 报告”流程的 Claude Code 插件；改 bug 时用 `/req-bugfix`，走“复现 → 根因 → 回归测试先失败 → 修复 → 验证”的流程。

## 与 Superpowers 配合

Superpowers 负责通用的设计澄清和实施计划；frontend-workflow 补充前端验收、移动端浏览器验证、埋点、弱网与测试服数据保护，并负责执行计划。两个插件分别安装，不复制或维护 Superpowers 的技能文件。Claude Code 官方市场的安装命令是：

```text
/plugin install superpowers@claude-plugins-official
```

新功能推荐按下面顺序走：

1. 使用 `/superpowers:brainstorming` 澄清需求。设计批准后，使用 `/superpowers:using-git-worktrees` 建立工作区，再由 `/superpowers:writing-plans` 生成实施计划草稿。
2. 在最终批准计划前，调用 `/req-analysis docs/superpowers/plans/<计划文件>.md`。它会把前端补充写回同一计划，不生成第二份方案。计划应包含适用的 AC、UI 状态、响应式与无障碍要求、测试映射、具体风险和回滚方式。
3. 审阅整份计划后，直接运行 `/req-implement <计划文件路径>`，运行即视为批准。执行只用 `/req-implement` 一套流程：不再加载 Superpowers 的 `executing-plans`、`subagent-driven-development`、`test-driven-development`，Superpowers 计划只作为任务清单和设计依据。
4. `/req-implement` 完成实现、测试、移动端浏览器验证和一次完整代码审核。

用 `writing-plans` 写计划时，建议只写到“改哪些文件、验收标准、验证命令、不做什么”，不逐行写代码：代码级步骤写得越细，计划越长，实现时也常要按仓库实际情况改。

改 bug 时继续用 `/req-bugfix` 复现问题并追踪根因；遇到复杂或反复失败的问题可配合 `systematic-debugging`。`/req-test` 用于独立测试已经实现的功能，仍按测试任务运行。

避免让两套流程同时生成设计文档、实施计划或重复审批。Superpowers 的设计和计划作为唯一事实来源；截图等临时产物可留在本机忽略目录。Superpowers `using-git-worktrees` 负责单个任务的工作区；`/req-parallel` 负责多个独立请求的 worktree，使用它时不要再让 Superpowers 为同一任务创建工作区。`/req-implement` 不使用 Superpowers 的实施和审核子代理；你在流程之外单独使用 Superpowers 的 `code-reviewer` 时，它仍受钩子只读限制。

Superpowers 安装后仍可使用独立模式：直接把需求交给 `/req-analysis`，再按原方式运行 `/req-implement`。如果提供的是 Superpowers 计划路径，则 `/req-analysis` 只补充该计划。

## 流程

1. `/req-analysis <需求原文>`
   - 阶段一：需求复述、验收标准（AC）、待确认事项（Q）、相似实现、代码定位、影响范围、测试现状、风险等级初评。停下等你答复。
   - 阶段二：方案审核单（修改的文件、不做什么、替代方案、兼容性风险、埋点变更、测试方案、回滚方式等），保存到 `docs/plans/YYYYMMDD-名称.md`。
   - 方案审核：保存后由 `req-plan-reviewer`（Fable 模型）对照代码审核一轮，主代理逐条核实后采纳或写明不采纳的理由，会改变需求或范围的意见转为待确认事项交给你；处理结果记在方案的“方案审核记录”中。`/req-bugfix` 的修复方案和 Superpowers 计划补充同样会审核。停下等你审批。
   - 测试方案按层次组织：每条验收标准由哪一层验证（单元 / 组件 / 浏览器功能 / 真机手工），每层具体到用例。
2. `/req-implement <方案文件路径>`（需求方案、缺陷修复方案或已批准的 Superpowers 计划都可执行）
   - 检查方案是否完整、代码是否偏离方案，记录实现基准（当前提交号）。
   - 开工前输出执行确认。只有命中高风险区域、有会让实现中途停下的事项、有按假设处理的条目或需要你协助时才停下等你确认，其余情况直接开始。
   - 测试先行按风险分：业务行为、出错和兜底路径、缺陷回归“先写测试”——由 `req-test-runner` 按任务简报做 RED（相邻的独立任务合并成一次），主代理实现后自己做 GREEN 并核对测试没被改动；骨架、配置、构建与检查脚本、样式等“实现后补测试”——主代理先实现，再由 `req-test-runner` 一次补齐测试。已有 E2E 框架时由 `req-browser-tester` 做 E2E 用例的 RED。
   - 每个任务归哪一类，按 `references/test-first-scope.md` 的定义：方案里标注过的按标注执行，不能把“先写测试”改成“实现后补测试”；审核员会核对归类。
   - 全部任务完成后，主代理自己把检查命令完整运行一次；之后每次修改业务代码，也由主代理自己重跑。有测试问题或归因拿不准时才派 `req-test-runner`。
   - `req-browser-tester` 子代理在本次改动涉及的支持平台上打开真实页面，核对页面状态、控制台报错、失败请求、横向溢出、点击区域和埋点请求；核心页面还可以做性能与弱网检查。开始前会请你启动本地页面。
   - `req-code-reviewer` 子代理只读审核，包括静默失败和测试覆盖缺口，不再另派其他审核代理；最多 2 轮，只有修复了阻断项或有异议时才进入下一轮，下一轮只复核上一轮的问题和修复涉及的文件。调用时明确要求，才在审核前加做 pr-review-toolkit 的专项检查。
   - 分析和实现中涉及第三方库的 API 时，先用 Context7 查询项目所用版本的文档。
   - 输出测试与审核报告，并追加到方案文件末尾，其中包括浏览器模拟覆盖不到、需要在真机上验证的手工测试步骤。不会自动提交代码。

短写法 `/req-analysis`、`/req-bugfix`、`/req-implement`、`/req-test` 与其他命令不冲突时可以直接使用；完整写法是 `/frontend-workflow:req-analysis` 等。

## 改 bug：`/req-bugfix`

```text
/req-bugfix 订单列表在 iOS 下拉刷新后数据重复显示。复现步骤：1. 打开订单列表 2. 下拉刷新两次。期望：列表不重复。实际：同一订单出现两次。环境：iOS 17 Safari 和 App 内 WebView，必现。
```

方案批准后，同样用 `/req-implement docs/plans/<方案文件>.md` 执行修复。和 `/req-analysis` 的区别：

- **先复现、再找根因、最后定修法**：阶段一先由 `req-browser-tester` 在浏览器中按复现步骤复现问题，截图并收集控制台报错、异常请求等线索；再从现象追踪调用链，写明根因的代码位置和证据等级，能找到引入问题的提交时一并写明。未复现时会停下来请你补充信息，不会凭空推测根因。
- **回归测试先失败后通过**：`/req-implement` 在修改业务代码之前，由 `req-test-runner` 为单元/组件测试、`req-browser-tester` 为已有 E2E 框架中的页面测试编写目标回归用例并确认 RED；修复后同一批测试必须通过，断言和预期值不能改。修复前就通过的测试说明没有抓住问题，流程会停下来。
- **小问题少停一次**：风险等级 L1、没有待确认事项、根因证据充分时，阶段一和阶段二合并输出，只停一次。
- **方案更精简**：L1 的问题不要求比较修复方式和展开兼容性风险；方案文件名为 `YYYYMMDD-fix-名称.md`，开头标明 `类型：缺陷修复`。
- **审核多看几项**：修的是不是根因而不是表面现象，回归测试有没有在修复后被改动，同一根因的其他地方是否处理。

把 bug 交给 `/req-analysis` 时，它会提示你改用 `/req-bugfix`；把新需求交给 `/req-bugfix` 时，它会提示你改用 `/req-analysis`。原因很明显的小 bug，也可以不走插件，直接让 Claude 修复并补一条回归测试。

## 只测试、找 bug：`/req-test`

```text
/req-test 订单列表支持按状态筛选：全部、待付款、待发货、已完成，切换后列表刷新，无数据时显示空状态。
```

也可以传入 `/req-analysis` 生成的方案文件路径，沿用其中的验收标准。只测测试服时加上 `--env`，只想做页面黑盒测试时再加 `--only=browser`：

```text
/req-test --env=https://staging.example.com --only=browser 订单列表支持按状态筛选……
```

测试服模式（`--env`）和本地模式的区别：

- **不用启动本地页面**：开始前先做一次环境检查，确认能否访问、怎么登录，读出测试服部署的版本。需要 VPN、基本认证或登录的，一次列全请你处理。
- **版本对齐**：部署版本和本地代码不一致或无法确定时，会停下来请你选：自己切到部署的提交、改为只做浏览器测试，或照常测并在报告中注明。测试结束时会再读一次版本，测到一半有人重新部署会提示你。
- **保护共用数据**：只用测试账号；不改、不删别人的数据；新建的数据加 `[autotest]` 前缀并在报告中列出，方便清理；下单、支付、发短信等操作要你先确认测试服接的是沙箱；异常场景用浏览器拦截接口模拟，不动测试服数据。
- **登录**：默认在可见 Chrome 中由你登录一次，之后复用。测试账号只有在地址是你在对话中给的、且域名能看出是测试环境（staging、test、dev、qa 等）时才会代为输入，否则请你自己登录。
- **报告多写几项**：部署版本、发生时间、测试数据 ID、失败请求的 trace ID 或 request-id，方便后端查日志。测试服是正式构建，性能指标可以作为参考；代码经过压缩，疑似代码位置的把握会低一些。用于测试已经实现的功能，只测试，不修改业务代码：

- **按需求写用例**：整理验收标准，定位被测代码，写测试方案到 `docs/plans/YYYYMMDD-test-名称.md`。按需求、代码影响和风险选择适用的正常路径、关键边界、错误状态、加载与空状态、交互、登录权限、埋点和支持设备；每条验收标准至少映射一种验证方式。不适用的写明原因。核心流程和 L3 改动再扩大设备、弱网和异常路径覆盖。需求不明确的地方先按假设继续，标注 Q 编号。
- **能做的相关检查全部执行，不用等审批**：`req-test-runner` 编写适用的单元与组件测试并运行计划中的检查命令；`req-browser-tester` 在本次支持的平台上执行计划用例、通用检查和埋点核对，核心页面加做性能与弱网检查。
- **需要你协助时随时停下**：启动本地页面、测试账号、登录、同意使用你的 Chrome 等，会一次列全请你处理，处理完接着跑。
- **缺陷逐个复现确认**：失败的用例会再从全新状态复现，记录复现频率，定位疑似代码位置。
- **测试报告**：缺陷按严重程度排列，每个缺陷写明环境、前置条件、复现步骤、实际与期望结果、复现频率、截图和请求等证据、疑似代码位置，并附一条可直接粘贴的 `/req-bugfix` 消息。报告追加到测试方案文件末尾。新增的测试文件保留在项目中，不会自动提交。发现缺陷的那些测试在修复前会一直失败；把报告里的 `/req-bugfix` 消息拿去修复时，会直接沿用这些测试作为“修复前必须失败”的回归测试，不用再写一遍（在新的 worktree 中修复时，没提交的文件带不过去，会按用例描述重新编写）。

## 并行处理多个任务：`/req-parallel`

每个任务在独立的 git worktree（项目副本，自己的文件、分支和本地页面）中处理，互不干扰。

1. **在主目录规划**：

   ```text
   /req-parallel
   1. 订单列表在 iOS 下拉刷新后数据重复显示……
   2. 优惠券叠加后金额计算错误……
   3. 新增：订单详情页加分享按钮
   ```

   插件会：轻量定位每个任务可能改动的文件；把改同一批文件或同一根因的任务合并、有依赖的分到后一批、每批最多 3 个；检查一次性准备（git 忽略 worktree 目录、`.worktreeinclude`）；请你为本批选择起点（远端默认分支、当前分支或其他分支）；为每个任务生成第一条消息，如 `/req-bugfix --worktree=bug-order-dup --base=develop <问题描述>`；把计划记录在 `docs/plans/parallel-YYYYMMDD.md`。
2. **每个任务一个会话**：新开会话（+ New 或 Cmd+N），粘贴对应的消息。命令会自动创建并进入 worktree，检查依赖、分配端口（主目录 5173，第 1 个 worktree 5174，以此类推），然后照常分析；分析完在同一个会话中运行 `/req-implement`。
3. **查看进度、决定合并顺序**：回到主目录运行 `/req-parallel 状态`，看每个任务的阶段、未提交的改动、多个分支都改到的文件和建议的合并顺序；本批合并完后，它会生成下一批的消息。
4. **收尾**：每个 worktree 完成后会提醒你先提交再归档。说“提交”时由 Claude 写提交说明并经你确认后提交；推送和合并由你执行。

仍然需要你做的：新开会话并粘贴消息；在 worktree 中安装依赖（`pnpm install`，你的设置禁止 Claude 安装）；启动各 worktree 的本地页面；确认方案；推送和合并。

说明：
- 起点每次由你选择：`/req-parallel` 规划时问一次，写进每条消息的 `--base`；单独使用 `/req-bugfix --worktree` 或 `/req-analysis --worktree` 且没有写 `--base` 时，会先问你。worktree 建好后，如果起点和你选的不一致，会把这个新建、还没有改动的 worktree 对齐到你选的起点（执行 `git reset --hard`，会弹窗请你确认）；已经存在的 worktree 不会被移动。
- 用 `--worktree` 参数时不要打开桌面应用的 Worktree 开关，否则会话一开始就按默认起点建好 worktree，命令无法再改起点。
- worktree 中的 `docs/plans/` 和截图同样被本机 git exclude 忽略。用 `--worktree` 进入的会话，浏览器截图可能保存在主目录的 `docs/plans/browser-artifacts/` 下（浏览器服务在会话开始时的目录中运行）。
- 可见 Chrome（`browser-chrome`）的登录态按目录区分，每个 worktree 第一次使用时要登录一次。

## 组件

| 类型 | 名称 | 作用 |
|------|------|------|
| Skill | `req-analysis` | 独立需求分析；也可把 Superpowers 计划补充为前端计划，只能由你手动调用 |
| Skill | `req-bugfix` | 缺陷复现、根因分析与修复方案，只能由你手动调用 |
| Skill | `req-parallel` | 并行处理多个任务的规划、进度汇总和合并顺序建议，只能由你手动调用 |
| Skill | `req-implement` | 按方案实现、测试、审核，只能由你手动调用 |
| Skill | `req-test` | 按风险与影响面为已有功能选择测试用例、确认缺陷并输出带复现步骤的测试报告；只测试不修复，只能由你手动调用 |
| 子代理 | `req-plan-reviewer` | 方案保存后、你审批前，对照代码审核方案并提出改进意见；只读 |
| 子代理 | `req-test-runner` | 编写和修正单元测试、组件测试，运行检查命令，分析失败原因；只改测试文件 |
| 子代理 | `req-browser-tester` | 实现前为已有 E2E 框架编写 RED 用例，实现后执行浏览器功能测试；只改测试文件 |
| 子代理 | `req-code-reviewer` | 对照方案独立审核本次改动和测试结果；只读 |
| MCP 服务 | `browser-ios` | WebKit 内核 + iPhone 15 模拟，无头、隔离，近似 iOS Safari；用于产品支持且本次改动影响 iOS 的场景 |
| MCP 服务 | `browser-android` | 本机 Chrome + Pixel 7 模拟，无头、隔离，近似 Android 浏览器和 WebView；用于产品支持且本次改动影响 Android 的场景 |
| MCP 服务 | `browser-chrome` | 可见 Chrome：本机 Chrome 窗口 + Pixel 7 模拟，测试专用配置，登录态会保留 |
| MCP 服务 | `browser-user-chrome` | 你正在用的 Chrome：通过 Playwright Extension 连接，只能操作你授权的标签页 |
| MCP 服务 | `browser-perf` | Chrome 官方 DevTools MCP（`chrome-devtools-mcp@1.11.0`）：弱网和 CPU 降速、性能录制、Lighthouse、堆快照 |
| MCP 服务 | `context7` | Context7 远程服务（`https://mcp.context7.com/mcp`）：查询第三方库指定版本的文档 |
| 钩子 | `hooks/guard-subagents.mjs` | 强制执行上面四个子代理的权限边界 |
| 参考 | `references/plan-review.md` | 调用方案审核员和处理审核意见的统一流程，供 `req-analysis`、`req-bugfix` 引用 |
| 参考 | `references/frontend-quality-supplement.md` | 将前端验收、UI 状态、响应式、无障碍和测试映射补入同一份计划 |
| 参考 | `references/test-first-scope.md` | “先写测试”和“实现后补测试”的定义，供 `req-analysis`、`req-implement` 引用 |
| 外部子代理（可选） | `pr-review-toolkit:silent-failure-hunter`、`pr-review-toolkit:pr-test-analyzer` | 只在调用 `/req-implement` 时明确要求才用：审核前的专项检查 |

## 项目规则（可选，推荐）

插件会读取项目中的 `CLAUDE.md` 和 `CLAUDE.local.md`，以下内容建议在其中写明：

- 证据等级 A/B/C 的定义。没有时使用内置默认定义。
- 高风险区域清单（路径 + 原因 + 审核要点）。没有时，分析和审核中会写明“项目未配置高风险区域”。
- 包管理器、运行环境（如 iOS Safari、Android WebView）、编码约定。审核员会逐条核对编码约定。
- 浏览器测试信息：本地页面的启动命令和访问地址、登录方式、测试数据从哪里来、哪些功能依赖 App 环境（如 JSBridge）。
- 测试服信息（使用 `/req-test --env` 时）：测试服地址、登录方式、部署版本在哪里看（如 `/version.json` 的 `commit` 字段）、测试数据前缀、哪些操作接的是沙箱、禁止在测试服上做的操作。写了地址后，`--env` 可以不带地址。例如：

  ```markdown
  ## 测试服
  - 地址：https://staging.example.com
  - 登录：短信验证码，在可见 Chrome 中手动登录
  - 部署版本：/version.json 的 commit 字段
  - 测试数据前缀：[autotest]
  - 沙箱：支付走测试通道；短信不会真实发送
  - 禁止：删除商品、修改店铺设置
  ```

## 浏览器功能测试

- **方式**：项目已有 Playwright Test、Cypress 等 E2E 框架且计划选择脚本时，由 `req-browser-tester` 在改业务代码前先验证目标用例 RED，实现后重跑确认 GREEN；没有时，由它用插件自带的浏览器工具逐步执行方案用例，并保留实现前后的手工对照，不往项目里加依赖。
- **本地页面由你启动**：流程不会自己启动 dev server。到浏览器测试这一步时会告诉你启动命令和地址，等你确认后再继续。
- **登录信息**：需要测试账号或 token 时会向你索取，只在调用子代理时传入，不写入方案、代码、报告或任何文件。
- **随时请求协助**：任何一步遇到只有你能处理的情况（启动页面、提供测试账号、在 Chrome 窗口里过验证码或 SSO 登录、同意使用你的 Chrome、安装浏览器、准备测试数据、放行被拒的工具调用等），子代理会把相关用例标为“待协助”并发出编号的协助请求（H1、H2……），主代理立即停下转达给你，你处理完回复后从卡住的地方继续。只有你明确说“跳过”或“转手工”，用例才会记为未执行。验证码、短信验证码、扫码、SSO 和 OAuth 授权页必须由你本人操作，建议这类页面用 `browser-chrome` 登录一次，登录态会保留。
- **接口模拟**：可以在浏览器中拦截接口，模拟空数据、接口失败、慢接口等状态。
- **视觉与无障碍**：方案覆盖本次变更影响的视觉状态、主要响应式断点和键盘焦点路径，并复用项目设计系统。已有视觉回归或无障碍工具时沿用，不为单次需求新增依赖。
- **证据**：截图保存在 `docs/plans/browser-artifacts/`，与方案文件一起被本机 git exclude 忽略。
- **局限**：浏览器模拟不能代替真机。软键盘遮挡、刘海屏安全区、App 内嵌 WebView、JSBridge、真实支付等，会列入报告中的手工测试步骤。
- **性能与弱网检查（可选）**：只对 L3 改动或核心页面做，由 `browser-perf` 执行：在 Slow 3G 等网络条件和 CPU 降速下检查加载中状态、白屏、失败提示；录制 LCP、INP、CLS；需要时运行 Lighthouse（可访问性、最佳实践）和堆快照对比（内存泄漏）。开发服务器没有打包压缩，测得的指标只看相对变化；需要准确数值时，方案会要求你启动构建后的预览页面。`browser-perf` 已关闭向 Google CrUX 发送页面地址和使用统计，并隐去请求头中的敏感信息。

### 功能测试用的四个浏览器服务怎么选

方案按用例指定浏览器服务。只测试产品支持且与本次改动相关的平台；iOS 用 `browser-ios`、Android 用 `browser-android`。只有项目同时支持两者且改动影响两端时才默认覆盖两者。

| 服务 | 什么时候用 | 登录态 | 你需要做的 |
|------|-----------|--------|-----------|
| `browser-ios` / `browser-android` | 产品支持且本次改动影响对应平台时使用 | 每个用例都是全新的，需要登录时用你提供的测试账号 | 无 |
| `browser-chrome` | 想看着测试执行，或需要登录一次后反复使用 | 测试专用配置，按项目区分，保存在 `~/Library/Caches/ms-playwright/mcp-chrome-<项目哈希>`，和你日常的 Chrome 互不影响 | 第一次需要登录时，在弹出的 Chrome 窗口里登录；测试过程中不要在这个窗口里操作 |
| `browser-user-chrome` | 必须复用你日常 Chrome 中已有的登录态（例如公司 SSO） | 你真实的登录态 | 安装 [Playwright Extension](https://chromewebstore.google.com/detail/playwright-extension/mmlmfjhmonkocbjadbfplnigmagldckm)；每次 `/req-implement` 用到它时在对话中同意；连接时在扩展的授权页中选择一个标签页 |

`browser-user-chrome` 操作的是你的真实浏览器，所以额外加了这些限制：方案阶段会列入“需要特别确认的事项”；实现阶段使用前单独征求你的同意；扩展每次连接都需要你在 Chrome 中授权（插件没有配置跳过授权的 token）；子代理只能操作你授权的标签页，不能关闭标签页，不读取、不输出 Cookie 和登录凭证；这个服务不开放 Cookie 和 localStorage 读写工具；不做设备模拟，页面按你的窗口大小显示。

## 各阶段使用的模型

子代理的模型和思考程度写在 `agents/*.md` 的 frontmatter 中（`model`、`effort`），不受主会话模型影响：

| 阶段 | 执行者 | 模型 | 思考程度 |
|------|--------|------|---------|
| 需求分析、写方案 | 主会话 | 主会话当前模型 | 主会话设置 |
| 方案审核 | `req-plan-reviewer` | Fable（`fable`） | high |
| 写业务代码 | 主会话 | 主会话当前模型；建议把会话模型设为 Opus 5.5 | 主会话设置 |
| 单元、组件测试 | `req-test-runner` | Sonnet（`sonnet`） | 默认 |
| 浏览器功能测试 | `req-browser-tester` | Sonnet（`sonnet`） | 默认 |
| 代码审核 | `req-code-reviewer` | Fable（`fable`） | high |

- 写测试、跑命令、按用例操作浏览器用 Sonnet；判断方案和代码对不对的两个审核员用 Fable。任务要改的文件命中高风险区域时，`/req-implement` 调用 `req-test-runner` 写测试会临时指定 Opus。测试子代理的结果不准时，可以把对应文件的 `model` 改回 `opus`。
- 写的是别名，会自动跟随最新版本（目前为 Fable 5.2、Opus 5.5、Sonnet 5.5）。需要固定版本时改成完整模型 ID，如 `claude-sonnet-5-5`。
- 账号无法使用 Fable 时，方案审核会跳过并在输出中注明；代码审核会调用失败，需要把 `req-code-reviewer.md` 的 `model` 改为 `opus` 或删掉这一行（跟随主会话）。

## 子代理守卫钩子

钩子约束本插件的四个子代理，并对 Superpowers 的 `code-reviewer` 施加只读限制；主会话和其他代理不受影响：

- `req-code-reviewer`、`req-plan-reviewer` 和 Superpowers 的 `code-reviewer`：只能运行只读 git 命令（diff、status、log、show 等，管道后可接 head、tail、wc、grep），不能修改任何文件，不能使用 MCP 工具。
- `req-test-runner` 和 `req-browser-tester`：只能修改项目内的测试文件（`*.test.*`、`*.spec.*`，或 `__tests__`、`__mocks__`、`__fixtures__`、`test`、`tests`、`e2e`、`fixtures` 目录下的文件，快照除外）；只能运行 package.json 中已有的脚本和只读 git 命令；会自动修改文件（`--fix`、`--write`、`-u` 等）、进入 watch 或交互模式（`--ui`、`cypress open`）、常驻（dev、serve 等）的脚本会被拦截，包括通过 run-s / run-p 间接调用的子脚本。
- `req-browser-tester`：只能使用插件自带的五个浏览器服务，不能使用 Claude in Chrome、桌面应用内置浏览器等其他浏览器工具；不能使用 `browser_run_code_unsafe`；不能在 `browser-user-chrome` 中使用 `browser_close`；浏览器工具写文件（截图、性能录制、堆快照）只能写到 `docs/plans/browser-artifacts/` 或系统临时目录。
- `pr-review-toolkit` 的专项检查子代理不在钩子的约束范围内，流程只在调用时要求它们只读。

钩子是防误操作的护栏，不是沙箱。它需要 `node` 在 PATH 中，每次 Bash、文件编辑或 MCP 工具调用约增加 30 毫秒。

## 环境要求

- git：用于记录实现基准和收集改动。非 git 仓库也能运行，但审核只能逐个阅读改动文件全文。
- Node.js：守卫钩子和浏览器服务使用。
- Google Chrome：`browser-android`、`browser-chrome` 使用本机安装的 Chrome；`browser-user-chrome` 需要在 Chrome 中安装 Playwright Extension。
- WebKit 浏览器：`browser-ios` 需要，首次使用前在终端运行一次：

  ```bash
  npx -y @playwright/mcp@0.0.83 install-browser webkit
  ```

- 浏览器服务通过 `npx` 启动固定版本的 `@playwright/mcp@0.0.83` 和 `chrome-devtools-mcp@1.11.0`（首次启动时从 npm 下载）。插件启用后，五个浏览器服务会在每个会话中启动，但浏览器只在第一次使用工具时才打开（`browser-user-chrome` 只在使用时才连接你的 Chrome）。不需要时，可以在 `/mcp` 中停用对应的服务。
- Context7：连接远程服务 `https://mcp.context7.com/mcp`，需要联网。查询内容（库名、版本、技术问题）会发送到 Context7 的服务器，流程规定查询中不写业务代码、内部地址和业务名称。不需要时可以在 `/mcp` 中停用。API key 是可选的，详见下一节。

## 配置 Context7 API key（可选）

不填 key 也能用（匿名访问），只是调用额度较低。需要更高额度时：

1. 在 [context7.com](https://context7.com) 注册并生成一个免费的 API key。
2. 在插件的配置项 **Context7 API key（可选）** 中填入：
   - 启用或重新上传插件时，Claude Code 会弹出配置对话框；
   - 之后修改：终端中运行 `/plugin`，在 **Installed** 中选中 `frontend-workflow`，进入 **Configure options**。
3. 重新加载插件（`/reload-plugins`）或开启新会话后生效。

key 标记为敏感信息，保存在系统钥匙串中，不会写入插件文件、`settings.json` 或项目仓库。插件在 `.mcp.json` 中只引用 `${user_config.context7_api_key}`，连接时作为 `Authorization: Bearer` 请求头发送给 Context7。留空时发送的是空的 Bearer 请求头，Context7 会按匿名访问处理。
- 可选：官方插件 pr-review-toolkit（在插件市场 claude-plugins-official 中），只在调用 `/req-implement` 时明确要求专项检查才用到。
- `/req-implement` 不再加载 karpathy-guidelines，“最少代码、不顺手重构”的原则已写在技能里。

## 方案文件

独立模式的方案保存在 `docs/plans/`，浏览器测试截图保存在 `docs/plans/browser-artifacts/`。`/req-analysis` 和 `/req-bugfix` 写入前会检查方案是否会被提交；需要时只在本机 `.git/info/exclude` 中忽略。Superpowers 模式下的前端补充写回 Superpowers 计划文件，保持计划与任务执行者可见；截图等临时证据仍可留在本机忽略目录。

## 维护说明

`req-analysis`、`req-bugfix` 和 `req-test` 仍包含各自的独立流程规则；Superpowers 计划补充规则集中在 `references/frontend-quality-supplement.md`。修改以下任一共享流程部分时，相关 `SKILL.md` 仍需同步修改（`req-test` 不涉及风险等级、“需要特别确认的事项”和 worktree；“需要用户协助时”一节与 `req-implement` 同步）：

- 输出要求（证据等级）
- 查询第三方库文档
- 测试现状（检查命令识别、浏览器测试条件）
- 风险等级的维度
- 处理用户的答复
- “需要特别确认的事项”的触发条件
- 浏览器功能测试的格式（方式、环境、设备与浏览器服务、通用检查、性能与弱网检查）
- 保存方案文件（git exclude 判断、状态、结束语）
- 并行工作区（worktree）的进入和环境检查

“先写测试 / 实现后补测试”的定义在 `references/test-first-scope.md`。子代理读不到这个文件，所以 `req-code-reviewer` 和 `req-plan-reviewer` 的检查清单里各有一条简短的归类核对；修改定义时这两处要同步。

## 安装

本仓库同时是一个 marketplace（`.claude-plugin/marketplace.json`，名称 `gavin-plugins`），可以通过 marketplace 安装。如果之前安装过旧名称 `claude-req` 的版本，或用本地上传装过本插件，请先卸载，否则同名命令会冲突。

**本机开发**：从本地路径添加。插件直接读取目录中的文件，改动后开新会话或执行 `/reload-plugins` 即生效，不需要升版本号。

```bash
claude plugin marketplace add /path/to/frontend-workflow
claude plugin install frontend-workflow@gavin-plugins
```

**从 GitHub 安装**：

```bash
claude plugin marketplace add <用户名>/<仓库名>
claude plugin install frontend-workflow@gavin-plugins
```

### 自动更新

第三方 marketplace 默认不自动更新，需要每位使用者自己打开：在 `/plugin` 的 Marketplaces 中选中 `gavin-plugins`，选择 Enable auto-update；或在 settings.json 中写：

```json
"extraKnownMarketplaces": {
  "gavin-plugins": {
    "source": { "source": "github", "repo": "<用户名>/<仓库名>" },
    "autoUpdate": true
  }
}
```

- 打开后，Claude Code 会在会话开始后（随机延迟最多 10 分钟）检查更新；新版本在下次启动或执行 `/reload-plugins` 后生效。
- 是否有更新以 `plugin.json` 的 `version` 判断：**每次发布都要升版本号**，只推送提交不升版本，使用者不会收到更新。
- 设置了 `DISABLE_AUTOUPDATER=1` 时插件也不会自动更新；需要保留插件更新时，同时设置 `FORCE_AUTOUPDATE_PLUGINS=1`。

## 许可

MIT，见 [LICENSE](LICENSE)。
