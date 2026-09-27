import { useEffect, useState } from 'react'
import './loaders.css'

type Props = {
  ready: boolean
  onComplete: () => void
}

const LoadingScreen = ({ ready, onComplete }: Props) => {
  const [shouldHide, setShouldHide] = useState(false)

  useEffect(() => {
    if (shouldHide || !ready) return
    setShouldHide(true)
    const timeout = setTimeout(onComplete, 420)
    return () => clearTimeout(timeout)
  }, [onComplete, ready, shouldHide])

  return (
    <div className="loading-screen" data-hide={shouldHide}>
      <div className="component-loader__spinner" role="status" aria-label="loading">
        <div className="component-loader__ring" />
        <div className="component-loader__ring component-loader__ring--accent" />
        <div className="component-loader__core" />
      </div>
      <span className="loading-screen__brand">ApplyNEU</span>
    </div>
  )
}

export default LoadingScreen
