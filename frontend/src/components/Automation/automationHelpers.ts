/**
 * Automation Helper Functions
 */

interface AutomationResult {
  success: boolean
  message: string
  data?: any
}

export const waitForSelector = async (webview: any, selector: string): Promise<void> => {
  while (true) {
    const found = await webview.executeJavaScript(`!!document.querySelector(${JSON.stringify(selector)})`)
    if (found) return;
    await new Promise(r => setTimeout(r, 200));
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
    await new Promise(r => setTimeout(r, 200));
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
