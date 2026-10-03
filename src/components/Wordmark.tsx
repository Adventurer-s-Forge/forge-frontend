import { Link } from "react-router";

export function Wordmark({ to = '/'}: { to?: string }) {
  return (
    <Link to={to} className="wordmark">
      <span className="wordmark-mark" aria-hidden="true">
        20
      </span>
      <span className="wordmark-text">Adverturer's Forge</span>
    </Link>
  )
}