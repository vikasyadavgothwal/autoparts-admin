import * as React from "react"

const MOBILE_BREAKPOINT = 768

/**
 * Return whether the current viewport is considered mobile based on a max-width media query.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false
    }
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
  })

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
