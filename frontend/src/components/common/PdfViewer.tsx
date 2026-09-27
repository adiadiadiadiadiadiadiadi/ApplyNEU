import { useEffect, useRef, useState } from 'react'
// The legacy build bundles the core-js polyfills for URL.parse and
// Promise.withResolvers, which the Chromium in Electron 28 does not have.
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import ComponentLoader from './ComponentLoader'
import './pdfViewer.css'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

// Pages render at a fixed scale and CSS sizes them down, so rendering never depends on
// the container having been laid out yet.
const RENDER_SCALE = 3

type Props = {
  url: string
}

const PdfViewer = ({ url }: Props) => {
  const pagesRef = useRef<HTMLDivElement | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')

  useEffect(() => {
    const pages = pagesRef.current
    if (!pages) return

    let cancelled = false
    setStatus('loading')
    const task = pdfjs.getDocument(url)

    const render = async () => {
      try {
        const doc = await task.promise
        if (cancelled) return
        pages.replaceChildren()

        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
          const page = await doc.getPage(pageNumber)
          if (cancelled) return

          const viewport = page.getViewport({ scale: RENDER_SCALE })
          const canvas = document.createElement('canvas')
          canvas.className = 'pdf-viewer__page'
          canvas.width = viewport.width
          canvas.height = viewport.height
          pages.appendChild(canvas)

          await page.render({ canvas, viewport }).promise
          if (cancelled) return
        }

        setStatus('ready')
      } catch (err) {
        console.error('Failed rendering pdf', err)
        if (!cancelled) setStatus('failed')
      }
    }

    void render()

    return () => {
      cancelled = true
      void task.destroy()
    }
  }, [url])

  return (
    <div className="pdf-viewer">
      {status === 'loading' && <ComponentLoader fullPage label="loading resume" />}
      {status === 'failed' && <p className="pdf-viewer__error">could not display this resume</p>}
      <div ref={pagesRef} className="pdf-viewer__pages" data-hidden={status !== 'ready'} />
    </div>
  )
}

export default PdfViewer
