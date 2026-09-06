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
