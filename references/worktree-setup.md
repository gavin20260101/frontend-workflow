# 并行工作区（worktree）的进入和环境检查

`/req-analysis` 和 `/req-bugfix` 共用。参数带 `--worktree` 时从第 1 步做起；没带、但当前已经在 worktree 中时，只做后面的环境检查。

1. 运行 `git rev-parse --git-dir` 和 `git rev-parse --git-common-dir`，两者不同说明已经在 worktree 中，跳过第 2～4 步。
2. 确定起点：参数中有 `--base` 时用它；没有时停下来，请用户在以下选项中选择，然后等待回复——
   - 远端默认分支：运行 `git symbolic-ref --short refs/remotes/origin/HEAD` 得到名字；取不到时不列这一项。
   - 当前分支：运行 `git rev-parse --abbrev-ref HEAD` 得到名字。
   - 其他分支或提交：由用户输入。
   用 `git rev-parse --verify <起点>^{commit}` 确认起点存在，记下提交号；不存在时请用户重新选择。当前目录有未提交的改动时提醒用户：这些改动不会带进 worktree。
3. 用 `git worktree list` 查看 `.claude/worktrees/<名字>` 是否已经存在，然后用 EnterWorktree 工具进入：已存在时传 `path` 进入它，并告诉用户这是继续使用已有的 worktree，跳过第 4 步；不存在时传 `name` 创建并进入。名字用参数中给出的；没有给出时用调用本文件的技能规定的默认名字。没有 EnterWorktree 工具时，请用户新开一个会话、打开输入框下方的 Worktree 开关后再运行本命令，然后停下。
4. 对齐起点（只针对第 3 步新建的 worktree）：运行 `git rev-parse HEAD`，与第 2 步记下的提交号相同就结束这一步。不同时，先确认 `git status --porcelain` 没有输出，再运行 `git reset --hard <记下的提交号>`，把这个新 worktree 的分支移到所选起点（只影响这个刚建好、还没有任何改动的 worktree；这个命令会请用户确认），完成后再用 `git rev-parse HEAD` 核对。`git status --porcelain` 有输出时不要执行，停下来说明情况。

只要当前在 worktree 中（包括用户用 Worktree 开关开的会话，判断方法同第 1 步），开始分析前先做环境检查：
- 本机 git exclude 中要有 `/.claude/worktrees/` 这一行：没有就按 `plan-file.md`（与本文件同目录）中追加 exclude 的方式追加（用文件编辑工具，已有就不追加），避免主目录把 worktree 当成未提交的改动。
- 依赖要已经安装（worktree 根目录下有 node_modules；Yarn PnP 项目看有没有 `.pnp.cjs`）：没有时给出命令（`cd <worktree 路径>`，再加上包管理器的安装命令，如 `pnpm install`），请用户在终端执行后回复，然后停下。不要自己安装。
- 访问端口：取本 worktree 在 `git worktree list` 中的序号 n（主目录为 0），建议端口为项目默认端口加 n（Vite 默认 5173），之后请用户启动本地页面时给出带端口的命令（如 `pnpm dev --port 5174`）。实际地址以用户启动后告知的为准。
- 方案“浏览器功能测试”的环境中写明 worktree 路径、分支名和实际访问地址。
