import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, GlobalSettings } from './types';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import Generate from './pages/Generate';
import KidsStory from './pages/KidsStory';
import Login from './pages/Login';
import Signup from './pages/Signup';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Fetch or create profile
        const userDoc = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userDoc);
        
        if (userSnap.exists()) {
          setProfile(userSnap.data() as UserProfile);
        } else {
          // Create default profile
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            role: 'user',
            credits: 5 // Initial free credits
          };
          await setDoc(userDoc, newProfile);
          setProfile(newProfile);
        }

        // Real-time profile updates
        const unsubProfile = onSnapshot(userDoc, (doc) => {
          if (doc.exists()) {
            setProfile(doc.data() as UserProfile);
          }
        });

        return () => unsubProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    // Global settings listener
    const settingsDoc = doc(db, 'settings', 'global');
    const unsubSettings = onSnapshot(settingsDoc, (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as GlobalSettings);
      } else {
        // Initialize settings if not exists
        setDoc(settingsDoc, { freeMode: false });
      }
    });

    return () => {
      unsubscribeAuth();
      unsubSettings();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/signup" element={!user ? <Signup /> : <Navigate to="/" />} />
        
        <Route element={<ProtectedRoute user={user} />}>
          <Route element={<Layout user={user} profile={profile} />}>
            <Route path="/" element={<Dashboard user={user} profile={profile} settings={settings} />} />
            <Route path="/generate" element={<Generate />} />
            <Route path="/kids" element={<KidsStory />} />
            <Route element={<AdminRoute profile={profile} />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
