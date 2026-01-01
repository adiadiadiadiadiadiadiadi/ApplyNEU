/**
 * Automation Helper Functions
 * 
 * These functions encapsulate all executeJavaScript calls for the automation page.
 * Each function takes a webview element and returns a Promise with the result.
 */

interface AutomationResult {
  success: boolean
  message: string
  data?: any
}

/**
 * Plays an alert sound to notify the user
 */
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
 * Waits for the login button to appear on the page
 */
export const waitForLoginButton = async (webview: any, timeoutMs: number = 10000): Promise<AutomationResult> => {
  const startTime = Date.now()
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await webview.executeJavaScript(`
        (function() {
          const button = document.querySelector('input.input-button.btn.btn_primary.full_width.btn_multi_line');
          return { found: !!button };
        })();
      `)
      
      if (result.found) {
        return { success: true, message: 'Page loaded - Login button found' }
      }
    } catch (error) {
      // Webview might not be ready yet, continue waiting
    }
    
    // Wait 200ms before checking again
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  
  return { success: false, message: 'Timeout: Login button not found' }
}

/**
 * Clicks the "Current Students And Alumni" login button
 */
export const navigateLogin = async (webview: any): Promise<AutomationResult> => {
  try {
    const result = await webview.executeJavaScript(`
      (function() {
        const button = document.querySelector('input.input-button.btn.btn_primary.full_width.btn_multi_line');
        if (button) {
          button.click();
          return { success: true };
        }
        return { success: false };
      })();
    `)
    
    if (result.success) {
      return { success: true, message: 'Navigated to login' }
    } else {
      return { success: false, message: 'Login button not found' }
    }
  } catch (error: any) {
    return { success: false, message: `Error: ${error.message}` }
  }
}
