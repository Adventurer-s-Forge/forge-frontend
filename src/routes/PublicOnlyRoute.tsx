import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/useAuth";
import { PageLoader } from "../components/PageLoader";

type FromState = { from?: { pathname?: string } } | null

export function PublicOnlyRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />

  if (user) {
    const state = location.state as FromState
    return <Navigate to={state?.from?.pathname ?? '/dashboard'} replace />
  }
  
  return <Outlet />
}