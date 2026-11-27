import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react"

type ReducedMotionProviderProps = { children: ReactNode }

const ReducedMotionContext = createContext<{
  reducedMotion: boolean
  toggleReducedMotion: () => void
} | undefined>(undefined)

export function ReducedMotionProvider({ children }: ReducedMotionProviderProps) {
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
  })

  const toggleReducedMotion = useCallback(() => setReducedMotion((p) => !p), [])

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  return (
    <ReducedMotionContext.Provider value={{ reducedMotion, toggleReducedMotion }}>
      {children}
    </ReducedMotionContext.Provider>
  )
}

export function useReducedMotion() {
  const ctx = useContext(ReducedMotionContext)
  if (!ctx) throw new Error("useReducedMotion must be used within ReducedMotionProvider")
  return ctx
}
