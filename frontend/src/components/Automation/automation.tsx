import { useState, useEffect, useRef } from 'react'
import './automation.css'
import { waitForSelector, waitForLegend, waitForSearchBar, playAlertSound } from './automationHelpers'
import { getUserId } from '../../lib/supabase'

export default function Automation() {
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'error'>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [searchTerms, setSearchTerms] = useState<string[]>([])
  const [awaitingInput, setAwaitingInput] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const existingTasksRef = useRef<Set<string>>(new Set())
  const searchTermsRef = useRef<Set<string>>(new Set())
  const currentJobApplicationIdRef = useRef<string | null>(null)
  const clearedTasksForApplicationRef = useRef<boolean>(false)

  async function handleNoCoverLetter(companyName: string, webview: any, userId: string | undefined, applicationId?: string | null) {
    addLog(`No cover letter found for ${companyName}.`)
    if (!userId) {
      addLog(`Error occured.`)
      return
    }
    const text = `Upload ${companyName} cover letter`
    const description = `Upload your ${companyName} cover letter in the 'My Documents' tab in NUWorks. Make sure the document's name includes '${companyName}'`
    const key = buildTaskKey(text, applicationId)
    if (!existingTasksRef.current.has(key)) {
      const resp = await fetch(`http://localhost:8080/tasks/${userId}/new`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, description, application_id: applicationId ?? undefined })
      })
      if (!resp.ok) {
        addLog('Error occured while creating task.')
      } else {
        existingTasksRef.current.add(key)
      }
    }
    await webview.executeJavaScript(`
      (() => {
        const btn =
          document.querySelector('button.modal-close') ||
          document.querySelector('button.headless-close-btn') ||
          Array.from(document.querySelectorAll('button')).find(b => {
            const cls = (b.className || '').toLowerCase();
            return cls.includes('modal-close') || cls.includes('headless-close-btn');
          });
        if (btn) {
          btn.scrollIntoView({ behavior: 'instant', block: 'center' });
          if (typeof btn.click === 'function') btn.click();
          else btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
          return true;
        }
        return false;
      })();
    `)
  }

  async function handleNoWorkSample(companyName: string, userId: string | undefined, applicationId?: string | null) {
    addLog(`No work sample found for ${companyName}.`)
    if (!userId) {
      addLog(`Error occured.`)
      return
    }
    const text = `Upload ${companyName} work sample`
    const description = `Upload a work sample for ${companyName} in the 'My Documents' tab in NUWorks. Make sure the document name includes '${companyName}'.`
    const key = buildTaskKey(text, applicationId)
    if (existingTasksRef.current.has(key)) {
      return
    }
    const resp = await fetch(`http://localhost:8080/tasks/${userId}/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, description, application_id: applicationId ?? undefined })
    })
    if (!resp.ok) {
      addLog('Error occured while creating task.')
      return
    }
    existingTasksRef.current.add(key)
  }

  async function handleNoPortfolio(companyName: string, userId: string | undefined, applicationId?: string | null) {
    addLog(`No portfolio found for ${companyName}.`)
    if (!userId) {
      addLog(`Error occured.`)
      return
    }
    const text = `Upload ${companyName} portfolio`
    const description = `Upload a portfolio for ${companyName} in the 'My Documents' tab in NUWorks. Make sure the document name includes '${companyName}'.`
    const key = buildTaskKey(text, applicationId)
    if (existingTasksRef.current.has(key)) {
      return
    }
    const resp = await fetch(`http://localhost:8080/tasks/${userId}/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, description, application_id: applicationId ?? undefined })
    })
    if (!resp.ok) {
      addLog('Error occured while creating task.')
      return
    }
    existingTasksRef.current.add(key)
  }

  async function handleNoTranscript(companyName: string, userId: string | undefined, applicationId?: string | null) {
    addLog(`No transcript found for ${companyName}.`)
    if (!userId) {
      addLog(`Error occured.`)
      return
    }
    const text = `Upload ${companyName} transcript`
    const description = `Upload a transcript for ${companyName} in the 'My Documents' tab in NUWorks. Make sure the document name includes '${companyName}'.`
    const key = buildTaskKey(text, applicationId)
    if (existingTasksRef.current.has(key)) {
      return
    }
    const resp = await fetch(`http://localhost:8080/tasks/${userId}/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, description, application_id: applicationId ?? undefined })
    })
    if (!resp.ok) {
      addLog('Error occured while creating task.')
      return
    }
    existingTasksRef.current.add(key)
  }

  const closeModalIfPresent = async (webview: any, preferHeadless = false) => {
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

  const waitForDividerSubmissionAndClose = async (webview: any) => {
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
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

  const waitForModalOpen = async (webview: any) => {
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
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

  useEffect(() => {
    const fetchSearchTerms = async () => {
      try {
        const userId = await getUserId()
        if (!userId) {
          addLog('Error occured: no user found. Retrying...')
          return
        }
        try {
          const tasksResp = await fetch(`http://localhost:8080/tasks/${userId}`)
          if (tasksResp.ok) {
            const tasksData = await tasksResp.json().catch(() => [])
            const taskKeys = Array.isArray(tasksData)
              ? tasksData
                  .map((t: any) => {
                    const text = String(t?.text ?? '').trim()
                    const appId = t?.application_id ? String(t.application_id) : 'global'
                    if (!text) return null
                    return `${appId}::${text.toLowerCase()}`
                  })
                  .filter(Boolean) as string[]
              : []
            existingTasksRef.current = new Set(taskKeys)
          }
        } catch (err) {}

        const response = await fetch(`http://localhost:8080/users/${userId}/search-terms`)
        if (!response.ok) { addLog('Error occured. Could not fetch search terms. Retrying...'); return; }

        const data = await response.json()
        const terms = Array.isArray(data?.search_terms) ? data.search_terms : []
        setSearchTerms(terms)
        searchTermsRef.current = new Set(
          terms
            .map((t: any) => String(t ?? '').trim().toLowerCase())
            .filter(Boolean)
        )
      } catch (error) {
        addLog('Error occured. Could not get search terms.')
      }
    }

    fetchSearchTerms()

    if (!initializedRef.current) {
      initializedRef.current = true
      addLog("Bot connected...")
    }
    const webview = document.querySelector('webview')
    if (webview) {
      const handleLoadError = (event: any) => {
        addLog(`Error: ${event.errorDescription || 'failed to load'}. Retrying...`)
      }
      webview.addEventListener('did-fail-load', handleLoadError)
      return () => {
        webview.removeEventListener('did-fail-load', handleLoadError)
      }
    }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const buildTaskKey = (text: string, applicationId?: string | null) =>
    `${applicationId ?? 'global'}::${text.trim().toLowerCase()}`

  useEffect(() => {
    ;(window as any).__automationLog = (msg: any) => addLog(String(msg ?? ''))
    return () => {
      if ((window as any).__automationLog) {
        delete (window as any).__automationLog
      }
    }
  }, [addLog])

  type EmployerInstruction = { text: string; description: string }

  const normalizeEmployerInstructions = (input: any): EmployerInstruction[] => {
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

  const addEmployerTasks = async (instructions: EmployerInstruction[], userId: string, applicationId?: string | null) => {
    const tasks = instructions.filter(inst => inst.text && inst.description)
    if (!tasks.length) return
    try {
      await Promise.allSettled(
        tasks.map(async ({ text, description }) => {
          const key = buildTaskKey(text, applicationId)
          if (!key || existingTasksRef.current.has(key)) return true

          const resp = await fetch(`http://localhost:8080/tasks/${userId}/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, description, application_id: applicationId ?? undefined })
          })
          if (!resp.ok) {
            const msg = await resp.text().catch(() => '')
            throw new Error(`status ${resp.status} ${msg}`)
          }
          existingTasksRef.current.add(key)
          return true
        })
      )
    } catch (err) {
      addLog('Error occured.')
    }
  }
  void addEmployerTasks

  const clearTasksForApplication = async (userId: string, applicationId: string) => {
    try {
      await fetch(`http://localhost:8080/tasks/${userId}/application/${applicationId}`, {
        method: 'DELETE'
      })
      existingTasksRef.current = new Set(
        Array.from(existingTasksRef.current).filter(key => !key.startsWith(`${applicationId}::`))
      )
    } catch (err) {
      addLog('Unable to clear existing tasks for this application.')
    }
  }

  const applyPanelFilters = async (webview: any) => {
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
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


  const handlePlayClick = async () => {
    setStatus('running')
    setAwaitingInput(false)
    addLog('Beginning automation...')
    const webview = document.querySelector('webview') as any
    if (!webview) {
      addLog('Error: webview not found')
      setStatus('error')
      return
    }
    webview.src = 'https://northeastern-csm.symplicity.com/students/?signin_tab=0'

    const dashboardLoaded = await webview.executeJavaScript("!!document.querySelector('input#quicksearch-field')")
    if (dashboardLoaded) {
      await handleAutomationFromDashboard(webview)
      return
    }

    await waitForSelector(webview, 'input.input-button.btn.btn_primary.full_width.btn_multi_line')
    await webview.executeJavaScript(`document.querySelector('input.input-button.btn.btn_primary.full_width.btn_multi_line').click()`)
    addLog('Navigating to login...')

    await waitForLegend(webview, 'Login to Shibboleth')
    playAlertSound()
    setAwaitingInput(true)
    addLog('Waiting for user input...')
    await waitForSearchBar(webview)

    addLog('Continuing...')
    setAwaitingInput(false)
    await handleAutomationFromDashboard(webview)
  }

  const handleAutomationFromDashboard = async (webview: any) => {
    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

    // Wait for and click the top-nav "Jobs" link
    await (async () => {
      for (let i = 0; i < 30; i++) {
        const clicked = await webview.executeJavaScript(`
          (() => {
            const link = Array.from(document.querySelectorAll('a'))
              .find(a => (a.textContent || '').trim() === 'Jobs');
            if (!link) return 'missing';
            link.click();
            return 'clicked';
          })();
        `)
        if (clicked === 'clicked') {
          return
        }
        await sleep(100)
      }
    })()

    // Select "Jobs I Qualify For" in the Show Me filter before applying job types
    await (async () => {
      for (let i = 0; i < 40; i++) {
        const result = await webview.executeJavaScript(`
          (() => {
            const sel =
              document.querySelector('select#single-select-filter') ||
              document.querySelector('select[id*="single-select-filter"]') ||
              document.querySelector('select[name*="show_me"]') ||
              document.querySelector('select[aria-label*="Show Me"]');
            if (!sel) return 'missing';
            sel.scrollIntoView({ behavior: 'instant', block: 'center' });
            const options = Array.from(sel.options || []);
            const target = options.find(o => ((o.innerText || o.textContent || '').trim().toLowerCase().includes('jobs i qualify for')));
            if (!target) return 'no-option';
            sel.value = target.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
            return 'set';
          })();
        `)
        if (result === 'set') {
          break
        }
        if (result === 'no-option') {
          break
        }
        await sleep(100)
      }
    })()

    // Open job type dropdown before searches
    await (async () => {
      for (let i = 0; i < 40; i++) {
        const result = await webview.executeJavaScript(`
          (() => {
            const btn = document.querySelector('button#listFilter-category-job_type');
            if (!btn) return 'missing';
            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
            btn.click();
            return 'clicked';
          })();
        `)
        if (result === 'clicked') {
          return
        }
        await sleep(100)
      }
    })()

    // Apply saved job type filters from backend
    await (async () => {
      const userId = await getUserId();
      if (!userId) { addLog('Unable to fetch job types (no user).'); return }
      try {
        const resp = await fetch(`http://localhost:8080/users/${userId}/job-types`)
        if (!resp.ok) { addLog('Failed to fetch job types.'); return }
        const data = await resp.json()
        const jobTypes: string[] = Array.isArray(data?.job_types) ? data.job_types : []
        if (!jobTypes.length) {
          addLog('No job types set; skipping filters.')
          return
        }

        for (let i = 0; i < 20; i++) {
          const ready = await webview.executeJavaScript(`!!document.querySelector('input[type="checkbox"][id^="job_type"]')`)
          if (ready) break
          await sleep(10)
        }

        await webview.executeJavaScript(`
          (() => {
            const selections = ${JSON.stringify(jobTypes.map(t => t.toLowerCase()))};
            const cbs = Array.from(document.querySelectorAll('input[type="checkbox"][id^="job_type"]'));
            let matched = 0;
            cbs.forEach(cb => {
              const labelText = (
                (cb.closest('label')?.innerText) ||
                (cb.parentElement?.innerText) ||
                ''
              ).trim().toLowerCase();
              const hit = selections.find(sel => labelText.includes(sel));
              if (hit) {
                if (!cb.checked) cb.click();
                matched++;
              }
            });
            const applyBtn = Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim().toLowerCase() === 'apply');
            if (applyBtn) {
              applyBtn.click();
            }
            return { matched, applied: !!applyBtn };
          })();
        `)
      } catch (err) {
        addLog('Error applying job type filters.')
      }
    })()

    // Click "More Filters", then click "Exclude jobs I've applied for", then click Apply.
    const moreFiltersClicked = await webview.executeJavaScript(`
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
    if (moreFiltersClicked) {
      // Wait for more-filters panel to render
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
        await new Promise(res => setTimeout(res, 100))
      }
      // Wait for and click exclude applied jobs checkbox
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
        await new Promise(res => setTimeout(res, 100))
      }
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
          addLog('Applied filters.')
          break
        }
        await new Promise(res => setTimeout(res, 100))
      }
    }

    // Search
    await (async () => {
      for (let i = 0; i < 40; i++) {
        const found = await webview.executeJavaScript(`!!document.querySelector('input#jobs-keyword-input')`)
        if (found) return
         await sleep(100)
      }
    })()

    if (!searchTerms.length) {
      addLog('Error occured. Please try again later.')
      setStatus('idle')
      return
    }

    const normalizedTerms = searchTerms
      .map(term => String(term ?? '').trim())
      .filter(Boolean)

    termLoop: for (const term of normalizedTerms) {
      addLog(`Searching for "${term}"...`)

      await webview.executeJavaScript(`
        (() => {
          const input = document.querySelector('input#jobs-keyword-input');
          if (!input) return { found: false };
          return {
            found: true,
            value: input.value || '',
            placeholder: input.placeholder || ''
          };
        })();
      `)

      const typeResult = await webview.executeJavaScript(`
        (async () => {
          const input = document.querySelector('input#jobs-keyword-input');
          if (!input) return 'missing-input';

          const clearBtn = input.parentElement?.querySelector('button, .clear, .close') || null;
          if (clearBtn && typeof clearBtn.click === 'function') {
            clearBtn.click();
          } else {
            input.value = '';
          }

          input.focus();
          const chars = ${JSON.stringify(term)}.split('');
          for (const ch of chars) {
            input.value = input.value + ch;
            input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: ch }));
            input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            await new Promise(r => setTimeout(r, 40));
          }
          return 'typed';
        })();
      `)

      if (typeResult === 'missing-input') { continue termLoop }

      await webview.executeJavaScript(`
        (() => {
          const input = document.querySelector('input#jobs-keyword-input');
          if (!input) return { found: false };
          return { found: true, value: input.value || '' };
        })();
      `)

      const enterResult = await webview.executeJavaScript(`
        (() => {
          const input = document.querySelector('input#jobs-keyword-input');
          if (!input) return 'missing-input';
          const eventInit = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, composed: true };
          input.dispatchEvent(new KeyboardEvent('keydown', eventInit));
          input.dispatchEvent(new KeyboardEvent('keypress', eventInit));
          input.dispatchEvent(new KeyboardEvent('keyup', eventInit));
          return 'enter-dispatched';
        })();
      `)

      if (enterResult === 'missing-input') {
        continue termLoop
      }

      for (let attempt = 0; attempt < 40; attempt++) {
        const clickResult = await webview.executeJavaScript(`
          (() => {
            const btn =
              document.querySelector('button.btn.btn_alt-default') ||
              document.querySelector('button[type="submit"]') ||
              document.querySelector('button[aria-label="Search"]') ||
              document.querySelector('button:not([disabled])#search-btn') ||
              document.querySelector('button:not([disabled]).btn-search') ||
              Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim().toLowerCase() === 'search');
            if (!btn) return 'missing';
            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
            btn.click();
            return 'clicked';
          })();
        `)

        if (clickResult === 'clicked') {
          break
        }
         await sleep(100)
      }

      await sleep(100)

      let pageIndex = 1
      while (true) {
        await (async () => {
          for (let i = 0; i < 40; i++) {
            const found = await webview.executeJavaScript(`
              (() => Array.from(document.querySelectorAll('div[id^="list-item-"]')).length)();
            `)
            if (found && found > 0) return
            await sleep(100)
          }
        })()

        let jobCount = await webview.executeJavaScript(`
          (() => Array.from(document.querySelectorAll('div[id^="list-item-"]')).length)();
        `)

        if (!jobCount || jobCount <= 0) {
          break
        }

        // Apply panel filters only on first page
        if (pageIndex === 1) {
          await applyPanelFilters(webview)
        }

        // Recount after panel filters
        await (async () => {
          for (let i = 0; i < 40; i++) {
            const found = await webview.executeJavaScript(`
              (() => Array.from(document.querySelectorAll('div[id^="list-item-"]')).length)();
            `)
            if (found && found > 0) return
            await sleep(100)
          }
        })()
        jobCount = await webview.executeJavaScript(`
          (() => Array.from(document.querySelectorAll('div[id^="list-item-"]')).length)();
        `)

        if (!jobCount || jobCount <= 0) {
          addLog(`No job cards found for "${term}".`)
          break
        }

        let consecutiveDoNotApply = 0
        addLog(`${jobCount} jobs found for "${term}" on page ${pageIndex}.`)
        for (let idx = 0; idx < jobCount; idx++) {
          const clickJobResult = await webview.executeJavaScript(`
            (() => {
              const cards = Array.from(document.querySelectorAll('div[id^="list-item-"]'));
              const card = cards[${idx}];
              if (!card) return { status: 'missing' };
              const rawText = card.innerText || card.textContent || '';
              const normalized = rawText.toLowerCase();
              if (normalized.includes('not qualified')) {
                return { status: 'skipped', reason: 'not qualified' };
              }
              if (normalized.includes('applied')) {
                return { status: 'skipped', reason: 'applied' };
              }
              const pickTitle = () => {
                const preferred =
                  card.querySelector('[data-testid="job-title"]') ||
                  card.querySelector('.job-title') ||
                  card.querySelector('h3, h4') ||
                  card.querySelector('[role="link"]');
                const raw = preferred && preferred.textContent ? preferred.textContent : card.innerText || card.textContent || '';
                // Use first non-empty line, then trim common joiners.
                const firstLine = raw
                  .split('\\n')
                  .map(t => t.trim())
                  .find(t => t.length > 0) || '';
                if (!firstLine) return 'Untitled job';
                // If the line contains multiple fields jammed together, split on two or more spaces.
                const splitSpaces = firstLine.split(/\\s{2,}/).find(t => t.length > 0);
                return (splitSpaces || firstLine).trim();
              };
              const title = pickTitle();
              const shortTitle = title.length > 140 ? title.slice(0, 140) + '…' : title;

              const lines = (card.innerText || card.textContent || '')
                .split('\\n')
                .map(t => t.trim())
                .filter(t => t.length > 0);
              const rawCompany = lines.find(l => l !== title) || '';
              const companyName = rawCompany.includes(' - ')
                ? rawCompany.split(' - ')[0].trim()
                : rawCompany;
              const displayTitle = companyName ? \`\${shortTitle} @ \${companyName}\` : shortTitle;

              card.scrollIntoView({ behavior: 'instant', block: 'center' });
              if (typeof card.click === 'function') {
                card.click();
              } else {
                card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
              }
              return { status: 'clicked', title: shortTitle, company: companyName, displayTitle };
            })();
          `)

          if (clickJobResult?.status === 'clicked') {
            currentJobApplicationIdRef.current = null
            clearedTasksForApplicationRef.current = false
            const titleStr = clickJobResult.displayTitle || clickJobResult.title || 'Untitled job';
            const companyLower = (clickJobResult.company || (() => {
              const atIdx = titleStr.indexOf('@');
              if (atIdx !== -1) return titleStr.slice(atIdx + 1);
              return '';
            })()).toString().toLowerCase().trim();
             await sleep(100)
            const descResult = await webview.executeJavaScript(`
              (async () => {
                const normalize = (el) => (el?.innerText || el?.textContent || '').trim();
                const stripNoise = (text) =>
                  text
                    .split('\\n')
                    .map(t => t.trim())
                    .filter(t =>
                      t.length > 0 &&
                      !/home\\/jobs\\/search/i.test(t) &&
                      !/keywords/i.test(t) &&
                      !/location/i.test(t) &&
                      !/distance/i.test(t) &&
                      !/show me/i.test(t) &&
                      !/all jobs/i.test(t)
                    )
                    .join(' ');
                const serializeBlock = (el) => {
                  let text = el ? (el.innerText || el.textContent || '') : '';
                  const links = Array.from(el?.querySelectorAll('a') || []);
                  links.forEach(a => {
                    const display = (a.innerText || a.textContent || 'link').trim();
                    const href = a.href || a.getAttribute('href') || '';
                    if (href && display.length) {
                      const replacement = \`\${display} (\${href})\`;
                      // replace first occurrence of display to avoid over-replacement
                      text = text.replace(display, replacement);
                    }
                  });
                  return text.trim();
                };

                // Wait for a job description heading to appear (up to ~4s)
                let heading = null;
                for (let i = 0; i < 16; i++) {
                  heading = Array.from(document.querySelectorAll('h1,h2,h3,h4,strong,b'))
                    .find(h => /job description/i.test(h.innerText || ''));
                  if (heading) break;
                  await new Promise(r => setTimeout(r, 250));
                }
                if (!heading) return '';

                const scope = heading.closest('section, article, div') || heading.parentElement;
                if (!scope) return '';

                const blocks = Array.from(scope.querySelectorAll('p, li, div'))
                  .map(serializeBlock)
                  .filter(t => t.length > 40);
                const combined = stripNoise(blocks.join(' ').trim());
                return combined;
              })();
            `)

            // Send description to backend for decision and optionally apply
            try {
              const companyName = (clickJobResult.company || '').trim()
              const jobTitle = (titleStr || '').trim()
              const jobDescription = (descResult || '').toString()

              const addJobResp = await fetch(`http://localhost:8080/jobs/add-job`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  company: companyName,
                  title: jobTitle,
                  description: jobDescription
                })
              })
              if (!addJobResp.ok) {
                addLog('Server error.')
              }
              const userId = await getUserId()
              if (!userId) {
                addLog('Decision skipped (no user).')
              } else {
                addLog(`Reviewing ${titleStr}...`)
                const resp = await fetch(`http://localhost:8080/jobs/${userId}/send-job`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ job_description: descResult || '' })
                })
                if (resp.ok) {
                  const data = await resp.json()
                  const instructions = normalizeEmployerInstructions(data?.employer_instructions)
                  void instructions
                  if (data.decision === 'APPLY') {
                    consecutiveDoNotApply = 0
                    addLog(`Decision: apply.`)
                    let applicationRecordedStatus: 'draft' | 'submitted' | 'external' | null = null
                    const recordApplication = async (status: 'draft' | 'submitted' | 'external') => {
                      const userIdForApplication = await getUserId()
                      if (!userIdForApplication) return currentJobApplicationIdRef.current
                      if (applicationRecordedStatus === status && currentJobApplicationIdRef.current) {
                        return currentJobApplicationIdRef.current
                      }
                      const applicationPayload = {
                        company: (clickJobResult.company || '').trim() || 'Unknown company',
                        title: (titleStr || '').trim() || 'Untitled job',
                        description: (descResult || '').toString(),
                        status
                      }
                      try {
                        const resp = await fetch(`http://localhost:8080/applications/${userIdForApplication}/new`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(applicationPayload)
                        })
                        if (resp.ok) {
                          const data = await resp.json().catch(() => ({}))
                          const applicationId =
                            data?.application_id ??
                            data?.id ??
                            data?.jobApplicationId ??
                            null
                          if (applicationId) {
                            currentJobApplicationIdRef.current = String(applicationId)
                          }
                          applicationRecordedStatus = status
                          if (currentJobApplicationIdRef.current && !clearedTasksForApplicationRef.current) {
                            await clearTasksForApplication(userIdForApplication, currentJobApplicationIdRef.current)
                            clearedTasksForApplicationRef.current = true
                          }
                        }
                      } catch (err) {}
                      return currentJobApplicationIdRef.current
                    }
                    await recordApplication('draft')
                    let documentsMissing = false
                    const applyClicked = await webview.executeJavaScript(`
                      (() => {
                        const btn = Array.from(document.querySelectorAll('button')).find(b => {
                          const text = (b.textContent || '').trim().toLowerCase();
                          const visible = !!(b.offsetParent);
                          return text === 'apply' && !b.disabled && visible;
                        });
                        if (!btn) return false;
                        btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                        btn.click();
                        return true;
                      })();
                    `)
                    if (applyClicked) {
                      // Delay inline-instructions check until after resume UI is present.
                      const dividerExists = await webview.executeJavaScript(`
                        (() => {
                          const divider = document.querySelector('div.vr.ng-star-inserted');
                          const heading = Array.from(document.querySelectorAll('h4')).find(
                            el => (el.textContent || '').toLowerCase().includes('how to apply')
                          );
                          return !!(divider || heading);
                        })();
                      `)
                      // defer instruction/task creation until after document checks below
                      await webview.executeJavaScript(`
                        (() => {
                          const btn = Array.from(document.querySelectorAll('button')).find(b => {
                            const text = (b.textContent || '').trim().toLowerCase();
                            const visible = !!(b.offsetParent);
                            return (text === 'submit' || text === 'save') && !b.disabled && visible;
                          });
                          const isRed = !!(btn && (btn.className || '').toLowerCase().includes('btn_primary'));
                          return { hasSubmit: !!btn, hasRed: isRed };
                        })();
                      `)
                      void dividerExists
                      let seenResume = false
                      let skipJob = false
                      let coverLetterTaskAdded = false
                      let workSampleChecked = false
                      let portfolioChecked = false
                      let transcriptChecked = false
                      let preferHeadlessClose = false
                      let docFieldFound = false
                      let needsExternalAction = false

                      if (dividerExists) {
                        await waitForModalOpen(webview)
                        const { text } = await webview.executeJavaScript(`
                          (() => {
                            const modals = Array.from(document.querySelectorAll('div.modal-content, div[role="dialog"], .modal, .job-success-modal'));
                            // Prefer a modal that has the how-to-apply node and is not the success modal
                            const preferIndex = modals.findIndex(m =>
                              !m.classList.contains('job-success-modal') &&
                              m.querySelector('p#how-to-apply, #how-to-apply, .text-overflow.column, .p-group')
                            );
                            const modal = preferIndex >= 0
                              ? modals[preferIndex]
                              : (modals.find(m => !m.classList.contains('job-success-modal')) || modals[0] || null);
                            const scope = modal || document;
                            const lowerMatch = (id) => (id || '').toLowerCase().includes('how-to-apply');
                            const el =
                              scope.querySelector('p#how-to-apply') ||
                              scope.querySelector('#how-to-apply') ||
                              Array.from(scope.querySelectorAll('[id]')).find(node => lowerMatch(node.id)) ||
                              Array.from(scope.querySelectorAll('p')).find(p => lowerMatch(p.id || ''));
                            const container =
                              el ||
                              (el && el.parentElement) ||
                              scope.querySelector('.text-overflow.column') ||
                              scope.querySelector('.p-group') ||
                              modal ||
                              scope;

                            const extractInstruction = (node) => {
                              if (!node) return '';
                              const anchors = Array.from(node.querySelectorAll('a')).map(a => {
                                const t = (a.innerText || a.textContent || '').trim();
                                const href = (a.getAttribute('href') || '').trim();
                                return [t, href].filter(Boolean).join(' ').trim();
                              }).filter(Boolean);

                              const rawLines = (node.innerText || node.textContent || '')
                                .split(/\\n+/)
                                .map(s => s.trim())
                                .filter(Boolean);
                              const applyLines = rawLines.filter(s => s.toLowerCase().includes('apply'));

                              const candidates = [...applyLines, ...anchors];
                              const first = candidates.find(Boolean);
                              if (first) return first;

                              const combined = [...rawLines, ...anchors].filter(Boolean);
                              return Array.from(new Set(combined)).join(' ').trim();
                            };

                            const txt = extractInstruction(container);
                            return {
                              text: txt,
                              elHtml: el ? el.outerHTML : '',
                              modalHtml: modal ? modal.innerHTML : '',
                              appliedModalIndex: preferIndex >= 0 ? preferIndex : (modals.length ? 0 : -1)
                            };
                          })();
                        `)

                        if (text) {
                          try {
                            const resp = await fetch(`http://localhost:8080/tasks/${userId}/add-instructions`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                employer_instructions: text,
                                application_id: currentJobApplicationIdRef.current ?? undefined
                              })
                            })
                            if (!resp.ok) { /* ignore */ }
                          } catch (err) { /* ignore */ }
                        }
                      }
                      for (let i = 0; i < 10; i++) { // faster resume/doc detection
                        const found = await webview.executeJavaScript(`
                          (() => {
                            const resumeSelect =
                              document.querySelector('select[id*="formfield"][id*="resume"]') ||
                              document.querySelector('select[ng-reflect-name="resume"]');
                            const label = Array.from(document.querySelectorAll('label'))
                              .find(l => (l.textContent || '').toLowerCase().includes('resume'));
                            const resumeButton =
                              document.querySelector('button[id*="formfield"][id*="resume"]') ||
                              Array.from(document.querySelectorAll('button')).find(b =>
                                (b.textContent || '').toLowerCase().includes('resume')
                              );
                            return {
                              hasLabel: !!label,
                              hasSelect: !!resumeSelect,
                              hasButton: !!resumeButton
                            };
                          })();
                        `)
                        if (found?.hasLabel || found?.hasSelect || found?.hasButton) {
                          seenResume = true
                          docFieldFound = true
                          if (!transcriptChecked) {
                            const transcriptExists = await webview.executeJavaScript(`
                              (() => {
                                const sel = document.querySelector('select[id*="transcript"]');
                                return !!sel;
                              })();
                            `)
                            if (transcriptExists) {
                              docFieldFound = true
                              let transcriptHandled = false
                              for (let t = 0; t < 10; t++) { // shorter wait to avoid long gaps
                                const selectResult = await webview.executeJavaScript(`
                                  (() => {
                                    const sel = document.querySelector('select[id*="transcript"]');
                                    if (!sel) return { found: false };
                                    sel.scrollIntoView({ behavior: 'instant', block: 'center' });
                                    if (typeof sel.click === 'function') sel.click();
                                    else sel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                    const options = Array.from(sel.options || []).map(o => ({
                                      value: o.value,
                                      text: (o.innerText || o.textContent || '').trim()
                                    })).filter(o => o.text || o.value);
                                    return { found: true, hasOptions: options.length > 0, options };
                                  })();
                                `)
                                if (selectResult?.found) {
                                  transcriptHandled = true
                                  if (selectResult.hasOptions && selectResult.options?.length) {
                                    await webview.executeJavaScript(`
                                      (() => {
                                        const sel = document.querySelector('select[id*="transcript"]');
                                        if (!sel) return false;
                                        const target = Array.from(sel.options || [])[0];
                                        if (!target) return false;
                                        sel.value = target.value;
                                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                                        sel.dispatchEvent(new Event('input', { bubbles: true }));
                                        return true;
                                      })();
                                    `)
                                  } else {
                                  await handleNoTranscript(clickJobResult.company, userId, currentJobApplicationIdRef.current)
                                  skipJob = true
                                  }
                                  break
                                }
                                await sleep(50)
                              }
                              if (!transcriptHandled) {
                              await handleNoTranscript(clickJobResult.company, userId, currentJobApplicationIdRef.current)
                              skipJob = true
                              }
                            }
                            transcriptChecked = true
                          }
                        if (skipJob) {
                          await recordApplication('draft')
                          await closeModalIfPresent(webview)
                          break
                        }
                          if (found?.hasSelect) {
                            await webview.executeJavaScript(`
                              (() => {
                                const btn = Array.from(document.querySelectorAll('button')).find(b => {
                                  const text = (b.textContent || '').trim().toLowerCase();
                                  const visible = !!(b.offsetParent);
                                  return (text === 'submit' || text === 'save') && !b.disabled && visible;
                                });
                                const isRed = !!(btn && (btn.className || '').toLowerCase().includes('btn_primary'));
                                return { hasSubmit: !!btn, hasRed: isRed };
                              })();
                            `)
                            const coverLetterExists = await webview.executeJavaScript(`
                              (() => {
                                const addBtn = document.querySelector('button[id*="formfield"][id*="cover_let"]');
                                const sel = document.querySelector('select[id*="formfield"][id*="cover_letter"]');
                                const textBtn = Array.from(document.querySelectorAll('button')).find(b =>
                                  (b.textContent || '').toLowerCase().includes('cover letter')
                                );
                                const input = document.querySelector('input[id*="cover"]') || document.querySelector('textarea[id*="cover"]');
                                return { hasSelect: !!sel, hasAdd: !!addBtn, hasAny: !!(sel || addBtn || textBtn || input) };
                              })();
                            `)
                            if (coverLetterExists?.hasAny) {
                              docFieldFound = true
                              if (coverLetterExists.hasSelect) {
                                
                                const coverOpenResult = await webview.executeJavaScript(`
                                  (() => {
                                    const sel = document.querySelector('select[id*="formfield"][id*="cover_letter"]');
                                    if (!sel) return { status: 'missing', options: [] };
                                    sel.scrollIntoView({ behavior: 'instant', block: 'center' });
                                    if (typeof sel.click === 'function') {
                                      sel.click();
                                    } else {
                                      sel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                    }
                                    const opts = Array.from(sel.querySelectorAll('option')).map(o => (o.innerText || o.textContent || '').trim()).filter(Boolean);
                                    return { status: 'clicked', options: opts };
                                  })();
                                `)
                                if (coverOpenResult?.status === 'clicked') {
                                  if (Array.isArray(coverOpenResult.options) && coverOpenResult.options.length) {
                                    const hasCompany = companyLower
                                      ? coverOpenResult.options.some((o: string) => o.toLowerCase().includes(companyLower))
                                      : false;
                                    if (!hasCompany) {
                                      if (!coverLetterTaskAdded) {
                                        documentsMissing = true
                                        await handleNoCoverLetter(clickJobResult.company, webview, userId, currentJobApplicationIdRef.current);
                                        coverLetterTaskAdded = true
                                      }
                                      skipJob = true
                                      break
                                    }
                                  }
                                }
                              } else {
                                if (!coverLetterTaskAdded) {
                                  documentsMissing = true
                                  await handleNoCoverLetter(clickJobResult.company, webview, userId, currentJobApplicationIdRef.current)
                                  coverLetterTaskAdded = true
                                }
                                skipJob = true
                                break
                              }
                            }

                            if (!workSampleChecked) {
                              const workSampleInfo = await webview.executeJavaScript(`
                                (() => {
                                  const sel = document.querySelector('select[id*="writing_sample"]');
                                  const opts = sel
                                    ? Array.from(sel.querySelectorAll('option')).map(o => ({
                                        text: (o.innerText || o.textContent || '').trim(),
                                        value: o.value
                                      })).filter(o => o.text)
                                    : [];
                                  const btn =
                                    document.querySelector('button[id*="writing_sample"]') ||
                                    Array.from(document.querySelectorAll('button')).find(b =>
                                      (b.textContent || '').toLowerCase().includes('work sample')
                                    );
                                  return { hasSelect: !!sel, options: opts, hasButton: !!btn };
                                })();
                              `)
                              const workSampleVisible = !!(workSampleInfo?.hasSelect || workSampleInfo?.hasButton)
                              if (workSampleVisible && workSampleInfo?.hasSelect) {
                                docFieldFound = true
                                const match = companyLower
                                  ? workSampleInfo.options.find((o: any) => o.text.toLowerCase().includes(companyLower))
                                  : null
                                if (match) {
                                  await webview.executeJavaScript(`
                                    (() => {
                                      const sel = document.querySelector('select[id*="writing_sample"]');
                                      if (!sel) return false;
                                      const target = Array.from(sel.options).find(o =>
                                        (o.innerText || o.textContent || '').toLowerCase().includes(${JSON.stringify(
                                          companyLower || ''
                                        )})
                                      );
                                      if (!target) return false;
                                      sel.value = target.value;
                                      sel.dispatchEvent(new Event('change', { bubbles: true }));
                                      return true;
                                    })();
                                  `)
                                } else {
                                  documentsMissing = true
                                  await handleNoWorkSample(clickJobResult.company, userId, currentJobApplicationIdRef.current)
                                  skipJob = true
                                }
                              } else if (workSampleVisible && workSampleInfo?.hasButton) {
                                docFieldFound = true
                                documentsMissing = true
                                await handleNoWorkSample(clickJobResult.company, userId, currentJobApplicationIdRef.current)
                                skipJob = true
                              }
                              workSampleChecked = true
                            }

                            if (!portfolioChecked) {
                              const portfolioInfo = await webview.executeJavaScript(`
                                (() => {
                                  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"][id*="other_documents"]'));
                                  const btn =
                                    document.querySelector('button[id*="other_documents"]') ||
                                    Array.from(document.querySelectorAll('button')).find(b =>
                                      (b.textContent || '').toLowerCase().includes('portfolio')
                                    );
                                  return { hasCheckboxes: checkboxes.length > 0, hasButton: !!btn };
                                })();
                              `)
                            const portfolioVisible = !!(portfolioInfo?.hasCheckboxes || portfolioInfo?.hasButton)
                            if (portfolioVisible && portfolioInfo?.hasCheckboxes) {
                              docFieldFound = true
                              await webview.executeJavaScript(`
                                (() => {
                                  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"][id*="other_documents"]'));
                                  checkboxes.forEach(cb => {
                                    if (!cb.checked) {
                                      cb.click();
                                    }
                                  });
                                  return true;
                                })();
                              `)
                            } else if (portfolioVisible && portfolioInfo?.hasButton) {
                              docFieldFound = true
                              await handleNoPortfolio(clickJobResult.company, userId, currentJobApplicationIdRef.current)
                              skipJob = true
                            }
                            portfolioChecked = true
                            }
                            if (skipJob) {
                              await recordApplication('draft')
                              await closeModalIfPresent(webview)
                              break
                            }

                            // Wait for red submit/save to appear; if it never turns red, close modal and continue.
                            let submitClicked = false
                            preferHeadlessClose = false
                            for (let attempt = 0; attempt < 20; attempt++) { // ~0.2s
                              const redNow = await webview.executeJavaScript(`
                                (() => {
                                  const btn = Array.from(document.querySelectorAll('button')).find(b => {
                                    const text = (b.textContent || '').trim().toLowerCase();
                                    const visible = !!(b.offsetParent);
                                    const isRed = (b.className || '').toLowerCase().includes('btn_primary');
                                    return text === 'submit' && !b.disabled && visible && isRed;
                                  });
                                  if (btn) {
                                    const hasDivider = !!document.querySelector('div.vr.ng-star-inserted');
                                    return { clicked: (() => { btn.scrollIntoView({ behavior: 'instant', block: 'center' }); btn.click(); return true; })(), hasDivider };
                                  }
                                  return { clicked: false, hasDivider: false };
                                })();
                              `)
                              if (redNow?.clicked) {
                                submitClicked = true
                                preferHeadlessClose = !!redNow?.hasDivider
                                break
                              }
                              await sleep(10)
                            }
                            if (!submitClicked) {
                              await closeModalIfPresent(webview, preferHeadlessClose)
                              skipJob = true
                              break
                            }
                            let submitGone = false
                            for (let attempt = 0; attempt < 20; attempt++) { // ~0.2s
                              const submitStillThere = await webview.executeJavaScript(`
                                (() => {
                                  const btn = Array.from(document.querySelectorAll('button')).find(b => {
                                    const text = (b.textContent || '').trim().toLowerCase();
                                    const visible = !!(b.offsetParent);
                                    return (text === 'submit' || text === 'save') && visible;
                                  });
                                  return !!btn;
                                })();
                              `)
                              if (!submitStillThere) {
                                await closeModalIfPresent(webview, preferHeadlessClose)
                                submitGone = true
                                break
                              }
                              await sleep(10)
                            }
                            if (!submitGone) {
                              await closeModalIfPresent(webview, preferHeadlessClose)
                            }
                            setStatus('running')
                            await waitForDividerSubmissionAndClose(webview)
                            if (skipJob) {
                              await recordApplication('draft')
                              await closeModalIfPresent(webview, preferHeadlessClose)
                              break
                            }
                          } else if (found?.hasButton) {
                            await webview.executeJavaScript(`
                              (() => {
                                const btn =
                                  document.querySelector('button[id*="formfield"][id*="resume"]') ||
                                  Array.from(document.querySelectorAll('button')).find(b =>
                                    (b.textContent || '').toLowerCase().includes('resume')
                                  );
                                if (!btn) return false;
                                btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                                btn.click();
                                return true;
                              })();
                            `)

                            // Wait for submit/save button to appear, then for it to be clicked (disappear)
                            while (true) {
                              const submitVisible = await webview.executeJavaScript(`
                                (() => {
                                  const btn = Array.from(document.querySelectorAll('button')).find(b => {
                                    const text = (b.textContent || '').trim().toLowerCase();
                                    const visible = !!(b.offsetParent);
                                    return (text === 'submit' || text === 'save') && !b.disabled && visible;
                                  });
                                  return !!btn;
                                })();
                              `)
                              if (submitVisible) { break }
                              await sleep(10)
                            }

                            const coverLetterExists = await webview.executeJavaScript(`
                              (() => {
                                const addBtn = document.querySelector('button[id*="formfield"][id*="cover_let"]');
                                const sel = document.querySelector('select[id*="formfield"][id*="cover_letter"]');
                                const textBtn = Array.from(document.querySelectorAll('button')).find(b =>
                                  (b.textContent || '').toLowerCase().includes('cover letter')
                                );
                                const input = document.querySelector('input[id*="cover"]') || document.querySelector('textarea[id*="cover"]');
                                return { hasSelect: !!sel, hasAdd: !!addBtn, hasAny: !!(sel || addBtn || textBtn || input) };
                              })();
                            `)
                            if (coverLetterExists?.hasAny) {
                              // Try to open the cover letter selector/dropdown for the user.
                              const coverOpenResult = await webview.executeJavaScript(`
                                (() => {
                                  const sel =
                                    document.querySelector('select[id*="formfield"][id*="cover_letter"]') ||
                                    document.querySelector('button[id*="formfield"][id*="cover_let"]');
                                  if (!sel) return { status: 'missing', options: [] };
                                  sel.scrollIntoView({ behavior: 'instant', block: 'center' });
                                  if (typeof sel.click === 'function') {
                                    sel.click();
                                  } else {
                                    sel.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                  }
                                  const opts = sel.tagName === 'SELECT'
                                    ? Array.from(sel.querySelectorAll('option')).map(o => (o.innerText || o.textContent || '').trim()).filter(Boolean)
                                    : [];
                                  return { status: 'clicked', options: opts };
                                })();
                              `)
                              if (coverOpenResult?.status === 'clicked') {
                                if (Array.isArray(coverOpenResult.options) && coverOpenResult.options.length) {
                                  const hasCompany = companyLower
                                    ? coverOpenResult.options.some((o: string) => o.toLowerCase().includes(companyLower))
                                    : false;
                                  if (!hasCompany) {
                                    await webview.executeJavaScript(`
                                      (() => {
                                        const btn =
                                          document.querySelector('button.modal-close') ||
                                          document.querySelector('button.headless-close-btn') ||
                                          Array.from(document.querySelectorAll('button')).find(b => {
                                            const cls = (b.className || '').toLowerCase();
                                            return cls.includes('modal-close') || cls.includes('headless-close-btn');
                                          });
                                        if (btn) {
                                          btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                                          if (typeof btn.click === 'function') btn.click();
                                          else btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                          return true;
                                        }
                                        return false;
                                      })();
                                    `)
                                    continue
                                  }
                                }
                              }
                              if (!coverLetterExists.hasSelect) {
                                if (!coverLetterTaskAdded) {
                                  await handleNoCoverLetter(clickJobResult.company, webview, userId, currentJobApplicationIdRef.current);
                                  coverLetterTaskAdded = true
                                }
                                await webview.executeJavaScript(`
                                  (() => {
                                    const btn =
                                      document.querySelector('button.modal-close') ||
                                      document.querySelector('button.headless-close-btn') ||
                                      Array.from(document.querySelectorAll('button')).find(b => {
                                        const cls = (b.className || '').toLowerCase();
                                        return cls.includes('modal-close') || cls.includes('headless-close-btn');
                                      });
                                    if (btn) {
                                      btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                                      if (typeof btn.click === 'function') btn.click();
                                      else btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                      return true;
                                    }
                                    return false;
                                  })();
                                `)
                                skipJob = true
                                break
                              }
                            }

                            if (!workSampleChecked) {
                              const workSampleInfo = await webview.executeJavaScript(`
                                (() => {
                                  const sel = document.querySelector('select[id*="writing_sample"]');
                                  const opts = sel
                                    ? Array.from(sel.querySelectorAll('option')).map(o => ({
                                        text: (o.innerText || o.textContent || '').trim(),
                                        value: o.value
                                      })).filter(o => o.text)
                                    : [];
                                  const btn =
                                    document.querySelector('button[id*="writing_sample"]') ||
                                    Array.from(document.querySelectorAll('button')).find(b =>
                                      (b.textContent || '').toLowerCase().includes('work sample')
                                    );
                                  return { hasSelect: !!sel, options: opts, hasButton: !!btn };
                                })();
                              `)
                              if (workSampleInfo?.hasSelect) {
                                const match = companyLower
                                  ? workSampleInfo.options.find((o: any) => o.text.toLowerCase().includes(companyLower))
                                  : null
                                if (match) {
                                  await webview.executeJavaScript(`
                                    (() => {
                                      const sel = document.querySelector('select[id*="writing_sample"]');
                                      if (!sel) return false;
                                      const target = Array.from(sel.options).find(o =>
                                        (o.innerText || o.textContent || '').toLowerCase().includes(${JSON.stringify(
                                          companyLower || ''
                                        )})
                                      );
                                      if (!target) return false;
                                      sel.value = target.value;
                                      sel.dispatchEvent(new Event('change', { bubbles: true }));
                                      return true;
                                    })();
                                  `)
                                }
                                workSampleChecked = true
                              } else if (workSampleInfo?.hasButton) {
                                await handleNoWorkSample(clickJobResult.company, userId, currentJobApplicationIdRef.current)
                            skipJob = true
                                workSampleChecked = true
                              } else {
                                await handleNoWorkSample(clickJobResult.company, userId, currentJobApplicationIdRef.current)
                            skipJob = true
                                workSampleChecked = true
                              }
                            }

                            if (!portfolioChecked) {
                              const portfolioInfo = await webview.executeJavaScript(`
                                (() => {
                                  const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"][id*="other_documents"]'));
                                  const btn =
                                    document.querySelector('button[id*="other_documents"]') ||
                                    Array.from(document.querySelectorAll('button')).find(b =>
                                      (b.textContent || '').toLowerCase().includes('portfolio')
                                    );
                                  return { hasCheckboxes: checkboxes.length > 0, hasButton: !!btn };
                                })();
                              `)
                              if (portfolioInfo?.hasCheckboxes) {
                                await webview.executeJavaScript(`
                                  (() => {
                                    const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"][id*="other_documents"]'));
                                    checkboxes.forEach(cb => {
                                      if (!cb.checked) {
                                        cb.click();
                                      }
                                    });
                                    return true;
                                  })();
                                `)
                                portfolioChecked = true
                              } else if (portfolioInfo?.hasButton) {
                                await handleNoPortfolio(clickJobResult.company, userId, currentJobApplicationIdRef.current)
                        skipJob = true
                                portfolioChecked = true
                              } else {
                                await handleNoPortfolio(clickJobResult.company, userId, currentJobApplicationIdRef.current)
                        skipJob = true
                                portfolioChecked = true
                              }
                            }
                    if (skipJob) {
                      await recordApplication('draft')
                      await closeModalIfPresent(webview)
                      break
                    }

                            // Wait specifically for red submit/save to appear
                            let submitClicked = false
                            preferHeadlessClose = false
                            for (let attempt = 0; attempt < 20; attempt++) { // ~0.2s
                              const redNow = await webview.executeJavaScript(`
                                (() => {
                                  const btn = Array.from(document.querySelectorAll('button')).find(b => {
                                    const text = (b.textContent || '').trim().toLowerCase();
                                    const visible = !!(b.offsetParent);
                                    const isRed = (b.className || '').toLowerCase().includes('btn_primary');
                                    return text === 'submit' && !b.disabled && visible && isRed;
                                  });
                                  if (btn) {
                                    const hasDivider = !!document.querySelector('div.vr.ng-star-inserted');
                                    btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                                    btn.click();
                                    return { clicked: true, hasDivider };
                                  }
                                  return { clicked: false, hasDivider: false };
                                })();
                              `)
                              if (redNow?.clicked) {
                                submitClicked = true
                                preferHeadlessClose = !!redNow?.hasDivider
                                break
                              }
                              await sleep(10)
                            }
                            if (!submitClicked) {
                              await closeModalIfPresent(webview, preferHeadlessClose)
                              skipJob = true
                              break
                            }
                            // Wait for submit to disappear
                            let submitGone = false
                            for (let attempt = 0; attempt < 20; attempt++) { // ~0.2s
                              const submitStillThere = await webview.executeJavaScript(`
                                (() => {
                                  const btn = Array.from(document.querySelectorAll('button')).find(b => {
                                    const text = (b.textContent || '').trim().toLowerCase();
                                    const visible = !!(b.offsetParent);
                                    return (text === 'submit' || text === 'save') && visible;
                                  });
                                  return !!btn;
                                })();
                              `)
                              if (!submitStillThere) {
                                await closeModalIfPresent(webview, preferHeadlessClose)
                                setStatus('running')
                                submitGone = true
                                break
                              }
                              await sleep(10)
                            }
                            if (!submitGone) {
                              await closeModalIfPresent(webview, preferHeadlessClose)
                              setStatus('running')
                              skipJob = true
                            }
                            await waitForDividerSubmissionAndClose(webview)
                          if (skipJob) {
                            await recordApplication('draft')
                            await closeModalIfPresent(webview, preferHeadlessClose)
                            break
                          }
                          }
                          break
                        }
                         if (skipJob) {
                           await recordApplication('draft')
                           await closeModalIfPresent(webview, preferHeadlessClose)
                           break
                         }
                          await sleep(50)
                      }
                      if (skipJob) {
                        await recordApplication('draft')
                        await closeModalIfPresent(webview, preferHeadlessClose)
                        continue
                      }
                      if (!docFieldFound && !documentsMissing) {
                        try {
                          const instructionsText = await webview.executeJavaScript(`
                            (() => {
                              const el = document.querySelector('#how-to-apply') || document.querySelector('p#how-to-apply');
                              const text = el ? (el.innerText || el.textContent || '').trim() : '';
                              if (text) return text;
                              const paragraphs = Array.from(document.querySelectorAll('p')).map(p => (p.innerText || p.textContent || '').trim()).filter(Boolean);
                              return paragraphs.join('\\n').trim();
                            })();
                          `)
                          const userId = await getUserId()
                          if (instructionsText && userId) {
                            needsExternalAction = true
                            await fetch(`http://localhost:8080/tasks/${userId}/add-instructions`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                employer_instructions: instructionsText,
                                application_id: currentJobApplicationIdRef.current ?? undefined
                              })
                            })
                          }
                        } catch (err) {}
                        await recordApplication(needsExternalAction ? 'external' : 'draft')
                        await closeModalIfPresent(webview, preferHeadlessClose)
                        // Wait for the "One more thing..." modal to appear, click through, then continue.
                        for (let m = 0; m < 20; m++) {
                          const modalVisible = await webview.executeJavaScript(`
                            (() => {
                              const text = Array.from(document.querySelectorAll('div, h1, h2, h3, h4, p')).find(el =>
                                (el.innerText || el.textContent || '').trim().toLowerCase().includes('one more thing')
                              );
                              const yesNo = Array.from(document.querySelectorAll('button')).some(b => {
                                const t = (b.textContent || '').trim().toLowerCase();
                                return t === 'yes' || t === 'no';
                              });
                              return !!(text || yesNo);
                            })();
                          `)
                          if (modalVisible) {
                            for (let y = 0; y < 30; y++) {
                              const clicked = await webview.executeJavaScript(`
                                (() => {
                                  const btn = Array.from(document.querySelectorAll('button')).find(b => {
                                    const txt = (b.textContent || '').trim().toLowerCase();
                                    const cls = (b.className || '').toLowerCase();
                                    return txt === 'yes' || cls.includes('yes');
                                  });
                                  if (!btn) return false;
                                  btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                                  if (typeof btn.click === 'function') btn.click();
                                  else btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                                  return true;
                                })();
                              `)
                              if (clicked) break
                              await new Promise(res => setTimeout(res, 100))
                            }
                            // Wait for the modal to disappear before continuing.
                            for (let z = 0; z < 30; z++) {
                              const stillVisible = await webview.executeJavaScript(`
                                (() => {
                                  const text = Array.from(document.querySelectorAll('div, h1, h2, h3, h4, p')).find(el =>
                                    (el.innerText || el.textContent || '').trim().toLowerCase().includes('one more thing')
                                  );
                                  const yesNo = Array.from(document.querySelectorAll('button')).some(b => {
                                    const t = (b.textContent || '').trim().toLowerCase();
                                    return t === 'yes' || t === 'no';
                                  });
                                  return !!(text || yesNo);
                                })();
                              `)
                              if (!stillVisible) break
                              await new Promise(res => setTimeout(res, 100))
                            }
                            break
                          }
                          await new Promise(res => setTimeout(res, 100))
                        }
                        continue
                      }
                    if (!documentsMissing && dividerExists) {
                      // instructions already collected pre-submit
                    }
                    if (!documentsMissing && instructions.length) {
                      await addEmployerTasks(instructions, userId as string, currentJobApplicationIdRef.current)
                    }
                    if (!seenResume) {
                      addLog('Waiting for user resume upload...')
                      playAlertSound()
                      setStatus('paused')
                      return  
                    }
                      await recordApplication(needsExternalAction ? 'external' : 'submitted')
                    }
                  } else if (data.decision === 'DO_NOT_APPLY') {
                    consecutiveDoNotApply += 1
                    addLog(`Decision: skip.`)                    
                    if (consecutiveDoNotApply >= 4) {
                      addLog('Moving to next search term...')
                      continue termLoop
                    }
                  } else {
                    consecutiveDoNotApply = 0
                    addLog('Decision unknown; skipping.')
                  }
                } else {
                  consecutiveDoNotApply = 0
                  addLog('Decision request failed; skipping.')
                }
              }
            } catch (e) {
              consecutiveDoNotApply = 0
            }
          } else if (clickJobResult?.status === 'skipped') {
            consecutiveDoNotApply = 0
            const reason = clickJobResult.reason
              ? ` (${String(clickJobResult.reason).toUpperCase()})`
              : ''
            addLog(`Skipped job #${idx + 1}${reason}.`)
          } else {
            consecutiveDoNotApply = 0
            addLog(`Job card #${idx + 1} missing or not clickable.`)
          }

          await sleep(2000)
        }

        const nextResult = await webview.executeJavaScript(`
          (() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => {
              const text = (b.textContent || '').trim().toLowerCase();
              const visible = !!(b.offsetParent);
              return visible && (text === 'next' || text === 'next >' || text.includes('next'));
            });
            if (!btn) return { exists: false };
            const disabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true' || (btn.className || '').toLowerCase().includes('disabled');
            if (disabled) return { exists: true, disabled: true, clicked: false };
            btn.scrollIntoView({ behavior: 'instant', block: 'center' });
            if (typeof btn.click === 'function') btn.click();
            else btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            return { exists: true, disabled: false, clicked: true };
          })();
        `)

        if (nextResult?.exists && nextResult.clicked && !nextResult.disabled) {
          addLog(`Moving to page ${pageIndex + 1})...`)
          pageIndex += 1
          await sleep(400)
          continue
        }

        if (nextResult?.exists && nextResult.clicked && !nextResult.disabled) {
          addLog(`Moving to page ${pageIndex + 1})...`)
          pageIndex += 1
          await sleep(400)
          continue
        }

        continue termLoop
      }
    }

    addLog('Completed running search terms.')

    setStatus('idle')
  }

  const handlePause = () => setStatus('paused')
  const handleResume = () => { setStatus('running') }
  const togglePanel = () => setIsPanelOpen(!isPanelOpen)

  return (
    <div className="automation-container">
      <div className="automation-header-row">
        {logs.length > 0 ? (
          <h1 className="automation-title">{logs[logs.length - 1].replace(/\[\d+:\d+:\d+ [AP]M\] /, '')}</h1>
        ) : (
          <h1 className="automation-title">automation</h1>
        )}
        <div className="header-controls">
          {status === 'running' ? (
            <button className="automation-pause-btn" title="Pause" onClick={handlePause}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
              </svg>
            </button>
          ) : status === 'paused' ? (
            <button className="automation-play-btn" title="Resume" onClick={handleResume}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          ) : (
            <button className="automation-play-btn" title="Play" onClick={handlePlayClick}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>
          )}
          <button className="automation-menu-btn" title="Menu" onClick={togglePanel}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="8" x2="20" y2="8" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="16" x2="14" y2="16" />
            </svg>
          </button>
        </div>
      </div>
      <div className="automation-content">
        <div className="browser-display">
          <div className="browser-content">
            <webview
              src="https://northeastern-csm.symplicity.com/students/?signin_tab=0"
              className="browser-iframe"
              partition="persist:nuworks"
              allowpopups="true"
            ></webview>
          </div>
          {!awaitingInput && <div className="interaction-blocker" />}
        </div>
      </div>
      <div className={`right-panel ${isPanelOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <button className="panel-close-btn" onClick={togglePanel}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div className="panel-content">
          <div className="console-logs">
            {logs.map((log, index) => (
              <div key={index} className="console-log-entry">
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>
    </div>
  )
}