// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { scrapeJobDescription, serializeBlock, stripNoise } from '../../symplicity/description'

const block = (html: string): Element => {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('serializeBlock', () => {
  it('keeps the surrounding text intact when the display text is a prefix of it', () => {
    const text = serializeBlock(block(
      'Learn more at https://www.smartleaf.com <a href="https://www.smartleaf.co/">https://www.smartleaf.co</a>'
    ))

    expect(text).toBe('Learn more at https://www.smartleaf.com https://www.smartleaf.co (https://www.smartleaf.co/)')
  })

  it('pairs each href with its own anchor when two anchors share display text', () => {
    const text = serializeBlock(block(
      'Apply <a href="https://example.com/one">here</a> or <a href="https://example.com/two">here</a>.'
    ))

    expect(text).toBe('Apply here (https://example.com/one) or here (https://example.com/two).')
  })

  it('emits an href whose display text is not present verbatim in the flattened text', () => {
    const text = serializeBlock(block(
      '<a href="https://example.com/apply">Apply\n    now</a>'
    ))

    expect(text).toBe('Apply now (https://example.com/apply)')
  })

  it('separates block-level children with newlines so stripNoise can filter line-wise', () => {
    const text = serializeBlock(block(
      '<p>Keywords: engineering</p><p>Build services.</p><ul><li>TypeScript</li><li>Go</li></ul>'
    ))

    expect(text.split('\n')).toEqual(['Keywords: engineering', 'Build services.', 'TypeScript', 'Go'])
    expect(stripNoise(text)).toBe('Build services. TypeScript Go')
  })

  it('returns an empty string for a missing element', () => {
    expect(serializeBlock(null)).toBe('')
  })
})

describe('scrapeJobDescription', () => {
  const evalWebview = { executeJavaScript: (code: string) => eval(code) }

  it('runs the injected script against the description panel', async () => {
    document.body.innerHTML = `
      <section>
        <h3>Job Description</h3>
        <p>Keywords: engineering, software, co-op positions in the Boston area</p>
        <p>Build and operate backend services for our advisory platform, in TypeScript and Go.</p>
        <p>Apply <a href="https://example.com/one">here</a>, and read more at <a href="https://www.smartleaf.co/">https://www.smartleaf.co</a> before you do.</p>
      </section>
    `

    const text = await scrapeJobDescription(evalWebview)

    expect(text).toBe(
      'Build and operate backend services for our advisory platform, in TypeScript and Go. ' +
      'Apply here (https://example.com/one), and read more at https://www.smartleaf.co (https://www.smartleaf.co/) before you do.'
    )
  })
})
