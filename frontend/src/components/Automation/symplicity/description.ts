// The NUWorks job-description panel.

/**
 * Flattens a description block to text, emitting `display (href)` in place of each
 * anchor. Walking the DOM (rather than serializing first and splicing hrefs in by
 * string search) is what keeps each href attached to its own link.
 *
 * Stringified into the injected script, so it must stay self-contained.
 */
export const serializeBlock = (el: Element | null): string => {
  if (!el) return ''
  const blockTags = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|BR|DD|DIV|DL|DT|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H1|H2|H3|H4|H5|H6|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|TD|TH|TR|UL)$/
  const parts: string[] = []
  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      parts.push((node.nodeValue || '').replace(/\s+/g, ' '))
      return
    }
    if (node.nodeType !== 1) return
    const element = node as Element
    const tag = (element.tagName || '').toUpperCase()
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return
    const isBlock = blockTags.test(tag)
    if (isBlock) parts.push('\n')
    const href = tag === 'A'
      ? ((element as HTMLAnchorElement).href || element.getAttribute('href') || '')
      : ''
    if (href) {
      const display = (element.textContent || '').replace(/\s+/g, ' ').trim()
      parts.push(display.length ? `${display} (${href})` : href)
    } else {
      Array.from(element.childNodes).forEach(walk)
    }
    if (isBlock) parts.push('\n')
  }
  walk(el)
  return parts
    .join('')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}

/** Drops the search-chrome lines that share the description panel's container. */
export const stripNoise = (text: string): string =>
  text
    .split('\n')
    .map(t => t.trim())
    .filter(t =>
      t.length > 0 &&
      !/home\/jobs\/search/i.test(t) &&
      !/keywords/i.test(t) &&
      !/location/i.test(t) &&
      !/distance/i.test(t) &&
      !/show me/i.test(t) &&
      !/all jobs/i.test(t)
    )
    .join(' ')

const descriptionScript = `
  (async () => {
    const serializeBlock = ${serializeBlock};
    const stripNoise = ${stripNoise};

    // Wait for a job description heading to appear (up to ~4s)
    let heading = null;
    for (let i = 0; i < 16; i++) {
      heading = Array.from(document.querySelectorAll('h1,h2,h3,h4,strong,b'))
        .find(h => /job description/i.test(h.innerText || h.textContent || ''));
      if (heading) break;
      await new Promise(r => setTimeout(r, 250));
    }
    if (!heading) return '';

    const scope = heading.closest('section, article, div') || heading.parentElement;
    if (!scope) return '';

    const blocks = Array.from(scope.querySelectorAll('p, li, div'))
      .map(serializeBlock)
      .filter(t => t.length > 40);
    return stripNoise(blocks.join('\\n').trim());
  })();
`

export const scrapeJobDescription = async (webview: any): Promise<string> =>
  ((await webview.executeJavaScript(descriptionScript)) || '').toString()
