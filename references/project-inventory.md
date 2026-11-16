# 测试现状：检查命令和浏览器测试条件

`/req-analysis`、`/req-bugfix`、`/req-test` 写“测试现状”时共用。逐项查明并写进输出；拿不准的按调用本文件的技能的规定处理（列为待确认事项，或写明采用的假设）。

可用的检查命令：逐个读出 test / lint / typecheck / build 等脚本的原文，并判断——
- 包管理器：以项目规则中的声明为准；没有声明时，看根目录存在哪个锁文件（只看是否存在，不读取内容）。
- 会修改文件的脚本（含 --fix、--write、-u、--updateSnapshot 等参数，包括通过 run-s / run-p 间接调用的子脚本）：不能作为检查命令，单独列出。
- 会进入 watch 或常驻的脚本（如不带 run 的 vitest、jest --watch、react-scripts test、dev / serve）：写出单次运行的写法，优先加 `CI=true` 前缀，或追加单次运行参数（如 vitest 的 `--run`、jest 的 `--watchAll=false`）；脚本里写死了 watch、无法单次运行的，单独列出。
- monorepo：检查命令要在子包里运行时，写成 `pnpm -C <子包目录> <脚本>`（npm 用 `--prefix <子包目录> run <脚本>`，yarn 用 `--cwd <子包目录> <脚本>`）。测试子代理的钩子不放行 `cd` 和 `--filter`。

浏览器测试条件：
- 项目是否已有 E2E 框架（Playwright Test、Cypress 等的配置文件和依赖）及其单次运行脚本。
- 启动本地页面的脚本（如 dev）和访问地址（看构建配置中的端口；Vite 默认为 http://localhost:5173）。
- 相关页面（待修改、出问题或被测的页面）是否需要登录，登录态从哪里来（页面登录、注入 token、开发环境免登录）。
- 接口数据来自测试环境、本地 mock，还是需要在浏览器中拦截模拟。
- 哪些功能依赖 App 环境（如 JSBridge、App 内登录），只能在真机上验证。
