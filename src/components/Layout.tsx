import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { auth } from '../firebase';
import { UserProfile } from '../types';
import { Video, LayoutDashboard, Settings, LogOut, Coins, PlusCircle, Library, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';

interface LayoutProps {
  user: User | null;
  profile: UserProfile | null;
}

export default function Layout({ user, profile }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/generate', icon: PlusCircle, label: 'Generate' },
    { path: '/kids', icon: Sparkles, label: 'Noor Stories' },
    { path: '/', icon: Library, label: 'Library' },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-900 flex flex-col p-6 space-y-8 bg-zinc-950/50 backdrop-blur-xl sticky top-0 h-screen">
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Video className="text-zinc-950 w-6 h-6" />
          </div>
          <span className="text-2xl font-black tracking-tighter uppercase italic">Lumina</span>
        </Link>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                "flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 group",
                location.pathname === item.path 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              <item.icon className={clsx(
                "w-5 h-5 transition-colors",
                location.pathname === item.path ? "text-emerald-500" : "text-zinc-500 group-hover:text-zinc-300"
              )} />
              <span className="font-medium">{item.label}</span>
            </Link>
          ))}
          
          {profile?.role === 'admin' && (
            <Link
              to="/admin"
              className={clsx(
                "flex items-center space-x-3 p-3 rounded-xl transition-all duration-200 group",
                location.pathname === '/admin' 
                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              )}
            >
              <Settings className={clsx(
                "w-5 h-5 transition-colors",
                location.pathname === '/admin' ? "text-emerald-500" : "text-zinc-500 group-hover:text-zinc-300"
              )} />
              <span className="font-medium">Admin Panel</span>
            </Link>
          )}
        </nav>

        <div className="pt-6 border-t border-zinc-900 space-y-4">
          <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-900 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Credits</span>
              <Coins className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold text-white">
              {profile?.role === 'admin' ? 'Unlimited' : (profile?.credits ?? 0)}
            </p>
            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-1000" 
                style={{ width: profile?.role === 'admin' ? '100%' : `${Math.min(100, ((profile?.credits ?? 0) / 10) * 100)}%` }}
              />
            </div>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 p-3 rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-500 transition-all group"
          >
            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/20 via-zinc-950 to-zinc-950">
        <header className="h-16 border-b border-zinc-900 flex items-center justify-end px-8 sticky top-0 bg-zinc-950/80 backdrop-blur-md z-40">
          <div className="flex items-center space-x-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-white">{user?.email?.split('@')[0]}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest">{profile?.role}</p>
            </div>
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-xl flex items-center justify-center text-zinc-950 font-black shadow-lg shadow-emerald-500/10">
              {user?.email?.[0].toUpperCase()}
            </div>
          </div>
        </header>
        <div className="p-8 pb-24">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
