type NavOptions = { state?: unknown; replace?: boolean }

let _navigate: ((path: string, options?: NavOptions) => void) | null = null

export const setNavigate = (fn: (path: string, options?: NavOptions) => void) => {
  _navigate = fn
}

export const navigateTo = (path: string, options?: NavOptions) => {
  _navigate?.(path, options)
}
