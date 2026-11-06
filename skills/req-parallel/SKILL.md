---
name: req-parallel
description: 并行处理多个 bug 或需求：拆分批次、检查一次性准备，为每个任务生成在独立 worktree 中运行的第一条消息；“状态”模式汇总各 worktree 的进度、冲突风险和合并顺序。只在用户通过 /req-parallel 明确调用时使用。
argument-hint: "[任务列表，每行一个] 或 [状态]"
disable-model-invocation: true
---

# 并行处理多个任务

在项目主目录（不是某个 worktree）中运行。运行 `git rev-parse --git-dir` 和 `git rev-parse --git-common-dir`，两者不同说明当前在 worktree 中：提示用户回到主目录的会话再运行，然后停下。

参数为“状态”时，按“状态模式”执行；否则参数是任务列表（每行一个 bug 或需求），按“规划模式”执行。没有参数时，请用户提供任务列表，然后停下。

全程只读，不修改业务代码、测试代码或配置文件，不创建 worktree，不合并、不推送。唯一允许写入的是本机 git exclude 文件、跟踪文件 `docs/plans/parallel-YYYYMMDD.md`，以及经用户确认后创建的 `.worktreeinclude`。

下文的“项目规则”指项目中的 CLAUDE.md 和 CLAUDE.local.md（存在时）。

## 规划模式

worktree 的创建权由 `/req-parallel` 负责。每个 worktree 中可以使用 Superpowers 执行该任务的实施计划，但不要再调用 `superpowers:using-git-worktrees` 为同一任务创建第二个工作区。`subagent-driven-development` 可在当前 worktree 内拆分计划任务；不要与 `/req-parallel` 对同一批独立需求重复并行拆分。

### 1. 理解每个任务

逐条判断类型：描述现象、报错或复现步骤的是“缺陷”，新功能或需求变更是“需求”，拿不准的问用户。为每个任务起一个简短英文名（小写英文和连字符），worktree 名为 `bug-<名>` 或 `feat-<名>`。

对每个任务做一次轻量定位（只读搜索，不做完整分析）：可能涉及的页面、组件、模块和文件，每条标注证据等级（项目规则没有定义时：A = 打开文件看到了代码；B = 推断；C = 无法确定）。

### 2. 分批

- 可能改动同一批文件、或者看起来是同一个根因的任务，合并为一个任务，在同一个会话中处理。
- 有先后依赖的任务（例如 B 要用 A 新加的组件），A 放在前一批，B 放在下一批。
- 可能触及项目规则中高风险区域的任务，单独一批。
- 原因明显、只改一两行的小 bug，建议不开 worktree，直接在主目录修。
- 每批最多 3 个任务；超过时分成多批。

把分批结果和理由列给用户；定位只有 B、C 级证据的地方，说明分批可能需要调整。

### 3. 检查一次性准备

- **git exclude**：本机 git exclude 中要有 `/.claude/worktrees/` 和 `/docs/plans/` 两行。用 `git rev-parse --git-path info/exclude` 找到文件，用文件编辑工具追加缺少的行（已有就不追加，不改动原有内容）。
- **`.worktreeinclude`**：项目根目录没有这个文件时，查看根目录有哪些被 git 忽略、新 worktree 需要的本地文件（如 `.env.local`、`.env.development.local`，只看文件是否存在，不读取内容），列出建议写入的文件名，经用户确认后再创建。
- **起点**：请用户为本批选择新 worktree 的起点，然后等待回复。选项：远端默认分支（`git symbolic-ref --short refs/remotes/origin/HEAD`，取不到时不列）、当前分支（`git rev-parse --abbrev-ref HEAD`）、其他分支或提交（由用户输入）。用 `git rev-parse --verify <起点>^{commit}` 确认起点存在。个别任务需要不同起点时，用户可以单独指定。
- **未提交的改动**：`git status --porcelain` 中除 docs/plans/ 和 `.claude/worktrees/` 外还有改动时提醒用户：这些改动不会出现在新 worktree 中。

### 4. 生成每个任务的第一条消息

为本批每个任务生成一条可以直接粘贴的消息：
- 缺陷：`/req-bugfix --worktree=bug-<名> --base=<起点> <问题原文>`
- 需求：`/req-analysis --worktree=feat-<名> --base=<起点> <需求原文>`

`<起点>` 用分支名（例如 `origin/main`、`develop`）。命令新建 worktree 后，会把它对齐到这个起点。

并告诉用户怎么开始：
1. 在桌面应用中点 **+ New**（或 Cmd+N）新开会话，粘贴对应的消息发送。命令会自动创建 worktree、对齐到所选起点并进入。不要打开输入框下方的 Worktree 开关：那样会在会话开始时就按默认起点建好 worktree，命令无法再对齐到所选起点。
2. 每个会话会提示在 worktree 中安装依赖（`pnpm install` 等），并给出带端口的启动命令，例如第 1 个 worktree 用 5174、第 2 个用 5175。
3. 分析完成后，在同一个会话中运行 `/req-implement`。
4. 并排查看：在侧边栏右键会话，选择 Open in → Split view。

### 5. 保存跟踪文件

写入 `docs/plans/parallel-YYYYMMDD.md`（同名已存在时在末尾加 `-2`、`-3`），包含：起点分支、每个任务（类型、原文、worktree 名、分支名 `worktree-<名>`、所在批次、建议端口、轻量定位结果）、批次之间的依赖。

结束时说明：“已生成第 1 批的 N 条消息，请分别新开会话粘贴。各任务完成后，在这里运行 `/req-parallel 状态` 查看进度和合并顺序。”

## 状态模式

1. 读取 `docs/plans/` 下最新的 `parallel-*.md`；没有时根据 `git worktree list` 列出现有的 worktree。
2. 对每个任务的 worktree，读取或运行以下只读信息：
   - 是否存在：`git worktree list`
   - 未提交的改动：`git -C <worktree 路径> status --porcelain`
   - 已提交的改动：`git log --oneline <起点分支>..<分支>` 和 `git diff --stat <起点分支>...<分支>`
   - 进度：读取 worktree 中 docs/plans/ 下的方案文件，看状态、有没有“实现记录”和“实现、测试与审核报告”，以及报告中的审核结论
3. 汇总成表格：任务、阶段（未开始 / 分析中 / 待审批 / 实现中 / 已完成未提交 / 已提交 / 已合并）、改动的文件数、审核结论、需要用户做的事。
4. 冲突风险：列出被两个及以上分支改动的文件。
5. 合并顺序建议：先合并改动小、风险低、和别的分支没有重叠文件的；有重叠的，合并完前一个后，提醒后一个在自己的 worktree 中同步起点分支、重跑测试再合并。
6. 下一批：本批都已合并时，生成下一批任务的第一条消息（同“规划模式”第 4 步）。
7. 提醒：已完成但未提交的 worktree，归档会话前先提交。

只汇报，不合并、不推送、不删除 worktree。用户明确要求合并时，说明具体命令和顺序，由用户执行或另行确认。
