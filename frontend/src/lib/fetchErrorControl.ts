// When suppressed, the global fetch interceptor will NOT redirect to the /error
// fallback page. The active screen is responsible for handling/logging its own
// fetch errors instead (e.g. Automation logs them to its console).
let suppressed = false

export const setErrorRedirectSuppressed = (value: boolean) => {
  suppressed = value
}

export const isErrorRedirectSuppressed = () => suppressed
