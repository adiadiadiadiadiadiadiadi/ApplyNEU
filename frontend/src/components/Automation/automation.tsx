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

  async function handleNoCoverLetter(companyName: string, webview: any, userId: string | undefined) {
    addLog(`No cover letter found for ${companyName}.`)
    if (!userId) {
      addLog(`Error occured.`)
      return
    }
    const resp = await fetch(`http://localhost:8080/tasks/${userId}/new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Upload ${companyName} cover letter`,
        description: `Upload your ${companyName} cover letter in the 'My Documents' tab in NUWorks. Make sure the document's name includes '${companyName}'`
      })
    })
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

  useEffect(() => {
    const fetchSearchTerms = async () => {
      try {
        const userId = await getUserId()
        if (!userId) {
          addLog('Error occured: no user found.')
          return
        }
        addLog(userId)

        const response = await fetch(`http://localhost:8080/users/${userId}/search-terms`)
        if (!response.ok) {
          addLog('Error occured. Invalid response.')
          return
        }

        const data = await response.json()
        const terms = Array.isArray(data?.search_terms) ? data.search_terms : []
        setSearchTerms(terms)
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
        addLog(`Error: ${event.errorDescription || 'failed to load'}`)
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

  const addEmployerTasks = async (instructions: EmployerInstruction[], userId: string) => {
    const tasks = instructions.filter(inst => inst.text && inst.description)
    if (!tasks.length) return
    try {
      await Promise.allSettled(
        tasks.map(async ({ text, description }) => {
          const resp = await fetch(`http://localhost:8080/tasks/${userId}/new`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, description })
          })
          if (!resp.ok) {
            const msg = await resp.text().catch(() => '')
            throw new Error(`status ${resp.status} ${msg}`)
          }
          return true
        })
      )
    } catch (err) {
      addLog('Error occured.')
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
      const userId = await getUserId()
      if (!userId) {
        addLog('Unable to fetch job types (no user).')
        return
      }
      try {
        const resp = await fetch(`http://localhost:8080/users/${userId}/job-types`)
        if (!resp.ok) {
          addLog('Failed to fetch job types.')
          return
        }
        const data = await resp.json()
        const jobTypes: string[] = Array.isArray(data?.job_types) ? data.job_types : []
        if (!jobTypes.length) {
          addLog('No job types set; skipping filters.')
          return
        }

        // Wait for dropdown checkboxes to render
        for (let i = 0; i < 20; i++) {
          const ready = await webview.executeJavaScript(`!!document.querySelector('input[type="checkbox"][id^="job_type"]')`)
          if (ready) break
          await sleep(10)
        }

        const applied = await webview.executeJavaScript(`
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

    // Wait for the search input on the jobs page
    await (async () => {
      for (let i = 0; i < 40; i++) {
        const found = await webview.executeJavaScript(`!!document.querySelector('input#jobs-keyword-input')`)
        if (found) return
         await sleep(100)
      }
    })()

    if (!searchTerms.length) {
      addLog('No search terms available to search.')
      setStatus('idle')
      return
    }

    for (const term of searchTerms) {
      addLog(`Searching for "${term}"...`)
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

      if (typeResult === 'missing-input') {
        addLog(`Failed to type "${term}" (input not found).`)
        continue
      }

      addLog(`Typing complete for "${term}". Pressing Enter...`)

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
        addLog(`Failed to press Enter for "${term}" (input not found).`)
        continue
      }

      let clicked = false
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
          clicked = true
          break
        }
         await sleep(100)
      }

      if (!clicked) {
        addLog(`Search button not found for "${term}".`)
      }

       await sleep(100)

      // After search results load, click each job card on the page and log its title
      await (async () => {
        for (let i = 0; i < 40; i++) {
          const found = await webview.executeJavaScript(`
            (() => Array.from(document.querySelectorAll('div[id^="list-item-"]')).length)();
          `)
          if (found && found > 0) return
           await sleep(100)
        }
      })()

      const jobCount = await webview.executeJavaScript(`
        (() => Array.from(document.querySelectorAll('div[id^="list-item-"]')).length)();
      `)

      if (!jobCount || jobCount <= 0) {
        addLog(`No job cards found for "${term}".`)
      } else {
        addLog(`Found ${jobCount} job cards for "${term}". Clicking through...`)
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
              const userId = await getUserId()
              if (!userId) {
                addLog('Decision skipped (no user).')
              } else {
                // Always extract via LLM; inline handling/logging moved before submit click.
                addLog('Sending job description to LLM.')
                const resp = await fetch(`http://localhost:8080/jobs/${userId}/send-job`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ job_description: descResult || '' })
                })
                if (resp.ok) {
                  const data = await resp.json()
                  const instructions = normalizeEmployerInstructions(data?.employer_instructions)
                  if (data.decision === 'APPLY') {
                    addLog(`Applying to "${titleStr}"...`)
                    const applied = await webview.executeJavaScript(`
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
                    if (applied) {
                      // Wait/check for resume UI presence before inline-instructions check.
                      const resumeUIPresent = await webview.executeJavaScript(`
                        (() => {
                          const select = document.querySelector('select[id*="resume"]');
                          return !!select;
                        })();
                      `)

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
                      if (dividerExists) {
                        const howToApplyText = await webview.executeJavaScript(`
                          (() => {
                            const el = document.querySelector('p#how-to-apply');
                            return el ? (el.innerText || el.textContent || '').trim() : '';
                          })();
                        `)
                        if (howToApplyText) {
                          try {
                            const resp = await fetch(`http://localhost:8080/tasks/${userId}/add-instructions`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ employer_instructions: howToApplyText })
                            })
                            if (!resp.ok) { }
                          } catch (err) { }
                        }
                      }
                      if (instructions.length) {
                        await addEmployerTasks(instructions, userId)
                      }
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
                      let seenResume = false
                      let coverLetterTaskAdded = false
                      for (let i = 0; i < 40; i++) {
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
                                        await handleNoCoverLetter(clickJobResult.company, webview, userId);
                                        coverLetterTaskAdded = true
                                      }
                                      continue
                                    }
                                  }
                                }
                              } else {
                                if (!coverLetterTaskAdded) {
                                  await handleNoCoverLetter(clickJobResult.company, webview, userId)
                                  coverLetterTaskAdded = true
                                }
                                continue
                              }
                            }

                            // Wait for red submit/save to appear (no hard timeout)
                            while (true) {
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
                                break
                              }
                              await sleep(10)
                            }
                            // Wait for submit button to disappear (user clicked it) before continuing (no hard timeout)
                            while (true) {
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
                                await webview.executeJavaScript(`
                                  (() => {
                                    const btn =
                                      document.querySelector('button.modal-close') ||
                                      document.querySelector('button.headless-close-btn') ||
                                      Array.from(document.querySelectorAll('button')).find(b => {
                                        const cls = (b.className || '').toLowerCase();
                                        return cls.includes('modal-close') || cls.includes('headless-close-btn');
                                      });
                                    if (!btn) return false;
                                    btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                                    btn.click();
                                    return true;
                                  })();
                                `)
                                break
                              }
                              await sleep(10)
                            }
                            setStatus('running')
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
                            if (!coverLetterExists?.hasAny) {
                              addLog('No cover letter input found; continuing without it.')
                            } else if (coverLetterExists?.hasAny) {
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
                                  await handleNoCoverLetter(clickJobResult.company, webview, userId);
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
                                continue
                              }
                            }

                            // Wait specifically for red submit/save to appear
                            while (true) {
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
                                break
                              }
                              await sleep(10)
                            }
                            // Wait for submit to disappear
                            while (true) {
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
                                await webview.executeJavaScript(`
                                  (() => {
                                    const btn =
                                      document.querySelector('button.modal-close') ||
                                      document.querySelector('button.headless-close-btn') ||
                                      Array.from(document.querySelectorAll('button')).find(b => {
                                        const cls = (b.className || '').toLowerCase();
                                        return cls.includes('modal-close') || cls.includes('headless-close-btn');
                                      });
                                    if (!btn) return false;
                                    btn.scrollIntoView({ behavior: 'instant', block: 'center' });
                                    btn.click();
                                    return true;
                                  })();
                                `)
                                setStatus('running')
                                break
                              }
                              await sleep(10)
                            }
                          }
                          break
                        }
                         await sleep(100)
                      }
                      if (!seenResume) {
                        addLog('Waiting for user resume upload...')
                        playAlertSound()
                        setStatus('paused')
                        return
                      }
                    } else {
                      addLog('Apply button not found.')
                    }
                  } else if (data.decision === 'DO_NOT_APPLY') {
                    addLog(`Decision: DO_NOT_APPLY for "${titleStr}". Skipping.`)
                  } else {
                    addLog('Decision unknown; skipping.')
                  }
                } else {
                  addLog('Decision request failed; skipping.')
                }
              }
            } catch (e) {
              addLog('Decision error; skipping.')
            }
          } else if (clickJobResult?.status === 'skipped') {
            const reason = clickJobResult.reason
              ? ` (${String(clickJobResult.reason).toUpperCase()})`
              : ''
            addLog(`Skipped job #${idx + 1}${reason}.`)
          } else {
            addLog(`Job card #${idx + 1} missing or not clickable.`)
          }

          await sleep(100)
        }
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