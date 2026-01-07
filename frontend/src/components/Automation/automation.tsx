import { useState, useEffect, useRef } from 'react'
import './automation.css'
import { waitForSelector, waitForLegend, waitForSearchBar, playAlertSound } from './automationHelpers'
import { getUserId } from '../../lib/supabase'

export default function Automation() {
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'error'>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [searchTerms, setSearchTerms] = useState<string[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  useEffect(() => {
    const fetchSearchTerms = async () => {
      try {
        const userId = await getUserId()
        if (!userId) {
          addLog('Error occured: no user found.')
          return
        }

        const response = await fetch(`http://localhost:8080/users/${userId}/search-terms`)
        if (!response.ok) {
          addLog('Error occured.')
          return
        }

        const data = await response.json()
        const terms = Array.isArray(data?.search_terms) ? data.search_terms : []
        setSearchTerms(terms)
      } catch (error) {
        addLog('Error occured.')
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

  const handlePlayClick = async () => {
    setStatus('running')
    addLog('Beginning automation...')
    const webview = document.querySelector('webview') as any
    if (!webview) {
      addLog('Error: Webview not found')
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
    addLog('Waiting for user input...')
    playAlertSound()
    addLog('Waiting for user input...')
    await waitForSearchBar(webview)

    addLog('Continuing...')
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
          addLog('Opened Jobs from navbar.')
          return
        }
        await sleep(250)
      }
      addLog('Jobs nav link not found; continuing anyway.')
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
          addLog('Opened job type dropdown.')
          return
        }
        await sleep(250)
      }
      addLog('Job type dropdown not found.')
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
          await sleep(200)
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
        addLog(`Applied ${applied?.matched || 0} job type filters${applied?.applied ? '' : ' (no apply button found)'}.`)
      } catch (err) {
        addLog('Error applying job type filters.')
      }
    })()

    // Wait for the search input on the jobs page
    await (async () => {
      for (let i = 0; i < 40; i++) {
        const found = await webview.executeJavaScript(`!!document.querySelector('input#jobs-keyword-input')`)
        if (found) return
        await sleep(250)
      }
    })()

    if (!searchTerms.length) {
      addLog('No search terms available to search.')
      setStatus('idle')
      return
    }

    addLog(`Running ${searchTerms.length} search terms...`)

    for (const term of searchTerms) {
      addLog(`Typing "${term}" into search box...`)
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

      addLog(`Enter pressed for "${term}". Waiting for Search button and clicking...`)

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
          addLog(`Clicked Search button for "${term}".`)
          clicked = true
          break
        }
        await sleep(250)
      }

      if (!clicked) {
        addLog(`Search button not found for "${term}".`)
      }

      await sleep(3000)

      // After search results load, click each job card on the page and log its title
      await (async () => {
        for (let i = 0; i < 40; i++) {
          const found = await webview.executeJavaScript(`
            (() => Array.from(document.querySelectorAll('div[id^="list-item-"]')).length)();
          `)
          if (found && found > 0) return
          await sleep(250)
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
              if (rawText.toLowerCase().includes('not qualified')) {
                return { status: 'skipped', reason: 'not qualified' };
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
            addLog(`Clicked job #${idx + 1}: ${titleStr}.`)
            console.log('Job title:', titleStr)
            // Give the detail pane a moment to update, then extract description
            await sleep(800)
            const descResult = await webview.executeJavaScript(`
              (() => {
                const normalize = (el) => (el?.innerText || el?.textContent || '').trim();

                const stripNoise = (text) => {
                  return text
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
                };

                const byHeading = () => {
                  const heading = Array.from(document.querySelectorAll('h1,h2,h3,h4,strong,b'))
                    .find(h => /job description/i.test(h.innerText || ''));
                  if (!heading) return '';
                  const scope = heading.closest('section, article, div') || heading.parentElement;
                  if (!scope) return '';
                  const blocks = Array.from(scope.querySelectorAll('p, li'))
                    .map(normalize)
                    .filter(t => t.length > 40);
                  const combined = blocks.join(' ').trim();
                  return stripNoise(combined);
                };

                const byLongest = () => {
                  const candidates = Array.from(document.querySelectorAll('main, section, article, div'))
                    .map(normalize)
                    .map(stripNoise)
                    .filter(t => t.length > 150);
                  if (!candidates.length) return '';
                  candidates.sort((a, b) => b.length - a.length);
                  return candidates[0];
                };

                return byHeading() || byLongest() || '';
              })();
            `)
            if (descResult && descResult.length) {
              const snippet = descResult.slice(0, 400) + (descResult.length > 400 ? '…' : '');
              addLog(`Description: ${snippet}`)
              console.log('Job description:', snippet)
            } else {
              addLog('Description not found.')
            }
          } else if (clickJobResult?.status === 'skipped') {
            addLog(`Skipped job #${idx + 1} (NOT QUALIFIED).`)
          } else {
            addLog(`Job card #${idx + 1} missing or not clickable.`)
          }

          await sleep(1200)
        }
      }
    }

    addLog('Completed running search terms.')

    setStatus('idle')
  }

  const handlePause = () => setStatus('paused')
  const handleResume = () => {
    setStatus('running')
    // Continue from next step here if you add further automation
  }
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