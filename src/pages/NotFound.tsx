import { Link } from "react-router";

export function NotFound() {
  return (
    <main className="screen">
      <div className="card card-narrow">
        <p className="eyebrow">404</p>
        <h1>Nothing down this corridor.</h1>
        <p className="muted">
          That page does not exist -- or it did, and something ate it.
        </p>
        <Link className="btn btn-primary" to="/">
          Back to the entrance
        </Link>
      </div>
    </main>
  )
}