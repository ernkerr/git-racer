import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./lib/auth.tsx";
import Layout from "./components/Layout.tsx";

const Landing = lazy(() => import("./pages/Landing.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const CreateChallenge = lazy(() => import("./pages/CreateChallenge.tsx"));
const Challenge = lazy(() => import("./pages/Challenge.tsx"));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-pixel text-sm text-arcade-gray">LOADING...</div>}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<Layout />}>
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
    </Suspense>
  );
}
