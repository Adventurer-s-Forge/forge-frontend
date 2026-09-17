export function PageLoader() {
  return (
    <div className="page-loader" role="status" aria-live="polite">
      <span className="page-loader-mark">d20</span>
      <span className="page-loader-text">Loading...</span>
    </div>
  )
}