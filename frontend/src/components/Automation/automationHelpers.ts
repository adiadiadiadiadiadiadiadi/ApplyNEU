/**
 * Automation Helper Functions
 */

interface AutomationResult {
  success: boolean
  message: string
  data?: any
}

export const playAlertSound = () => {
  const audioContext = new AudioContext()
  const oscillator = audioContext.createOscillator()
  const gainNode = audioContext.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(audioContext.destination)

  oscillator.frequency.value = 800 // Frequency in Hz
  oscillator.type = 'sine'

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)

  oscillator.start(audioContext.currentTime)
  oscillator.stop(audioContext.currentTime + 0.5)
}

/**
 * Uses querySelector to poll for a selector until it is found, or timeout.
 */
export const waitForSelector = async (webview: any, selector: string, maxTimeMs = 10000): Promise<boolean> => {
  const start = Date.now()
  while (Date.now() - start < maxTimeMs) {
    const found = await webview.executeJavaScript(`!!document.querySelector(${JSON.stringify(selector)})`)
    if (found) return true
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}

/**
 * Waits for a legend with specified textContent (prefix match)
 */
export const waitForLegend = async (webview: any, prefix: string, maxTimeMs = 10000): Promise<boolean> => {
  const start = Date.now()
  while (Date.now() - start < maxTimeMs) {
    const found = await webview.executeJavaScript(`
      (() => {
        const legend = Array.from(document.querySelectorAll('legend'))
          .find(el => el.innerText && el.innerText.trim().indexOf(${JSON.stringify(prefix)}) === 0)
        return !!legend
      })();
    `)
    if (found) return true
    await new Promise(r => setTimeout(r, 200))
  }
  return false
}
