import { useEffect, useMemo, useState } from 'react'
import './loaders.css'

type Props = {
  ready: boolean
  onComplete: () => void
}

const LoadingScreen = ({ ready, onComplete }: Props) => {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState(0)
  const [shouldHide, setShouldHide] = useState(false)

  const targetWhileWaiting = 85

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        const target = ready ? 100 : targetWhileWaiting
        if (prev >= target) return prev
        return Math.min(prev + 2, target)
      })
    }, 30)

    return () => clearInterval(interval)
  }, [ready])

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 160)
    const t2 = setTimeout(() => setPhase(2), 480)
    const t3 = setTimeout(() => setPhase(3), 860)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [])

  useEffect(() => {
    if (shouldHide || !ready || progress < 100) return
    setShouldHide(true)
    const timeout = setTimeout(onComplete, 420)
    return () => clearTimeout(timeout)
  }, [onComplete, progress, ready, shouldHide])

  const subtitle = useMemo(() => {
    if (progress < 30) return 'initializing workspace'
    if (progress < 60) return 'checking session'
    if (progress < 90) return 'preparing dashboard'
    return 'ready'
  }, [progress])

  return (
    <div className="loading-screen" data-hide={shouldHide}>
      <div className="loading-screen__glow" data-phase={phase} aria-hidden />

      <div className="loading-screen__grid" aria-hidden />

      <div
        className="loading-screen__title"
        style={{
          opacity: phase >= 1 ? 1 : 0,
          transform: `translateY(${phase >= 1 ? 0 : 16}px)`,
        }}
      >
        <span className="loading-screen__brand">apply</span>
        <span className="loading-screen__brand loading-screen__brand--accent">neu</span>
      </div>

      <p
        className="loading-screen__subtitle"
        style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: `translateY(${phase >= 2 ? 0 : 12}px)`,
        }}
      >
        {subtitle}
      </p>

      <div
        className="loading-screen__progress"
        style={{
          opacity: phase >= 2 ? 1 : 0,
          transform: `translateY(${phase >= 2 ? 0 : 12}px)`,
        }}
      >
        <div className="loading-screen__bar">
          <span className="loading-screen__bar-fill" style={{ width: `${progress}%` }} />
        </div>
        <p className="loading-screen__percent">{progress}%</p>
      </div>

      <div
        className="loading-screen__dots"
        style={{
          opacity: phase >= 3 ? 1 : 0,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span key={i} className="loading-screen__dot" style={{ animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
    </div>
  )
}

export default LoadingScreen
