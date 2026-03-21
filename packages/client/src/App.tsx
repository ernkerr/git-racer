import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth.tsx";
import Layout from "./components/Layout.tsx";
import Landing from "./pages/Landing.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import CreateChallenge from "./pages/CreateChallenge.tsx";
import Challenge from "./pages/Challenge.tsx";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Landing />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/challenges/new"
          element={
            <ProtectedRoute>
              <CreateChallenge />
            </ProtectedRoute>
          }
        />
        <Route path="/c/:slug" element={<Challenge />} />
      </Route>
    </Routes>
  );
}
