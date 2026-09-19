import { useEffect, useState } from "react";

const OUTLINE = '50,4 90,27 90,73 50,96 10,73 10,27'
const CENTER = '50,74 71,38 29,38'
const SPOKES = [
  { x1: 50, y1: 74, x2: 50, y2: 96 },
  { x1: 71, y1: 38, x2: 90, y2: 27 },
  { x1: 29, y1: 38, x2: 10, y2: 27 },
]

export function PageLoader() {
  const [face, setFace] = useState(20)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = setInterval(() => {
      setFace(Math.floor(Math.random() * 20) + 1)
    }, 140)

    return () => clearInterval(id)
  }, [])

  return (
    <div className="page-loader" role="status" aria-live="polite">
      <svg className="d20" viewBox="0 0 100 100" aria-hidden="true">
        <g className="d20-body">
          <polygon className="d20-outline" points={OUTLINE} />
          <polygon className="d20-center" points={CENTER} />
          {SPOKES.map((spoke) => (
            <line className="d20-spoke" key={spoke.x2} {...spoke} />
          ))}
        </g>
        <text className="d20-face" x="50" y="53" textAnchor="middle">
          {face}
        </text>
      </svg>
      <span className="page-loader-text">Rolling...</span>
    </div>
  )
}