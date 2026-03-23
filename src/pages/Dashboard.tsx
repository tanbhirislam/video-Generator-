import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, GlobalSettings, VideoRecord, VideoStatus } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Loader2, Clock, CheckCircle2, XCircle, Video, Search, Filter, ExternalLink, PlusCircle, Sparkles, Volume2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';

interface DashboardProps {
  user: User | null;
  profile: UserProfile | null;
  settings: GlobalSettings | null;
}

export default function Dashboard({ user }: DashboardProps) {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);

  const toggleAudio = (audioUrl: string) => {
    if (playingAudio === audioUrl) {
      setPlayingAudio(null);
    } else {
      setPlayingAudio(audioUrl);
      const audio = new Audio(audioUrl);
      audio.play();
      audio.onended = () => setPlayingAudio(null);
    }
  };

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'videos'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const videoList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as VideoRecord[];
      setVideos(videoList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredVideos = videos.filter(v => 
    v.prompt.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusIcon = (status: VideoStatus) => {
    switch (status) {
      case 'processing': return <Loader2 className="w-5 h-5 animate-spin text-emerald-500" />;
      case 'completed': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      default: return <Clock className="w-5 h-5 text-zinc-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
        <p className="text-zinc-500 font-medium">Loading your library...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-bold tracking-tight text-white">Your Library</h1>
          <p className="text-zinc-400">Manage and view all your AI generated masterpieces.</p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              placeholder="Search prompts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-11 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all w-64 text-sm"
            />
          </div>
          <Link
            to="/kids"
            className="bg-amber-500 text-zinc-950 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Noor Stories</span>
          </Link>
          <Link
            to="/generate"
            className="bg-emerald-500 text-zinc-950 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-emerald-400 transition-all shadow-lg shadow-emerald-500/20"
          >
            Create New
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredVideos.map((video) => (
            <motion.div
              key={video.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={clsx(
                "bg-zinc-900/40 border border-zinc-800/50 rounded-2xl overflow-hidden flex flex-col group hover:border-emerald-500/30 transition-all hover:shadow-2xl hover:shadow-emerald-500/5",
                video.isKidsStory && "border-amber-500/30 hover:border-amber-500/50 shadow-amber-500/5"
              )}
            >
              <div className="aspect-video bg-zinc-950 flex items-center justify-center relative overflow-hidden">
                {video.status === 'completed' && video.downloadUrl ? (
                  <>
                    <video
                      src={video.downloadUrl}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3">
                      <a
                        href={video.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-white text-black rounded-full hover:scale-110 transition-transform"
                        title="Open in new tab"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                      {video.audioUrl && (
                        <button
                          onClick={() => toggleAudio(video.audioUrl!)}
                          className={clsx(
                            "p-3 rounded-full transition-transform hover:scale-110",
                            playingAudio === video.audioUrl ? "bg-emerald-500 text-white" : "bg-white text-black"
                          )}
                          title="Play Story Voice"
                        >
                          <Volume2 className={clsx("w-5 h-5", playingAudio === video.audioUrl && "animate-pulse")} />
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center space-y-3">
                    {getStatusIcon(video.status)}
                    <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">{video.status}</span>
                  </div>
                )}
                
                <div className="absolute top-3 right-3 flex space-x-2">
                  {video.isKidsStory && (
                    <div className="bg-amber-500 text-zinc-950 text-[10px] font-black px-2 py-1 rounded-lg flex items-center space-x-1 shadow-lg">
                      <Sparkles className="w-3 h-3" />
                      <span>NOOR STORY</span>
                    </div>
                  )}
                  <div className="bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10">
                    {getStatusIcon(video.status)}
                  </div>
                </div>
              </div>
              
              <div className="p-5 space-y-4 flex-1 flex flex-col">
                <p className="text-sm text-zinc-300 line-clamp-2 flex-1 font-medium leading-relaxed">
                  {video.prompt}
                </p>
                
                <div className="flex items-center justify-between pt-4 border-t border-zinc-800/50">
                  <div className="flex items-center space-x-2 text-[10px] font-bold text-zinc-500 uppercase tracking-tighter">
                    <Clock className="w-3 h-3" />
                    <span>{formatDistanceToNow(new Date(video.createdAt))} ago</span>
                  </div>
                  
                  {video.status === 'completed' && video.downloadUrl && (
                    <a
                      href={video.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center space-x-1.5 text-xs font-bold text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredVideos.length === 0 && (
          <div className="col-span-full py-32 text-center space-y-6 bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-800/50">
            <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <Video className="w-10 h-10 text-zinc-700" />
            </div>
            <div className="space-y-2">
              <p className="text-xl font-bold text-zinc-300">No videos found</p>
              <p className="text-zinc-500 max-w-xs mx-auto">
                {search ? "Try adjusting your search terms." : "Start by generating your first AI video masterpiece."}
              </p>
            </div>
            {!search && (
              <Link
                to="/generate"
                className="inline-flex items-center space-x-2 bg-zinc-800 text-white px-6 py-3 rounded-xl font-bold hover:bg-zinc-700 transition-all"
              >
                <PlusCircle className="w-5 h-5" />
                <span>Create First Video</span>
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
