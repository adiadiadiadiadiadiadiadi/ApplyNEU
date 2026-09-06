import { sleep } from '../automationHelpers'

export const applyPanelFilters = async (webview: any) => {
  const moreClicked = await webview.executeJavaScript(`
    (() => {
      const el = Array.from(document.querySelectorAll('span.filter-text, button, a')).find(node => {
        const text = (node.innerText || node.textContent || '').trim().toLowerCase();
        return text === 'more filters';
      });
      if (!el) return false;
      el.scrollIntoView({ behavior: 'instant', block: 'center' });
      if (typeof el.click === 'function') el.click();
      else el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    })();
  `)
  if (!moreClicked) {
    return
  }
  for (let i = 0; i < 60; i++) {
    const panelVisible = await webview.executeJavaScript(`
      (() => {
        const panel = document.querySelector('div#cfEmployersAdvFilters') || document.querySelector('div[id*="EmployersAdvFilters"]');
        if (!panel) return false;
        const style = window.getComputedStyle(panel);
        return style && style.display !== 'none' && style.visibility !== 'hidden';
      })();
    `)
    if (panelVisible) {
      break
    }
    await sleep(100)
  }
  // Toggle exclude applied jobs
  for (let j = 0; j < 60; j++) {
    const checkboxResult = await webview.executeJavaScript(`
      (() => {
        const cb =
          document.querySelector('input[type="checkbox"][id*="exclude_applied_jobs"]') ||
          Array.from(document.querySelectorAll('input[type="checkbox"]')).find(el =>
            ((el.getAttribute('aria-label') || '').toLowerCase().includes("exclude jobs i've applied for"))
          );
        if (!cb) return { found: false, clicked: false, already: false };
        const box = cb;
        const already = !!box.checked;
        if (!box.checked) {
          if (typeof box.click === 'function') box.click();
          else box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return { found: true, clicked: true, already };
        }
        return { found: true, clicked: false, already };
      })();
    `)
    if (checkboxResult?.found) {
      break
    }
    await sleep(100)
  }
  // Click Apply in panel
  for (let k = 0; k < 120; k++) {
    const applied = await webview.executeJavaScript(`
      (() => {
        const panel = document.querySelector('div#cfEmployersAdvFilters') || document.querySelector('div[id*="EmployersAdvFilters"]');
        const scope = panel || document;
        const btn = Array.from(scope.querySelectorAll('button')).find(b => {
          const text = (b.textContent || '').trim().toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          const enabled = !b.disabled && !!b.offsetParent;
          return enabled && (text === 'apply' || aria === 'apply');
        });
        if (!btn) return 'missing';
        btn.scrollIntoView({ behavior: 'instant', block: 'center' });
        if (typeof btn.click === 'function') btn.click();
        else btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return 'clicked';
      })();
    `)
    if (applied === 'clicked') {
      return
    }
    await sleep(100)
  }
}
