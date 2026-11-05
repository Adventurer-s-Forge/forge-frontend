import { Route, Routes } from "react-router";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { PublicOnlyRoute } from "./routes/PublicOnlyRoute";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";
import "./App.css"
import { Attribution } from "./pages/Attribution";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/attribution" element={<Attribution />} />

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App