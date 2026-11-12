// PreToolUse 钩子：req-code-reviewer、req-plan-reviewer 和任何名为 code-reviewer 的代理（目前是 pr-review-toolkit:code-reviewer；Superpowers 7.x 已不再自带代理）只读；req-test-runner 和 req-browser-tester 只改测试文件、只运行已有脚本；
// req-browser-tester 只能使用插件自带的浏览器服务，不能关闭用户 Chrome 中的标签页，浏览器工具只能把文件写到截图目录或临时目录。
// 主会话和其他代理的调用一律放行。拦截时以退出码 2 结束，stderr 的内容会返回给子代理。
// 这是防误操作的护栏，不是沙箱。
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const REVIEWERS = new Set(['req-code-reviewer', 'req-plan-reviewer', 'code-reviewer']);
const BROWSER_TESTER = 'req-browser-tester';
const TESTERS = new Set(['req-test-runner', BROWSER_TESTER]);
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
// 插件自带浏览器服务的工具名：mcp__[plugin_<插件名>_]browser-(ios|android|chrome|user-chrome|perf)__<工具>
const PLUGIN_BROWSER_TOOL = /^mcp__(plugin_.+_)?browser-(ios|android|chrome|user-chrome|perf)__/;
const UNSAFE_BROWSER_TOOL = /browser_run_code_unsafe$/;
const USER_CHROME_CLOSE_TOOL = /browser-user-chrome__browser_close$/;
// 浏览器工具中表示文件路径的参数；Playwright 的 filename 相对于输出目录，只允许纯文件名
const PATH_PARAM = /^(filePath|outputDirPath|outputPath|savePath|path|dir|directory)$/i;
const ARTIFACTS_DIR = path.join('docs', 'plans', 'browser-artifacts');

const GIT_READONLY = new Set(['diff', 'status', 'log', 'show', 'rev-parse', 'ls-files', 'merge-base', 'blame', 'check-ignore', 'grep']);
const PIPE_FILTERS = new Set(['head', 'tail', 'wc', 'grep', 'sort', 'cut']);
// 测试子代理可以单独使用的只读命令（重定向和命令替换仍然拦截）
const TESTER_READONLY = new Set(['ls', 'wc', 'echo']);
const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
const ALLOWED_ENV = /^(CI|NODE_ENV|TZ|FORCE_COLOR|NO_COLOR)=/;
const TEST_DIRS = new Set(['__tests__', '__mocks__', '__fixtures__', 'test', 'tests', 'e2e', 'fixtures']);
// 会修改文件、进入 watch 或交互模式（Playwright UI、cypress open）的参数
const FORBIDDEN_FLAGS = /(^|\s)(--fix(?!-dry-run)\b|--write\b|-u\b|--update\b|--updateSnapshot\b|--update-snapshots?\b|--watch(?!=false)\b|--watchAll(?!=false)\b|--ui\b|cypress\s+open\b)/;
const LONG_RUNNING_SCRIPT = /^(dev|serve|start|preview|watch)(:|$)/;

function deny(reason) {
  process.stderr.write(`[req 插件守卫] ${reason}\n`);
  process.exit(2);
}

// 按未加引号的 | ; & 换行拆分命令；命令替换和未加引号的重定向视为不安全
function splitCommand(command) {
  const cleaned = command.replace(/\d?>\s*\/dev\/null/g, ' ').replace(/\d?>&\d/g, ' ');
  const segments = [];
  let current = '';
  let quote = null;
  let unsafe = null;
  let piped = false;
  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (quote === "'") {
      if (c === "'") quote = null;
      current += c;
      continue;
    }
    if (c === '\\') {
      current += c + (cleaned[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '`' || (c === '$' && cleaned[i + 1] === '(')) unsafe ??= '命令替换';
    if (quote === '"') {
      if (c === '"') quote = null;
      current += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      current += c;
      continue;
    }
    if (c === '>' || c === '<') {
      unsafe ??= '重定向';
      current += c;
      continue;
    }
    if (c === '|' || c === ';' || c === '&' || c === '\n') {
      segments.push({ text: current.trim(), piped });
      const doubled = (c === '|' || c === '&') && cleaned[i + 1] === c;
      if (doubled) i++;
      piped = c === '|' && !doubled;
      current = '';
      continue;
    }
    current += c;
  }
  segments.push({ text: current.trim(), piped });
  return { segments: segments.filter((s) => s.text), unsafe };
}

const toWords = (text) => text.split(/\s+/).map((w) => w.replace(/['"]/g, ''));

// git [--no-pager] [-C <当前目录>] <只读子命令>；不允许 -c 等其他全局参数和写文件的参数
function isReadonlyGit(words, cwd) {
  let i = 1;
  while (words[i] === '--no-pager' || words[i] === '-C') {
    if (words[i] === '-C') {
      if (!words[i + 1] || realpathOrSelf(path.resolve(cwd, words[i + 1])) !== realpathOrSelf(cwd)) return false;
      i += 2;
    } else {
      i += 1;
    }
  }
  if (!GIT_READONLY.has(words[i])) return false;
  return !words.some((w) => /^(--(output|ext-diff|open-files-in-pager)|-O)/.test(w));
}

function readScripts(cwd) {
  let dir = cwd;
  while (true) {
    const file = path.join(dir, 'package.json');
    if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8')).scripts ?? {};
    const parent = path.dirname(dir);
    if (parent === dir) return {};
    dir = parent;
  }
}

// 脚本本身及其 pre/post 脚本、通过 run-s / run-p / npm run 间接调用的脚本
function scriptBodies(scripts, name, seen = new Set()) {
  if (seen.has(name) || !(name in scripts)) return [];
  seen.add(name);
  const bodies = [String(scripts[name])];
  for (const extra of [`pre${name}`, `post${name}`]) bodies.push(...scriptBodies(scripts, extra, seen));
  for (const token of bodies[0].split(/[\s"'&|;]+/)) {
    if (!token) continue;
    const pattern = token.includes('*')
      ? new RegExp(`^${token.replace(/[.+?^${}()[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/(?<!\.)\*/g, '[^:]*')}$`)
      : null;
    for (const other of Object.keys(scripts)) {
      if (pattern ? pattern.test(other) : other === token) bodies.push(...scriptBodies(scripts, other, seen));
    }
  }
  return bodies;
}

function checkReviewerBash(agentName, command, cwd) {
  const { segments, unsafe } = splitCommand(command);
  if (unsafe) return `${agentName} 不能使用${unsafe}`;
  for (const { text, piped } of segments) {
    const words = toWords(text);
    const ok = piped ? PIPE_FILTERS.has(words[0]) : words[0] === 'git' && isReadonlyGit(words, cwd);
    if (!ok) {
      return `${agentName} 只能执行只读 git 命令（${[...GIT_READONLY].join('、')}），管道后只能接 ${[...PIPE_FILTERS].join('、')}；读取文件请用 Read、Grep、Glob 工具。被拦截的部分：${text}`;
    }
  }
  return null;
}

function checkTesterSegment(words, scripts, cwd) {
  let i = 0;
  while (i < words.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(words[i])) {
    if (!ALLOWED_ENV.test(words[i])) return `不能设置环境变量 ${words[i].split('=')[0]}`;
    i++;
  }
  const [cmd, sub, ...rest] = words.slice(i);
  if (cmd === 'git') {
    return isReadonlyGit(words.slice(i), cwd) ? null : `只能执行只读 git 命令（${[...GIT_READONLY].join('、')}；-C 只能指向当前项目目录）`;
  }
  if (TESTER_READONLY.has(cmd)) return null;
  if (!PACKAGE_MANAGERS.has(cmd)) return `只能运行 package.json 中已有的脚本、只读 git 命令和 ${[...TESTER_READONLY].join('、')}`;

  let script;
  let args;
  if (sub === 'run' || sub === 'run-script') [script, ...args] = rest;
  else if (sub === 'test' || sub === 't') [script, args] = ['test', rest];
  else if (cmd !== 'npm' && sub && !sub.startsWith('-')) [script, args] = [sub, rest];
  if (!script || !(script in scripts)) return `只能运行 package.json 中已有的脚本（未找到：${script ?? sub ?? cmd}）`;

  if (LONG_RUNNING_SCRIPT.test(script)) return `脚本 ${script} 会启动常驻进程`;
  if (FORBIDDEN_FLAGS.test(` ${args.join(' ')}`)) return '不能追加会修改文件、进入 watch 或交互模式的参数';
  for (const body of scriptBodies(scripts, script)) {
    if (FORBIDDEN_FLAGS.test(` ${body}`)) return `脚本 ${script} 会自动修改文件、进入 watch 或交互模式（${body}），请交给主代理决定`;
  }
  return null;
}

function checkTesterBash(agentName, command, cwd) {
  const { segments, unsafe } = splitCommand(command);
  if (unsafe) return `${agentName} 不能使用${unsafe}`;
  const scripts = readScripts(cwd);
  for (const { text, piped } of segments) {
    const words = toWords(text);
    const reason = piped
      ? PIPE_FILTERS.has(words[0]) ? null : `管道后只能接 ${[...PIPE_FILTERS].join('、')}`
      : checkTesterSegment(words, scripts, cwd);
    if (reason) return `${agentName}：${reason}。被拦截的部分：${text}`;
  }
  return null;
}

function isTestFile(relative) {
  const parts = relative.split(/[\\/]/);
  const base = parts[parts.length - 1];
  if (parts.includes('__snapshots__') || base.endsWith('.snap')) return false;
  if (/\.(test|spec)\.[^.]+$/.test(base)) return true;
  return parts.slice(0, -1).some((p) => TEST_DIRS.has(p));
}

function checkTesterWrite(agentName, params, cwd) {
  const target = params.file_path ?? params.notebook_path;
  if (!target) return '无法确定要修改的文件';
  const relative = path.relative(cwd, path.resolve(cwd, target));
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return `${agentName} 只能修改项目内的测试文件：${target}`;
  }
  if (!isTestFile(relative)) {
    return `${agentName} 只能修改测试文件（*.test.*、*.spec.*，或 __tests__、__mocks__、__fixtures__、test、tests、e2e、fixtures 目录下的文件，快照除外）：${relative}`;
  }
  return null;
}

function realpathOrSelf(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}

function checkBrowserFileParams(params, cwd) {
  const tmp = os.tmpdir();
  const allowedRoots = [path.join(cwd, ARTIFACTS_DIR), tmp, realpathOrSelf(tmp)];
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== 'string' || !value) continue;
    if (key === 'filename') {
      if (/[\\/]/.test(value) || value.includes('..')) return `filename 只能写文件名，不能带目录：${value}`;
      continue;
    }
    if (!PATH_PARAM.test(key)) continue;
    const resolved = path.resolve(cwd, value);
    if (!allowedRoots.some((root) => resolved === root || resolved.startsWith(root + path.sep))) {
      return `浏览器工具的文件只能放在 docs/plans/browser-artifacts/ 或系统临时目录下：${key}=${value}`;
    }
  }
  return null;
}

function checkMcpTool(agentName, tool, params, cwd) {
  if (agentName !== BROWSER_TESTER) return `${agentName} 不能使用 MCP 工具：${tool}`;
  if (!PLUGIN_BROWSER_TOOL.test(tool)) {
    return `${agentName} 只能使用插件自带的 browser-ios、browser-android、browser-chrome、browser-user-chrome、browser-perf 浏览器工具：${tool}`;
  }
  if (UNSAFE_BROWSER_TOOL.test(tool)) return `${agentName} 不能使用 browser_run_code_unsafe`;
  if (USER_CHROME_CLOSE_TOOL.test(tool)) return `${agentName} 不能在用户正在使用的 Chrome 中使用 browser_close`;
  const fileReason = checkBrowserFileParams(params, cwd);
  return fileReason ? `${agentName}：${fileReason}` : null;
}

let input;
try {
  input = JSON.parse(readFileSync(0, 'utf8'));
} catch {
  process.exit(0);
}

// agent_type 可能是带插件名的 "<插件名>:req-test-runner"，也可能是裸名
const agent = String(input.agent_type ?? '').split(':').pop();
if (!REVIEWERS.has(agent) && !TESTERS.has(agent)) process.exit(0);

const tool = String(input.tool_name ?? '');
const params = input.tool_input ?? {};
const cwd = input.cwd || process.cwd();

try {
  let reason = null;
  if (tool.startsWith('mcp__')) {
    reason = checkMcpTool(agent, tool, params, cwd);
  } else if (REVIEWERS.has(agent)) {
    if (WRITE_TOOLS.has(tool)) reason = `${agent} 是只读审核员，不能修改任何文件`;
    else if (tool === 'Bash') reason = checkReviewerBash(agent, String(params.command ?? ''), cwd);
  } else if (WRITE_TOOLS.has(tool)) {
    reason = checkTesterWrite(agent, params, cwd);
  } else if (tool === 'Bash') {
    reason = checkTesterBash(agent, String(params.command ?? ''), cwd);
  }
  if (reason) deny(reason);
} catch (error) {
  deny(`守卫脚本出错，已拦截本次操作：${error.message}`);
}
process.exit(0);
