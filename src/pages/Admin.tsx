import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile, GlobalSettings } from '../types';
import { Users, Settings, Coins, ShieldCheck, Search, Plus, Minus, ToggleLeft, ToggleRight, Loader2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

export default function Admin() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();

    // Settings listener (still fine to use real-time for settings)
    const settingsDoc = doc(db, 'settings', 'global');
    const unsubSettings = onSnapshot(settingsDoc, (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as GlobalSettings);
      }
    });

    return () => {
      unsubSettings();
    };
  }, []);

  const handleUpdateCredits = async (userId: string, amount: number) => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/update-credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId, amount })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update credits');
      }
      
      // Refresh user list
      fetchUsers();
    } catch (error: any) {
      console.error('Admin error:', error);
      alert(error.message);
    }
  };

  const handleToggleFreeMode = async () => {
    try {
      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/toggle-free-mode', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle free mode');
      }
    } catch (error: any) {
      console.error('Admin error:', error);
      alert(error.message);
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(search.toLowerCase()) || 
    u.uid.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-zinc-400">Manage users, credits, and system settings.</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-2xl hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx("w-5 h-5 text-zinc-400", refreshing && "animate-spin")} />
          </button>

          <div className="flex items-center space-x-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Settings className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider">Free Mode</p>
                <p className="text-sm font-medium">{settings?.freeMode ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>
            <button 
              onClick={handleToggleFreeMode}
              className="p-2 hover:bg-zinc-800 rounded-xl transition-colors"
            >
              {settings?.freeMode ? (
                <ToggleRight className="w-8 h-8 text-emerald-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-zinc-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Stats */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <Users className="w-6 h-6 text-zinc-500" />
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Users</span>
            </div>
            <p className="text-4xl font-bold">{users.length}</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <Coins className="w-6 h-6 text-zinc-500" />
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Total Credits</span>
            </div>
            <p className="text-4xl font-bold">
              {users.reduce((acc, u) => acc + (u.credits || 0), 0)}
            </p>
          </div>
        </div>

        {/* User Management */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search users by email or UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">User</th>
                  <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest">Credits</th>
                  <th className="p-6 text-xs font-bold text-zinc-500 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                <AnimatePresence mode="popLayout">
                  {filteredUsers.map((user) => (
                    <motion.tr
                      key={user.uid}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="p-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center font-bold text-zinc-400 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-all">
                            {user.email[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium flex items-center space-x-2">
                              <span>{user.email}</span>
                              {user.role === 'admin' && (
                                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                              )}
                            </p>
                            <p className="text-xs text-zinc-500 font-mono">{user.uid}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <span className="bg-zinc-800 px-3 py-1 rounded-full text-sm font-bold text-emerald-500">
                          {user.credits}
                        </span>
                      </td>
                      <td className="p-6 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleUpdateCredits(user.uid, -10)}
                            className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                            title="Remove 10 Credits"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleUpdateCredits(user.uid, 10)}
                            className="p-2 hover:bg-emerald-500/10 hover:text-emerald-500 rounded-lg transition-colors"
                            title="Add 10 Credits"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
            
            {filteredUsers.length === 0 && (
              <div className="p-20 text-center text-zinc-500">
                No users found matching your search.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
