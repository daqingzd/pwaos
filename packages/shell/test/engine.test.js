'use strict';

/**
 * Shell engine unit tests - no runtime, no display, pure Node.
 * Run: npm test  (or node test/engine.test.js)
 */

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { ShellEngine, VERSION } = require('../lib/engine');

function makeEmit() {
  const out = [];
  return {
    out,
    write(t) { out.push(t); },
    line(t) { out.push((t == null ? '' : t) + '\r\n'); },
    control(c) { out.push('[CONTROL:' + JSON.stringify(c) + ']'); },
    quit() { out.push('[QUIT]'); },
  };
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shelltest-'));
const eng = new ShellEngine(tmp);
eng.cwd = tmp;
eng.env.PWD = tmp;

// --- basics ----------------------------------------------------------------
let t = makeEmit();
eng.execute('echo hello world', t);
assert.ok(t.out.join('').includes('hello world'), 'echo');

t = makeEmit();
eng.execute('pwd', t);
assert.ok(t.out.join('').includes(tmp), 'pwd');

// --- cd / ls ---------------------------------------------------------------
fs.mkdirSync(path.join(tmp, 'subdir'));
fs.writeFileSync(path.join(tmp, 'file.txt'), 'line1\nline2\nline3\n');

t = makeEmit();
eng.execute('cd /nonexistent_dir_xyz', t);
assert.ok(t.out.join('').includes('no such directory'), 'cd error');

t = makeEmit();
eng.execute('ls', t);
assert.ok(t.out.join('').includes('subdir') && t.out.join('').includes('file.txt'), 'ls');

t = makeEmit();
eng.execute('ls -la', t);
const lsOut = t.out.join('');
assert.ok(lsOut.includes('file.txt') && lsOut.includes('total'), 'ls -la');

// --- file ops ---------------------------------------------------------------
t = makeEmit();
eng.execute('cat file.txt', t);
assert.ok(t.out.join('').includes('line2'), 'cat');

t = makeEmit();
eng.execute('grep line2 file.txt', t);
assert.ok(t.out.join('').includes('2: line2'), 'grep');

t = makeEmit();
eng.execute('wc file.txt', t);
assert.ok(t.out.join('').includes('3 3 18'), 'wc');

t = makeEmit();
eng.execute('mkdir -p a/b/c', t);
assert.ok(fs.existsSync(path.join(tmp, 'a/b/c')), 'mkdir -p');

t = makeEmit();
eng.execute('touch newfile.md', t);
assert.ok(fs.existsSync(path.join(tmp, 'newfile.md')), 'touch');

t = makeEmit();
eng.execute('cp file.txt copy.txt', t);
assert.ok(fs.existsSync(path.join(tmp, 'copy.txt')), 'cp');

t = makeEmit();
eng.execute('mv copy.txt moved.txt', t);
assert.ok(fs.existsSync(path.join(tmp, 'moved.txt')) &&
  !fs.existsSync(path.join(tmp, 'copy.txt')), 'mv');

t = makeEmit();
eng.execute('rm moved.txt', t);
assert.ok(!fs.existsSync(path.join(tmp, 'moved.txt')), 'rm');

// --- pipes -------------------------------------------------------------------
t = makeEmit();
eng.execute('cat file.txt | grep line3', t);
assert.ok(t.out.join('').includes('line3') &&
  !t.out.join('').includes('line1'), 'pipe grep');

t = makeEmit();
eng.execute('head -n 2 file.txt', t);
const headOut = t.out.join('');
assert.ok(headOut.includes('line1') && headOut.includes('line2') &&
  !headOut.includes('line3'), 'head');

// --- shell features ------------------------------------------------------------
t = makeEmit();
eng.execute('history', t);
assert.ok(t.out.join('').includes('echo hello world'), 'history');

t = makeEmit();
eng.execute('env', t);
assert.ok(t.out.join('').includes('HOME='), 'env');

t = makeEmit();
eng.execute('which ls', t);
assert.ok(t.out.join('').includes('shell builtin'), 'which builtin');

t = makeEmit();
eng.execute('uname', t);
assert.ok(t.out.join('').includes('Linux'), 'uname external');

t = makeEmit();
eng.execute('definitely_not_a_cmd_xyz', t);
assert.ok(t.out.join('').includes('command not found'), 'not found');

t = makeEmit();
eng.execute('echo "hello   world  spaced"', t);
assert.ok(t.out.join('').includes('hello   world  spaced'), 'quotes preserved');

t = makeEmit();
eng.execute('clear', t);
assert.ok(t.out.join('').includes('[CONTROL'), 'clear control');

t = makeEmit();
eng.execute('exit', t);
assert.ok(t.out.join('').includes('[QUIT]'), 'exit quit');

t = makeEmit();
eng.execute('version', t);
assert.ok(t.out.join('').includes('PwaOS Shell'), 'version');

// --- line editing ----------------------------------------------------------------
eng.inputLine = '';
t = makeEmit();
eng.handleKey('h', t);
eng.handleKey('i', t);
eng.handleKey('\r', t);
assert.ok(t.out.join('').includes('command not found'), 'handleKey line exec');

eng.inputLine = 'ec';
t = makeEmit();
eng.handleKey('\t', t);
assert.strictEqual(eng.inputLine, 'echo ',
  'tab completion echo, got: ' + JSON.stringify(eng.inputLine));

eng.inputLine = '';
t = makeEmit();
eng.handleKey('\u001b[A', t); // Up
assert.ok(eng.inputLine.length > 0, 'up arrow recalls history');
eng.handleKey('\u001b[B', t); // Down
assert.strictEqual(eng.inputLine, '', 'down arrow returns to draft');

// multi-char chunk with arrow inside (regression: '[A' text leak)
eng.inputLine = '';
t = makeEmit();
eng.handleKey('\u001b[A\u001b[B', t);
assert.strictEqual(eng.inputLine, '', 'chunked arrows parsed');

// backspace
eng.inputLine = 'abc';
t = makeEmit();
eng.handleKey('\u007f', t);
assert.strictEqual(eng.inputLine, 'ab', 'backspace');

// Ctrl+C cancels the line
t = makeEmit();
eng.handleKey('\u0003', t);
assert.strictEqual(eng.inputLine, '', 'ctrl+c cancels');

// prompt shape
const p = eng.prompt();
assert.ok(p.includes('@') && p.includes('$'), 'prompt shape');

assert.strictEqual(typeof VERSION, 'string', 'version export');

console.log('ALL ENGINE TESTS PASSED (' + tmp + ' cleaned)');
fs.rmSync(tmp, { recursive: true, force: true });
