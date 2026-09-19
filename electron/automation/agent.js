const { chromium } = require('playwright-core');

const HOME_URL = 'https://northeastern-csm.symplicity.com/students/?signin_tab=0';

// The NUWorks view is whichever page isn't the app's own UI or devtools.
const isAutomationPage = (url) =>
  !url.startsWith('devtools://') && !url.includes('localhost:5173') && url !== 'about:blank';

const commands = {
  async goHome(page) {
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded' });
    return { url: page.url(), title: await page.title() };
  },
};

async function main() {
  const [cdpPort, command] = process.argv.slice(2);
  const run = commands[command];
  if (!run) return { ok: false, error: `unknown command: ${command}` };

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
  try {
    const page = browser
      .contexts()
      .flatMap((context) => context.pages())
      .find((candidate) => isAutomationPage(candidate.url()));
    if (!page) return { ok: false, error: 'automation view not found -- is the automation screen open?' };

    return { ok: true, ...(await run(page)) };
  } finally {
    // Disconnect without closing: this browser is the user's running app.
    await browser.close().catch(() => {});
  }
}

main()
  .then((result) => process.stdout.write(JSON.stringify(result)))
  .catch((err) => process.stdout.write(JSON.stringify({ ok: false, error: err?.message ?? String(err) })));
