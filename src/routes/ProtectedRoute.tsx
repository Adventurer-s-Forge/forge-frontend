import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../auth/useAuth";
import { PageLoader } from "../components/PageLoader";

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />

  return <Outlet />
}