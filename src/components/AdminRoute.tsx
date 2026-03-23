import { Navigate, Outlet } from 'react-router-dom';
import { UserProfile } from '../types';

interface AdminRouteProps {
  profile: UserProfile | null;
}

export default function AdminRoute({ profile }: AdminRouteProps) {
  if (profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
