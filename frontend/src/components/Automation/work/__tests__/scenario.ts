import type { Answer } from './fakeWebview'

/**
 * Answers that walk the loop from the dashboard to a single job's apply modal.
 * Scenarios prepend their own answers, which win because the fake takes the first
 * match. Every entry here is invented -- see fakeWebview for what that does and
 * does not prove.
 */
export const reachesOneJob = (): Answer[] => [
  // nav + filters
  { match: "=== 'Jobs'", result: 'clicked' },
  { match: 'single-select-filter', result: 'set' },
  { match: 'listFilter-category-job_type', result: 'clicked' },
  { match: 'id^="job_type"', result: true },
  { match: 'const selections =', result: { matched: 1, applied: true } },
  { match: "=== 'more filters'", result: true },
  { match: "aria === 'apply'", result: 'clicked' },
  { match: "style.display !== 'none'", result: true },
  { match: 'exclude_applied_jobs', result: { found: true, clicked: true, already: false } },
  { match: 'name="postdate"', result: { found: true, clicked: true, already: false } },

  // search
  { match: "!!document.querySelector('input#jobs-keyword-input')", result: true },
  { match: 'placeholder: input.placeholder', result: { found: true, value: '', placeholder: '' } },
  { match: 'const chars =', result: 'typed' },
  { match: "KeyboardEvent('keydown'", result: 'enter-dispatched' },
  { match: 'btn.btn_alt-default', result: 'clicked' },
  { match: "return { found: true, value: input.value || '' }", result: { found: true, value: 'software' } },

  // one job card, then no more pages. `skipUnpaid` must precede `list-item-`: the
  // card-click script contains both, and the fake takes the first match.
  { match: 'skipUnpaid', result: { status: 'clicked', title: 'Backend Intern', company: 'Acme', displayTitle: 'Backend Intern @ Acme' } },
  { match: 'list-item-', result: 1 },
  { match: 'job description', result: 'A backend internship building services. '.repeat(4) },
  { match: "text === 'next'", result: { exists: false } },

  // the apply modal opens, with a resume dropdown and no how-to-apply divider
  { match: "text === 'apply' && !b.disabled", result: true },
  { match: "'how to apply'", result: false },
  { match: 'hasSubmit: !!btn', result: { hasSubmit: false, hasRed: false } },
  { match: 'hasLabel: !!label', result: { hasLabel: true, hasSelect: true, hasButton: false } },

  // no cover letter, work sample or portfolio is asked for
  { match: 'hasAny: !!(sel || addBtn', result: { hasSelect: false, hasAdd: false, hasAny: false } },
  { match: 'hasSelect: !!sel, options: opts', result: { hasSelect: false, options: [], hasButton: false } },
  { match: 'hasCheckboxes: checkboxes.length', result: { hasCheckboxes: false, hasButton: false } },

  // submit never turns red, so the loop closes the modal and moves on
  { match: 'isRed = (b.className', result: { clicked: false, hasDivider: false } },
  { match: 'headless-close-btn', result: true },
]
