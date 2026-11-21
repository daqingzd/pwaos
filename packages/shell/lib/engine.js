'use strict';

/**
 * PwaOS Shell - command engine (Node host side).
 *
 * A busybox-flavoured builtin command set implemented on top of Node's fs
 * and child_process, with a fish-style prompt (cwd + git branch when
 * available) and bash-style history (up/down arrows, `history` command).
 *
 * Everything here is synchronous-and-small on purpose: the shell must feel
 * immediate and must never spawn anything it did not explicitly ask for.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const VERSION = '0.1.0';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_OUT_CHARS = 200_000;       // per-command output cap sent to the UI
const HISTFILE_NAME = '.pwaos-shell-history';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[90m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

// ---------------------------------------------------------------------------
// Output buffer passed to every command
// ---------------------------------------------------------------------------

class Out {
  constructor() {
    this.chunks = [];
    this.length = 0;
    this.truncated = false;
  }
  write(s) {
    if (this.truncated) return;
    const str = String(s);
    this.length += str.length;
    this.chunks.push(str);
    if (this.length > MAX_OUT_CHARS) {
      this.truncated = true;
      this.chunks.push(`\r\n... output truncated at ${MAX_OUT_CHARS} chars ...\r\n`);
    }
  }
  line(s) { this.write(`${s == null ? '' : s}\r\n`); }
  text() { return this.chunks.join(''); }
}

// ---------------------------------------------------------------------------
// Shell session state
// ---------------------------------------------------------------------------

class ShellEngine {
  constructor(home) {
    this.cwd = home || os.homedir();
    this.env = Object.assign({}, process.env, {
      PWD: this.cwd,
      HOME: home || os.homedir(),
      TERM: 'xterm-256color',
      PWAOS_SHELL: VERSION,
    });
    this.history = [];
    this.historyIndex = -1;          // for up/down browsing
    this.draftLine = '';             // line being edited while browsing
    this.inputLine = '';             // current editable input
    this.running = false;
    this.alias = { ll: 'ls -la', la: 'ls -a' };
    this.histfile = path.join(this.env.HOME, HISTFILE_NAME);
    this._loadHistory();
  }

  // --- history -------------------------------------------------------------
  _loadHistory() {
    try {
      const raw = fs.readFileSync(this.histfile, 'utf8');
      this.history = raw.split('\n').filter((l) => l.trim().length > 0);
    } catch (_) { /* first run */ }
    if (this.history.length > 1000) this.history = this.history.slice(-1000);
  }

  _saveHistory() {
    try { fs.writeFileSync(this.histfile, this.history.join('\n') + '\n'); }
    catch (_) { /* read-only home - history stays in memory */ }
  }

  _pushHistory(line) {
    if (!line.trim()) return;
    if (this.history[this.history.length - 1] === line) return; // dedupe
    this.history.push(line);
    if (this.history.length > 1000) this.history.shift();
    this._saveHistory();
  }

  // --- prompt (fish-style: user@host cwd (git-branch)) ----------------------
  prompt() {
    const user = this.env.USER || this.env.USERNAME || 'user';
    const host = os.hostname().split('.')[0];
    const home = this.env.HOME;
    let cwd = this.cwd;
    if (cwd === home) cwd = '~';
    else if (cwd.startsWith(home + path.sep)) cwd = '~' + cwd.slice(home.length);
    let gitPart = '';
    try {
      const g = spawnSync('git', ['-C', this.cwd, 'symbolic-ref', '--short', 'HEAD'],
        { timeout: 500 });
      if (g.status === 0 && g.stdout) {
        gitPart = ` \x1b[35m(${g.stdout.toString().trim()})\x1b[0m`;
      }
    } catch (_) { /* git missing */ }
    return `${C.green}${user}@${host}${C.reset} ${C.cyan}${cwd}${C.reset}${gitPart} ${C.bold}$${C.reset} `;
  }

  // --- filesystem helpers ---------------------------------------------------
  _resolve(p) {
    if (!p || p === '.') return this.cwd;
    const ex = p.startsWith('~');
    if (ex) p = path.join(this.env.HOME, p.slice(1));
    return path.resolve(this.cwd, p);
  }

  _statSafe(p) {
    try { return fs.statSync(p); } catch (_) { return null; }
  }

  _fmtSize(n) {
    if (n < 1024) return `${n}`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}K`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}M`;
    return `${(n / 1024 / 1024 / 1024).toFixed(1)}G`;
  }

  _fmtMode(st) {
    const m = st.mode;
    const bit = (v, c) => (m & v ? c : '-');
    const type = st.isDirectory() ? 'd' : st.isSymbolicLink() ? 'l' : '-';
    return type + [
      [0o400, 'r'], [0o200, 'w'], [0o100, 'x'],
      [0o040, 'r'], [0o020, 'w'], [0o010, 'x'],
      [0o004, 'r'], [0o002, 'w'], [0o001, 'x'],
    ].map(([v, c]) => bit(v, c)).join('');
  }

  _fmtDate(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
      `${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  _listDir(target, out, opts) {
    let names;
    try { names = fs.readdirSync(target); }
    catch (e) { out.line(`ls: ${e.message}`); return; }
    if (opts.all) names.push('.', '..');
    names.sort((a, b) => a.localeCompare(b));
    if (opts.long) {
      let total = 0;
      const rows = [];
      for (const name of names) {
        const full = path.join(target, name);
        const st = this._statSafe(full);
        if (!st) { rows.push([`??????????`, 0, '', '', 0, '', name]); continue; }
        total += st.blocks * 512;
        rows.push([
          this._fmtMode(st), String(st.npad || st.nlink || 1),
          st.uid != null ? String(st.uid) : '',
          st.gid != null ? String(st.gid) : '',
          st.size, this._fmtDate(st.mtime), name,
        ]);
      }
      out.line(`total ${Math.ceil(total / 1024)}`);
      for (const r of rows) {
        out.line(`${r[0]} ${r[1].padStart(3)} ${r[2].padEnd(6)} ${r[3].padEnd(6)} ` +
          `${this._fmtSize(Number(r[4])).padStart(7)} ${r[5]} ${r[6]}`);
      }
    } else {
      // columns: simple flow layout
      const width = Math.max(...names.map((n) => n.length), 1) + 2;
      const perLine = Math.max(1, Math.floor(110 / width));
      for (let i = 0; i < names.length; i += perLine) {
        out.line(names.slice(i, i + perLine)
          .map((n) => {
            const st = this._statSafe(path.join(target, n));
            const isDir = st && st.isDirectory();
            return isDir ? `${C.cyan}${n}${C.reset}` : n;
          })
          .map((n, j) => (j === perLine - 1 ? n : n.padEnd(width + (n.includes('\x1b') ? 9 : 0))))
          .join(''));
      }
    }
  }

  // --- command table ---------------------------------------------------------
  commands() {
    const self = this;
    return {
      help: {
        desc: 'Print the command list',
        run: (args, out) => {
          out.line('PwaOS Shell builtins:');
          const names = Object.keys(this._table()).sort();
          for (const n of names) {
            out.line(`  ${n.padEnd(10)} ${this._table()[n].desc}`);
          }
          out.line('');
          out.line('Other line commands:');
          out.line('  !<n>       re-run history item n        Ctrl+C cancel line');
          out.line('  Up/Down    browse history               Tab path completion');
        },
      },
      pwd: { desc: 'Print working directory', run: (a, out) => out.line(this.cwd) },
      cd: {
        desc: 'Change directory, usage: cd {path|~|-}',
        run: (args, out) => {
          let target = args[0];
          if (!target || target === '~') target = this.env.HOME;
          else if (target === '-') {
            const prev = this.env.OLDPWD || this.env.HOME;
            target = prev;
          }
          const p = this._resolve(target);
          const st = this._statSafe(p);
          if (!st) { out.line(`cd: no such directory: ${target}`); return; }
          if (!st.isDirectory()) { out.line(`cd: not a directory: ${target}`); return; }
          this.env.OLDPWD = this.cwd;
          this.cwd = p;
          this.env.PWD = p;
        },
      },
      ls: {
        desc: 'List directory contents, usage: ls [-la] {path}',
        run: (args, out) => {
          const opts = { all: false, long: false };
          const paths = [];
          for (const a of args) {
            if (a.startsWith('-')) {
              if (a.includes('a')) opts.all = true;
              if (a.includes('l')) opts.long = true;
            } else paths.push(a);
          }
          const targets = paths.length ? paths.map((p) => this._resolve(p)) : [this.cwd];
          for (let i = 0; i < targets.length; i++) {
            if (targets.length > 1) out.line(`${targets[i]}:`);
            const st = this._statSafe(targets[i]);
            if (!st) { out.line(`ls: cannot access '${targets[i]}'`); continue; }
            if (st.isFile()) { out.line(path.basename(targets[i])); continue; }
            this._listDir(targets[i], out, opts);
            if (i < targets.length - 1) out.line('');
          }
        },
      },
      cat: {
        desc: 'Concatenate files to output, usage: cat {file...}',
        run: (args, out) => {
          if (!args.length) { out.line('cat: missing operand'); return; }
          for (const a of args) {
            const p = this._resolve(a);
            const st = this._statSafe(p);
            if (!st) { out.line(`cat: ${a}: no such file`); continue; }
            if (st.isDirectory()) { out.line(`cat: ${a}: is a directory`); continue; }
            try { out.write(fs.readFileSync(p, 'utf8')); }
            catch (e) { out.line(`cat: ${a}: ${e.message}`); }
          }
        },
      },
      echo: { desc: 'Print arguments, usage: echo {text...}', run: (a, out) => out.line(a.join(' ')) },
      mkdir: {
        desc: 'Create directories, usage: mkdir [-p] {dir...}',
        run: (args, out) => {
          const recursive = args.filter((a) => a.startsWith('-')).join('').includes('p');
          const dirs = args.filter((a) => !a.startsWith('-'));
          for (const d of dirs) {
            try { fs.mkdirSync(this._resolve(d), { recursive }); }
            catch (e) { out.line(`mkdir: ${d}: ${e.message}`); }
          }
        },
      },
      rm: {
        desc: 'Remove files/dirs, usage: rm [-rf] {path...}',
        run: (args, out) => {
          const flags = args.filter((a) => a.startsWith('-')).join('');
          const recursive = flags.includes('r') || flags.includes('R');
          const force = flags.includes('f');
          const targets = args.filter((a) => !a.startsWith('-'));
          for (const t of targets) {
            const p = this._resolve(t);
            const st = this._statSafe(p);
            if (!st) { if (!force) out.line(`rm: ${t}: no such file`); continue; }
            try {
              if (st.isDirectory()) {
                if (!recursive) { out.line(`rm: ${t}: is a directory`); continue; }
                fs.rmSync(p, { recursive: true, force });
              } else fs.unlinkSync(p);
            } catch (e) { out.line(`rm: ${t}: ${e.message}`); }
          }
        },
      },
      touch: {
        desc: 'Create empty files / update mtime, usage: touch {file...}',
        run: (args, out) => {
          for (const t of args) {
            const p = this._resolve(t);
            try {
              const now = new Date();
              if (this._statSafe(p)) fs.utimesSync(p, now, now);
              else fs.writeFileSync(p, '');
            } catch (e) { out.line(`touch: ${t}: ${e.message}`); }
          }
        },
      },
      cp: {
        desc: 'Copy files, usage: cp {src...} {dst}',
        run: (args, out) => {
          if (args.length < 2) { out.line('cp: usage: cp src... dst'); return; }
          const dst = this._resolve(args[args.length - 1]);
          for (const s of args.slice(0, -1)) {
            const sp = this._resolve(s);
            try {
              const st = this._statSafe(sp);
              const dp = this._statSafe(dst) && this._statSafe(dst).isDirectory()
                ? path.join(dst, path.basename(sp)) : dst;
              fs.cpSync(sp, dp, { recursive: st ? st.isDirectory() : false });
            } catch (e) { out.line(`cp: ${s}: ${e.message}`); }
          }
        },
      },
      mv: {
        desc: 'Move/rename, usage: mv {src...} {dst}',
        run: (args, out) => {
          if (args.length < 2) { out.line('mv: usage: mv src... dst'); return; }
          const dst = this._resolve(args[args.length - 1]);
          for (const s of args.slice(0, -1)) {
            try {
              const sp = this._resolve(s);
              const st = this._statSafe(dst);
              const dp = st && st.isDirectory() ? path.join(dst, path.basename(sp)) : dst;
              fs.renameSync(sp, dp);
            } catch (e) { out.line(`mv: ${s}: ${e.message}`); }
          }
        },
      },
      wc: {
        desc: 'Count lines/words/chars, usage: wc {file}',
        run: (args, out) => {
          const p = args[0] && this._resolve(args[0]);
          let data = '';
          try { data = p ? fs.readFileSync(p, 'utf8') : ''; }
          catch (e) { out.line(`wc: ${e.message}`); return; }
          const lines = (data.match(/\n/g) || []).length;
          const words = data.split(/\s+/).filter(Boolean).length;
          out.line(`${lines} ${words} ${data.length}${p ? ' ' + args[0] : ''}`);
        },
      },
      head: {
        desc: 'First lines of a file, usage: head [-n N] {file}',
        run: (args, out) => {
          let n = 10; const files = [];
          for (let i = 0; i < args.length; i++) {
            if (args[i] === '-n') n = parseInt(args[++i], 10) || 10;
            else if (args[i].startsWith('-') && /^\-\d+$/.test(args[i])) n = parseInt(args[i].slice(1), 10);
            else files.push(args[i]);
          }
          for (const f of files) {
            try {
              const data = fs.readFileSync(this._resolve(f), 'utf8');
              out.write(data.split('\n').slice(0, n).join('\n') + '\r\n');
            } catch (e) { out.line(`head: ${f}: ${e.message}`); }
          }
        },
      },
      tail: {
        desc: 'Last lines of a file, usage: tail [-n N] {file}',
        run: (args, out) => {
          let n = 10; const files = [];
          for (let i = 0; i < args.length; i++) {
            if (args[i] === '-n') n = parseInt(args[++i], 10) || 10;
            else files.push(args[i]);
          }
          for (const f of files) {
            try {
              const data = fs.readFileSync(this._resolve(f), 'utf8').replace(/\n$/, '');
              out.write(data.split('\n').slice(-n).join('\n') + '\r\n');
            } catch (e) { out.line(`tail: ${f}: ${e.message}`); }
          }
        },
      },
      grep: {
        desc: 'Search in files, usage: grep [-i] {pattern} {file...}',
        run: (args, out) => {
          let ignoreCase = false;
          const rest = [];
          for (const a of args) {
            if (a === '-i') ignoreCase = true; else rest.push(a);
          }
          const [pattern, ...files] = rest;
          if (!pattern || !files.length) { out.line('grep: usage: grep [-i] pattern file...'); return; }
          let re;
          try { re = new RegExp(pattern, ignoreCase ? 'i' : ''); }
          catch (e) { out.line(`grep: bad pattern: ${e.message}`); return; }
          for (const f of files) {
            try {
              const data = fs.readFileSync(this._resolve(f), 'utf8');
              data.split('\n').forEach((line, idx) => {
                if (re.test(line)) {
                  out.line(files.length > 1 ? `${f}:${idx + 1}: ${line}` : `${idx + 1}: ${line}`);
                }
              });
            } catch (e) { out.line(`grep: ${f}: ${e.message}`); }
          }
        },
      },
      stat: {
        desc: 'File status, usage: stat {file}',
        run: (args, out) => {
          const p = args[0] && this._resolve(args[0]);
          const st = p && this._statSafe(p);
          if (!st) { out.line('stat: no such file'); return; }
          out.line(`  File: ${p}`);
          out.line(`  Size: ${st.size}\tType: ${st.isDirectory() ? 'directory' : st.isFile() ? 'regular file' : 'other'}`);
          out.line(`Access: (${(st.mode & 0o777).toString(8)}/${this._fmtMode(st)})  Uid: ${st.uid}  Gid: ${st.gid}`);
          out.line(`Modify: ${st.mtime.toISOString()}`);
        },
      },
      df: {
        desc: 'Disk usage of the filesystem',
        run: (a, out) => {
          try {
            const s = fs.statfsSync ? fs.statfsSync(this.cwd) : null;
            if (!s) throw new Error('statfs unsupported');
            const total = s.blocks * s.bsize;
            const free = s.bavail * s.bsize;
            const used = total - free;
            out.line(`Filesystem     Size   Used  Avail  Use%  Mounted on`);
            out.line(`local          ${this._fmtSize(total).padStart(5)} ${this._fmtSize(used).padStart(5)} ${this._fmtSize(free).padStart(5)} ${((used / total) * 100).toFixed(0).padStart(4)}%  ${this.cwd}`);
          } catch (e) { out.line(`df: ${e.message}`); }
        },
      },
      ps: {
        desc: 'List processes (snapshot)',
        run: (a, out) => {
          const g = spawnSync('ps', ['-o', 'pid,comm,%cpu,%mem', '-p', String(process.pid)],
            { timeout: 2000 });
          if (g.status === 0) out.write(g.stdout.toString().replace(/\n/g, '\r\n') + '\r\n');
          else out.line(`ps ${process.pid} (pid of this shell)`);
        },
      },
      date: { desc: 'Print current date/time', run: (a, out) => out.line(new Date().toString()) },
      uname: {
        desc: 'System information, usage: uname [-a]',
        run: (args, out) => {
          if (args[0] === '-a') {
            out.line(`${os.type()} ${os.hostname()} ${os.release()} #pwaos ${os.arch()} ${os.platform()}`);
          } else {
            out.line(os.type());
          }
        },
      },
      env: {
        desc: 'Print environment / run with var, usage: env [VAR=value] {cmd}',
        run: (args, out) => {
          const vars = [];
          let i = 0;
          for (; i < args.length; i++) {
            if (args[i].includes('=')) {
              const [k, ...v] = args[i].split('=');
              this.env[k] = v.join('=');
              vars.push(k);
            } else break;
          }
          if (i < args.length) { this.run(args.slice(i).join(' '), out); return; }
          for (const k of Object.keys(this.env).sort()) out.line(`${k}=${this.env[k]}`);
        },
      },
      which: {
        desc: 'Locate a command, usage: which {cmd}',
        run: (args, out) => {
          const c = args[0];
          if (!c) return;
          if (this._table()[c]) { out.line(`${c}: shell builtin`); return; }
          const dirs = (this.env.PATH || '').split(path.delimiter);
          for (const d of dirs) {
            const p = path.join(d, c);
            try { fs.accessSync(p, fs.constants.X_OK); out.line(p); return; }
            catch (_) {}
          }
          out.line(`which: no ${c} in PATH`);
        },
      },
      history: {
        desc: 'Show command history, usage: history',
        run: (a, out) => {
          this.history.forEach((h, i) => out.line(`${String(i + 1).padStart(4)}  ${h}`));
        },
      },
      clear: { desc: 'Clear the screen', run: (a, out) => { out.jsonControl = { type: 'reset' }; } },
      alias: {
        desc: 'Show aliases, usage: alias',
        run: (a, out) => {
          for (const k of Object.keys(this.alias)) out.line(`alias ${k}='${this.alias[k]}'`);
        },
      },
      hostname: { desc: 'Print hostname', run: (a, out) => out.line(os.hostname()) },
      whoami: { desc: 'Print effective user', run: (a, out) => out.line(this.env.USER || 'user') },
      sleep: {
        desc: 'Pause seconds, usage: sleep {n}',
        run: (a, out) => {
          const n = Math.min(parseFloat(a[0]) || 0, 5);
          const end = Date.now() + n * 1000;
          while (Date.now() < end) { /* bounded busy-wait */ }
        },
      },
      version: { desc: 'Print shell version', run: (a, out) => out.line(`PwaOS Shell ${VERSION}`) },
      exit: { desc: 'Quit the shell', run: (a, out) => { out.jsonControl = { type: 'quit' }; } },
    };
  }

  _table() {
    if (!this._cachedTable) this._cachedTable = this.commands();
    return this._cachedTable;
  }

  // --- line editing ----------------------------------------------------------
  handleKey(data, emit) {
    // data: one keystroke OR a chunk from xterm onData. Escape sequences
    // (arrow keys etc.) arrive as multi-char '\x1b[A' strings - iterate over
    // sequence boundaries, not single chars, or '[A' leaks through as text.
    let i = 0;
    const seqs = [];
    while (i < data.length) {
      if (data[i] === '\u001b') {
        // CSI: ESC [ <params> <final>
        const m = /^(\u001b\[[0-9;?]*[A-Za-z~])/.exec(data.slice(i));
        if (m) { seqs.push(m[1]); i += m[1].length; continue; }
        // lone ESC
        seqs.push('\u001b'); i += 1; continue;
      }
      seqs.push(data[i]);
      i += 1;
    }
    for (const ch of seqs) {
      if (ch === '\r') {
        const line = this.inputLine;
        this.inputLine = '';
        this.historyIndex = -1;
        this.draftLine = '';
        emit.write('\r\n');
        this._pushHistory(line.trim());
        if (line.trim()) this.execute(line.trim(), emit);
        else emit.write(this.prompt());
        continue;
      }
      if (ch === '\u0003') { // Ctrl+C
        this.inputLine = '';
        this.historyIndex = -1;
        emit.write('^C\r\n' + this.prompt());
        continue;
      }
      if (ch === '\u007f' || ch === '\b') { // backspace
        if (this.inputLine.length > 0) {
          this.inputLine = this.inputLine.slice(0, -1);
          emit.write('\b \b');
        }
        continue;
      }
      if (ch === '\u001b[A') { // Up
        if (!this.history.length) continue;
        if (this.historyIndex === -1) {
          this.draftLine = this.inputLine;
          this.historyIndex = this.history.length;
        }
        if (this.historyIndex > 0) {
          this.historyIndex--;
          this._replaceInput(this.history[this.historyIndex], emit);
        }
        continue;
      }
      if (ch === '\u001b[B') { // Down
        if (this.historyIndex === -1) continue;
        if (this.historyIndex < this.history.length - 1) {
          this.historyIndex++;
          this._replaceInput(this.history[this.historyIndex], emit);
        } else {
          this.historyIndex = -1;
          this._replaceInput(this.draftLine, emit);
        }
        continue;
      }
      if (ch === '\u001b[C' || ch === '\u001b[D') continue; // left/right: ignore (simple editor)
      if (ch === '\t') { this._complete(emit); continue; }
      // printable chars (incl. pasted text)
      if (ch >= ' ' || ch === '\u0009') {
        this.inputLine += ch;
        emit.write(ch);
      }
    }
  }

  _replaceInput(newLine, emit) {
    const cur = this.inputLine;
    // erase current then write new (simple approach - cursor is at EOL)
    for (let i = 0; i < cur.length; i++) emit.write('\b');
    for (let i = 0; i < cur.length; i++) emit.write(' ');
    for (let i = 0; i < cur.length; i++) emit.write('\b');
    this.inputLine = newLine;
    emit.write(newLine);
  }

  _complete(emit) {
    const line = this.inputLine;
    const parts = line.split(/\s+/);
    const last = parts[parts.length - 1] || '';
    const isCmdPos = parts.length === 1;
    let candidates = [];
    if (isCmdPos) {
      const table = this._table();
      candidates = Object.keys(table).filter((c) => c.startsWith(last)).sort();
    } else {
      const dirPart = last.includes('/')
        ? last.slice(0, last.lastIndexOf('/') + 1) : '';
      const base = last.slice(dirPart.length);
      const dirPath = this._resolve(dirPart || '.');
      try {
        candidates = fs.readdirSync(dirPath)
          .filter((n) => n.startsWith(base))
          .map((n) => {
            const st = this._statSafe(path.join(dirPath, n));
            return st && st.isDirectory() ? n + '/' : n;
          })
          .sort();
      } catch (_) { /* unreadable dir */ }
    }
    if (candidates.length === 1) {
      const c = candidates[0];
      const add = c.slice(last.length - (last.endsWith('/') && c.endsWith('/') ? 1 : 0));
      // complete + trailing space for commands, path as-is
      this.inputLine += add + (isCmdPos ? ' ' : '');
      emit.write(add + (isCmdPos ? ' ' : ''));
    } else if (candidates.length > 1) {
      // common prefix
      let prefix = candidates[0];
      for (const c of candidates) {
        while (!c.startsWith(prefix)) prefix = prefix.slice(0, -1);
      }
      if (prefix.length > last.length) {
        const add = prefix.slice(last.length);
        this.inputLine += add;
        emit.write(add);
      } else {
        emit.write('\r\n' + candidates.map((c) => c.padEnd(20)).join('') + '\r\n' + this.prompt() + this.inputLine);
      }
    }
  }

  // --- execution ---------------------------------------------------------------
  execute(rawLine, emit) {
    const out = new Out();
    let line = rawLine.trim();
    // Record executed commands in history (direct calls, not !n expansions -
    // those already re-ran a recorded line).
    if (!/^!\d+$/.test(line) && line) this._pushHistory(line);
    // history expansion: !n
    const bang = line.match(/^!(-?\d+)$/);
    if (bang) {
      let idx = parseInt(bang[1], 10);
      if (idx < 0) idx = this.history.length + idx + 1; // !-1 = last
      if (idx < 1 || idx > this.history.length) {
        emit.line(`!${bang[1]}: event not found`);
        emit.write(this.prompt());
        return;
      }
      line = this.history[idx - 1];
      emit.line(line); // echo the expanded command
    }
    // alias expansion (single hop)
    const first = line.split(/\s+/)[0];
    if (this.alias[first]) line = this.alias[first] + line.slice(first.length);

    // PWD env-style assignments for external commands: VAR=val cmd handled in env
    this.run(line, out, emit);
  }

  run(line, out, emit) {
    // tokenize respecting quotes
    const tokens = [];
    let cur = '';
    let quote = null;
    for (const ch of line) {
      if (quote) {
        if (ch === quote) quote = null;
        else cur += ch;
      } else if (ch === '"' || ch === "'") quote = ch;
      else if (/\s/.test(ch)) {
        if (cur) { tokens.push(cur); cur = ''; }
      } else cur += ch;
    }
    if (cur) tokens.push(cur);
    if (!tokens.length) { if (emit) emit.write(this.prompt()); return; }

    const cmd = tokens[0];
    const args = tokens.slice(1);

    // pipes: support the single most common shape  cmdA | cmdB
    if (line.includes(' | ')) {
      const [left, right] = line.split(' | ');
      const leftOut = new Out();
      this.run(left.trim(), leftOut, null);
      const rightTokens = this._tokenize(right.trim());
      const table = this._table();
      const rc = rightTokens[0];
      if (table[rc]) {
        // feed left output as stdin-ish: grep/head/tail/wc take it
        this._runWithInput(rc, rightTokens.slice(1), leftOut.text(), out);
      } else {
        out.line(`pwaos-shell: ${rc}: command not found (in pipe)`);
      }
      if (emit) emit.write(out.text() + this.prompt());
      return;
    }

    const table = this._table();
    if (table[cmd]) {
      const t0 = Date.now();
      table[cmd].run(args, out);
      const ms = Date.now() - t0;
      if (out.text() || out.jsonControl) this._flush(out, emit);
      if (emit) {
        if (out.jsonControl && out.jsonControl.type === 'quit') emit.quit();
        else emit.write(this.prompt());
      }
      return;
    }

    // fallback: try PATH executables (synchronous, output captured)
    try {
      const g = spawnSync(cmd, args, {
        cwd: this.cwd,
        env: this.env,
        timeout: 10_000,
        maxBuffer: MAX_OUT_CHARS,
        encoding: 'utf8',
      });
      if (g.error && g.error.code === 'ENOENT') {
        out.line(`pwaos-shell: ${cmd}: command not found`);
      } else {
        if (g.stdout) out.write(g.stdout.replace(/\n/g, '\r\n'));
        if (g.stderr) out.write(g.stderr.replace(/\n/g, '\r\n'));
        if (g.status !== 0 && g.status !== null) out.line(`[exit ${g.status}]`);
      }
    } catch (e) {
      out.line(`pwaos-shell: ${cmd}: ${e.message}`);
    }
    this._flush(out, emit);
    if (emit) emit.write(this.prompt());
  }

  _runWithInput(cmd, args, input, out) {
    const table = this._table();
    if (cmd === 'grep') {
      let ignoreCase = args[0] === '-i';
      const pattern = ignoreCase ? args[1] : args[0];
      if (!pattern) { out.line('grep: no pattern'); return; }
      let re;
      try { re = new RegExp(pattern, ignoreCase ? 'i' : ''); }
      catch (e) { out.line(`grep: bad pattern`); return; }
      input.split('\n').forEach((l, i) => { if (re.test(l)) out.line(l); });
      return;
    }
    if (cmd === 'head') { out.write(input.split('\n').slice(0, 10).join('\n') + '\r\n'); return; }
    if (cmd === 'tail') {
      const ls = input.replace(/\n$/, '').split('\n');
      out.write(ls.slice(-10).join('\n') + '\r\n');
      return;
    }
    if (cmd === 'wc') {
      const lines = (input.match(/\n/g) || []).length;
      const words = input.split(/\s+/).filter(Boolean).length;
      out.line(`${lines} ${words} ${input.length}`);
      return;
    }
    if (cmd === 'sort') {
      out.write(input.replace(/\n$/, '').split('\n').sort().join('\n') + '\r\n');
      return;
    }
    out.line(`pwaos-shell: ${cmd}: cannot take piped input`);
  }

  _tokenize(line) {
    const tokens = [];
    let cur = '';
    let quote = null;
    for (const ch of line) {
      if (quote) { if (ch === quote) quote = null; else cur += ch; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (/\s/.test(ch)) { if (cur) { tokens.push(cur); cur = ''; } }
      else cur += ch;
    }
    if (cur) tokens.push(cur);
    return tokens;
  }

  _flush(out, emit) {
    if (!emit) return;
    if (out.jsonControl) emit.control(out.jsonControl);
    const text = out.text();
    if (text) emit.write(text);
  }
}

module.exports = { ShellEngine, VERSION };
