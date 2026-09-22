// The apply modal's own DOM: Symplicity's close buttons, its how-to-apply divider,
// and the success modal that replaces it on submit.

import { sleep } from '../work/automationHelpers'

export const closeModalIfPresent = async (webview: any, preferHeadless = false) => {
  return webview.executeJavaScript(`
    (() => {
      const ordered =
        ${preferHeadless ? `[ 'button.headless-close-btn', 'button.modal-close' ]` : `[ 'button.modal-close', 'button.headless-close-btn' ]`};
      const btn =
        ordered
          .map(sel => document.querySelector(sel))
          .find(Boolean) ||
        Array.from(document.querySelectorAll('button')).find(b => {
          const cls = (b.className || '').toLowerCase();
          return cls.includes('modal-close') || cls.includes('headless-close-btn');
        });
      if (!btn) return false;
      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
      if (typeof btn.click === 'function') btn.click();
      else btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      return true;
    })();
  `)
}

export const waitForDividerSubmissionAndClose = async (webview: any) => {
  let detectedLogged = false
  for (let i = 0; i < 24; i++) { // up to ~6s
    const res = await webview.executeJavaScript(`
      (() => {
        const modalEl = document.querySelector('div.job-success-modal') || document.querySelector('div.job-success-modal.padding-lg');
        const hasSuccessText = Array.from(document.querySelectorAll('p, h1, h2, h3, h4, div, span'))
          .some(el => ((el.innerText || el.textContent || '').toLowerCase().includes('your application has been submitted')));
        if (!modalEl && !hasSuccessText) {
          return { detected: false, closed: false };
        }
        const candidates = [
          'button.headless-close-btn',
          'button.modal-close',
          'button[aria-label="Close"]',
          'button[aria-label="close"]',
          'button[title*="lose"]',
          'button[title*="Close"]',
        ];
        let btn = null;
        for (const sel of candidates) {
          const el = document.querySelector(sel);
          if (el) { btn = el; break; }
        }
        if (!btn) {
          btn = Array.from(document.querySelectorAll('button, [role="button"]')).find(el => {
            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            const cls = (el.className || '').toLowerCase();
            return text === '×' || text === 'x' || text === 'close' || cls.includes('headless-close-btn') || cls.includes('modal-close');
          }) || null;
        }
        if (btn) {
          btn.scrollIntoView({ behavior: 'instant', block: 'center' });
          if (typeof btn.click === 'function') btn.click();
          else btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return { detected: true, closed: true };
        }
        return { detected: true, closed: false };
      })();
    `)
    if (res?.closed) {
      return true
    }
    if (res?.detected && !detectedLogged) {
      detectedLogged = true
    }
    await sleep(250)
  }
  return false
}

export const waitForModalOpen = async (webview: any) => {
  for (let i = 0; i < 20; i++) { // ~3s max
    const open = await webview.executeJavaScript(`
      (() => {
        const modal = document.querySelector('div.modal-content') || document.querySelector('div[role="dialog"]');
        const how = document.querySelector('#how-to-apply') || document.querySelector('p#how-to-apply');
        const visible = (el) => el && (el.offsetParent !== null || el.getClientRects().length > 0);
        return !!(visible(modal) || visible(how));
      })();
    `)
    if (open) return true
    await sleep(150)
  }
  return false
}
