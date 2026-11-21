/*
 * PwaOS Shell - front-end (runs inside the appTypeConsole PWA, file:// origin)
 *
 * Architecture: the PWA renders xterm.js; the Node host process owns the
 * shell engine (command execution, history, completions). The two talk over
 * a poll bridge because file:// + this runtime build exposes no two-way
 * callback channel:
 *
 *   UI -> host : window.pwaosShellSend(JSON.stringify({type, ...}))
 *                The host drains the array with executeJavaScript() polls.
 *   host -> UI : host injects window.pwaosShellInbox = [...]; the front-end
 *                polls it each tick and drains it.
 *
 * Message types:
 *   {type:'input', line}        a full submitted command line
 *   {type:'key', seq}           raw keystroke (for ^C etc.) - reserved
 *   {type:'resize', cols, rows} terminal resized
 *   host: {type:'write', data}  literal text to write (escaped)
 *   host: {type:'reset'}        clear the screen
 *   host: {type:'title', text}  set window title
 */
(function () {
  'use strict';

  var INBOX_POLL_MS = 50;

  var theme = {
    foreground: '#F8F8F8',
    background: '#1e1e1d',
    selection: '#5DA5D533',
    cursor: '#F8F8F8',
    cursorAccent: '#1e1e1d',
    black: '#1E1E1D', brightBlack: '#262625',
    red: '#CE5C5C', brightRed: '#FF7272',
    green: '#5BCC5B', brightGreen: '#72FF72',
    yellow: '#CCCC5B', brightYellow: '#FFFF72',
    blue: '#5D5DD3', brightBlue: '#7279FF',
    magenta: '#BC5ED1', brightMagenta: '#E572FF',
    cyan: '#5DA5D5', brightCyan: '#72F0FF',
    white: '#F8F8F8', brightWhite: '#FFFFFF',
  };

  var term = new window.Terminal({
    fontFamily: '"Cascadia Code", Menlo, Consolas, monospace',
    fontSize: 14,
    theme: theme,
    cursorBlink: true,
    scrollback: 5000,
    allowProposedApi: true,
  });
  var fit = new window.FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(document.getElementById('terminal-host'));
  try {
    term.loadAddon(new window.WebglAddon.WebglAddon());
  } catch (e) {
    // WebGL unavailable (software rendering) - the DOM renderer is fine.
  }
  var doFit = function () { try { fit.fit(); } catch (_) {} };
  window.addEventListener('resize', doFit);
  doFit();

  // --- outbox / inbox bridge ------------------------------------------------
  window.pwaosShellOutbox = [];
  if (!Array.isArray(window.pwaosShellInbox)) window.pwaosShellInbox = [];

  function send(msg) {
    window.pwaosShellOutbox.push(JSON.stringify(msg));
  }

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var inboxIndex = 0;

  function drainInbox() {
    var inbox = window.pwaosShellInbox || [];
    while (inboxIndex < inbox.length) {
      var raw = inbox[inboxIndex++];
      var msg;
      try { msg = JSON.parse(raw); } catch (e) { continue; }
      if (msg.type === 'write') {
        // data arrives as a JSON-encoded string payload
        try { term.write(JSON.parse(msg.json)); } catch (_) {}
      } else if (msg.type === 'reset') {
        term.reset();
      } else if (msg.type === 'title') {
        document.title = String(msg.text || 'PwaOS Shell');
      }
    }
    // Compact the inbox when the host has reset it.
    if (inbox.length === 0 && inboxIndex !== 0) {
      inboxIndex = 0;
    } else if (inboxIndex > 4096 && inbox.length === inboxIndex) {
      // Host keeps appending; trim only when it signalled a compaction point.
      if (window.pwaosShellInboxTrim) {
        window.pwaosShellInbox = [];
        inboxIndex = 0;
        window.pwaosShellInboxTrim = false;
      }
    }
  }

  setInterval(drainInbox, INBOX_POLL_MS);

  // --- input ----------------------------------------------------------------
  term.onData(function (data) {
    send({ type: 'input', json: JSON.stringify(data) });
  });

  term.onResize(function (size) {
    send({ type: 'resize', cols: size.cols, rows: size.rows });
  });

  // --- boot banner ----------------------------------------------------------
  term.writeln('\x1b[1;36mPwaOS Shell\x1b[0m \x1b[90m(file protocol mode)\x1b[0m');
  term.writeln('\x1b[90mType \x1b[0m\x1b[1mhelp\x1b[0m\x1b[90m for the command list.\x1b[0m');
  term.write('\r\n');

  // Announce readiness so the host can size itself to the real grid.
  function announce() {
    send({ type: 'resize', cols: term.cols, rows: term.rows });
    send({ type: 'hello', cols: term.cols, rows: term.rows });
  }
  announce();
  window.pwaosShellReady = true;
})();
