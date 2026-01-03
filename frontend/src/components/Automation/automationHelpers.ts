/**
 * Automation Helper Functions
 */

interface AutomationResult {
  success: boolean
  message: string
  data?: any
}

/**
 * Polls for selector in the webview until it's present.
 */
export const waitForSelector = async (webview: any, selector: string): Promise<void> => {
  while (true) {
    const found = await webview.executeJavaScript(`!!document.querySelector(${JSON.stringify(selector)})`)
    if (found) return;
    await new Promise(r => setTimeout(r, 200));
  }
}

/**
 * Waits for a legend with prefix text content.
 */
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

/**
 * Waits for the dashboard search bar (never times out).
 */
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
