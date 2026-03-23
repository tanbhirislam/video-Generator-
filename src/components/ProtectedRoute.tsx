import { Navigate, Outlet } from 'react-router-dom';
import { User } from 'firebase/auth';

interface ProtectedRouteProps {
  user: User | null;
}

export default function ProtectedRoute({ user }: ProtectedRouteProps) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
