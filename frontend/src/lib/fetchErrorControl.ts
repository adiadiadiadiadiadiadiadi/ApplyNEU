// When suppressed, the global fetch interceptor will NOT redirect to the /error
// fallback page; the suppressor logs its own failures instead.
//
// Keyed, not boolean: the Automation screen and an Automation run both want
// suppression and their lifetimes overlap, so a boolean let whichever released
// last re-enable the redirect underneath the other.
const suppressors = new Set<string>()

export const suppressErrorRedirect = (key: string) => {
  suppressors.add(key)
}

export const releaseErrorRedirect = (key: string) => {
  suppressors.delete(key)
}

export const isErrorRedirectSuppressed = () => suppressors.size > 0
