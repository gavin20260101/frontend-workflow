# 方案文件：保存前的检查和状态取值

## 会不会被提交进仓库

方案、测试方案和截图只留在本机。写入 `docs/plans/` 前先判断（以下 git 命令都是只读的）：

1. 运行 `git rev-parse --is-inside-work-tree`。失败说明不是 git 仓库：跳过本判断，在输出中注明。
2. 运行 `git ls-files -- docs/plans/`。有输出说明该目录已有文件被仓库跟踪：不要修改 git 配置，也不要执行 git rm，停下来告诉用户“docs/plans/ 已被仓库跟踪”，由用户决定是否继续写入。
3. 运行 `git check-ignore -q docs/plans/<文件名>.md`（文件还不存在也可以判断）：
   - 退出码 0：已被忽略，直接写入。
   - 退出码 1：未被忽略。运行 `git rev-parse --show-prefix` 和 `git rev-parse --git-path info/exclude`，用文件编辑工具（不用 echo 等终端命令）在 exclude 文件末尾追加一行 `/<前缀>docs/plans/`：前缀为空时就是 `/docs/plans/`；文件不存在就新建；已有相同的行就不追加；不改动原有内容。然后再运行一次 check-ignore，确认退出码为 0，并在输出中说明“已在本机 git exclude 中忽略 docs/plans/，只影响本机，不修改 .gitignore”。

## 状态取值

方案文件开头的状态行由不同的命令写入，读到时按下表理解：

| 状态 | 谁写的 | 含义 |
|---|---|---|
| `含待确认项` | /req-analysis、/req-bugfix | 有“需要特别确认的事项”，用户还没确认 |
| `待审批` | /req-analysis、/req-bugfix | 方案写完，等用户审阅后运行 /req-implement |
| `方案需重做` | 方案审核（plan-review.md） | 审核员的结论是“需要重做”，或有无法解决的“必须修改”意见，等用户决定 |
| `实现中` | /req-implement | 已记录实现基准，正在实现；做到哪里见“实现记录”里的“进度”小节 |
| `实现未通过` | /req-implement | 走到了报告步骤，但审核未通过或检查仍有失败 |
| `已完成` | /req-implement、/req-test | 报告已写完 |
| `测试中` | /req-test | 测试进行中 |
