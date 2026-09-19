const { execFile } = require('child_process');
const path = require('path');

const AGENT = path.join(__dirname, 'agent.js');

// Playwright can't be loaded inside Electron's own Node (v18 < the v20 it requires),
// so each automation command runs as a short-lived system-node subprocess that
// attaches over CDP. Nothing is lost by not keeping it alive: the browser state lives
// in the Electron BrowserView, not in the Playwright client.
function runTask(cdpPort, command) {
  return new Promise((resolve) => {
    execFile('node', [AGENT, String(cdpPort), command], { timeout: 60_000 }, (err, stdout, stderr) => {
      if (stdout) {
        try {
          return resolve(JSON.parse(stdout));
        } catch {
          return resolve({ ok: false, error: `unparseable agent output: ${stdout.slice(0, 200)}` });
        }
      }
      resolve({ ok: false, error: err ? `${err.message} ${stderr ?? ''}`.trim() : 'agent produced no output' });
    });
  });
}

module.exports = { runTask };
