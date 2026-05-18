export const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

export const waitForSelector = async (webview: any, selector: string): Promise<void> => {
  while (true) {
    const found = await webview.executeJavaScript(`!!document.querySelector(${JSON.stringify(selector)})`)
    if (found) return;
    await sleep(200);
  }
}

export const waitForLegend = async (webview: any, prefix: string): Promise<void> => {
  while (true) {
    const found = await webview.executeJavaScript(`
      (() => {
        const legend = Array.from(document.querySelectorAll('legend'))
          .find(el => el.innerText && el.innerText.trim().startsWith(${JSON.stringify(prefix)}))
        return !!legend;
      })();
    `)
    if (found) return;
    await sleep(200);
  }
}

export const waitForSearchBar = async (webview: any): Promise<void> => {
  await waitForSelector(webview, 'input#quicksearch-field');
}

export const playAlertSound = () => {
  const audioContext = new AudioContext()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()
  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)
  oscillator.frequency.value = 800
  oscillator.type = 'sine'
  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.5)
}

export const waitForWebViewLoad = (webview: any): Promise<void> => {
  return new Promise(resolve => {
    const handler = () => {
      webview.removeEventListener('did-stop-loading', handler)
      resolve()
    }
    webview.addEventListener('did-stop-loading', handler)
  })
}

export const cleanTitle = (title: string | undefined) => {
  if (!title) return ''
  const atSplit = title.split(' @ ')[0] || title
  return atSplit.trim()
}

export const withTitleSuffix = (title: string | undefined, text: string) => {
  const cleaned = cleanTitle(title)
  return cleaned ? `${text} (${cleaned})` : text
}

export const toBool = (value: unknown, fallback = true) =>
  value === undefined || value === null ? fallback : value === true || value === 'true'

export const buildTaskKey = (text: string, applicationId?: string | null) =>
  `${applicationId ?? 'global'}::${text.trim().toLowerCase()}`

export type EmployerInstruction = { text: string; description: string }

export const normalizeEmployerInstructions = (input: any): EmployerInstruction[] => {
  if (!input) return []
  const arr = Array.isArray(input) ? input : [input]
  return arr
    .map((item: any) => {
      if (item && typeof item === 'object') {
        const text = String(item.instruction ?? item.text ?? item.title ?? '').trim()
        const description = String(item.description ?? item.detail ?? item.text ?? item.instruction ?? '').trim()
        const finalText = text || description
        const finalDesc = description || text
        if (!finalText) return null
        return { text: finalText, description: finalDesc }
      }
      const asString = String(item ?? '').trim()
      if (!asString) return null
      return { text: asString, description: asString }
    })
    .filter((v: EmployerInstruction | null): v is EmployerInstruction => !!v)
}

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
