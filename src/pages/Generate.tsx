import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { GoogleGenAI } from "@google/genai";
import { motion } from 'framer-motion';
import { Send, Loader2, Sparkles, AlertCircle, Info, Zap, Video as VideoIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { doc, updateDoc } from 'firebase/firestore';
import { VideoStatus } from '../types';

export default function Generate() {
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<'cloud' | 'local'>('cloud');
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGenerate = async (e: any) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user || !prompt.trim()) return;

    setGenerating(true);
    setProgress(0);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      
      if (model === 'local') {
        // --- Local Model Logic (Python Bridge) ---
        const response = await fetch('/api/generate-local', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({ prompt })
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Local model worker is offline');
        }
        
        navigate('/');
        return;
      }

      // --- Cloud Model Logic (Gemini Veo) ---
      const apiResponse = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ prompt })
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || 'Failed to initiate generation');
      }

      const { id: videoId } = await apiResponse.json();

      // 2. Call Gemini Video API
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9'
        }
      });

      setProgress(20);

      // Poll for completion
      let pollCount = 0;
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        pollCount++;
        // Simulate progress: 20% -> 90% over ~60 seconds (6 polls)
        const simulatedProgress = Math.min(90, 20 + (pollCount * 12));
        setProgress(simulatedProgress);
        
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (downloadLink) {
        setProgress(100);
        await updateDoc(doc(db, 'videos', videoId), {
          status: 'completed' as VideoStatus,
          downloadUrl: downloadLink
        });
        // Navigate to dashboard to see the result
        navigate('/');
      } else {
        throw new Error('Failed to generate video URL');
      }
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'An error occurred during generation.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-12 space-y-12">
      <div className="text-center space-y-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="inline-flex items-center space-x-2 bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-full text-sm font-medium border border-emerald-500/20"
        >
          <Sparkles className="w-4 h-4" />
          <span>Powered by Gemini Veo</span>
        </motion.div>
        <h1 className="text-5xl font-bold tracking-tight text-white">Transform Text to Video</h1>
        <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
          Enter a detailed description of the scene you want to create. Our AI will generate a high-quality video in seconds.
        </p>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 shadow-2xl backdrop-blur-sm">
        <div className="flex items-center justify-center p-1 bg-zinc-950 rounded-2xl border border-zinc-800 mb-8 max-w-sm mx-auto">
          <button
            onClick={() => setModel('cloud')}
            className={clsx(
              "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
              model === 'cloud' ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Cloud (Gemini)
          </button>
          <button
            onClick={() => setModel('local')}
            className={clsx(
              "flex-1 py-2 rounded-xl text-sm font-bold transition-all",
              model === 'local' ? "bg-emerald-500 text-zinc-950 shadow-lg shadow-emerald-500/20" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Local (AnimateDiff)
          </button>
        </div>

        <form onSubmit={handleGenerate} className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <label className="text-sm font-semibold text-zinc-300">
                {model === 'cloud' ? 'Prompt Description' : 'Local Model Prompt'}
              </label>
              <span className="text-xs text-zinc-500">{prompt.length} / 1000</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="A cinematic drone shot of a lush tropical island with crystal clear water and a hidden waterfall..."
              className="w-full h-48 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all resize-none text-lg text-white placeholder:text-zinc-700"
              disabled={generating}
              maxLength={1000}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
              <div className="p-2 bg-zinc-900 rounded-lg">
                <Zap className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Fast Generation</p>
                <p className="text-xs text-zinc-500">Optimized for speed and quality</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
              <div className="p-2 bg-zinc-900 rounded-lg">
                <VideoIcon className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">720p HD Output</p>
                <p className="text-xs text-zinc-500">Cinematic 16:9 aspect ratio</p>
              </div>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center space-x-3 text-red-400 bg-red-500/10 p-4 rounded-2xl border border-red-500/20"
            >
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={generating || !prompt.trim()}
            className="w-full bg-emerald-500 text-zinc-950 py-5 rounded-2xl font-bold text-lg flex items-center justify-center space-x-3 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-emerald-500/20 group relative overflow-hidden"
          >
            {generating && (
              <motion.div 
                className="absolute inset-0 bg-emerald-400/20 origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: progress / 100 }}
                transition={{ duration: 0.5 }}
              />
            )}
            <div className="relative z-10 flex items-center space-x-3">
              {generating ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span>Generating ({progress}%)</span>
                </>
              ) : (
                <>
                  <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  <span>Generate Video</span>
                </>
              )}
            </div>
          </button>
        </form>

        <div className="mt-8 pt-8 border-t border-zinc-800 flex items-start space-x-3 text-zinc-500">
          <Info className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            Generation typically takes 30-60 seconds. Each generation costs 1 credit. 
            Ensure your prompt is descriptive for the best results. Avoid using prohibited content.
          </p>
        </div>
      </div>
    </div>
  );
}
