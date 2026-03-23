import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { GoogleGenAI, Modality } from "@google/genai";
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  Loader2, 
  Play, 
  BookOpen, 
  Music, 
  ChevronRight, 
  Star, 
  Heart, 
  Cloud, 
  Sun,
  Volume2,
  Type
} from 'lucide-react';
import { clsx } from 'clsx';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { StoryTemplate, VideoStatus } from '../types';

const TEMPLATES: StoryTemplate[] = [
  {
    id: 'prophet-kindness',
    title: "The Prophet's Kindness",
    description: "A beautiful story about the Prophet (PBUH) and a thirsty camel in the desert.",
    basePrompt: "A colorful 3D cartoon animation of a kind man with a gentle face (no features shown) giving water to a thirsty camel in a bright, sunny desert with palm trees. Vibrant colors, Disney-style animation.",
    icon: 'Heart',
    color: 'bg-rose-400'
  },
  {
    id: 'brave-lion',
    title: "The Brave Lion",
    description: "A story of courage and faith featuring the Brave Lion of Allah.",
    basePrompt: "A bright cartoon animation of a brave warrior with a lion's heart, standing on a hill under a starry sky. Epic but friendly cartoon style, glowing stars, deep blues and golds.",
    icon: 'Star',
    color: 'bg-amber-400'
  },
  {
    id: 'honest-merchant',
    title: "The Honest Merchant",
    description: "Learn about honesty from the story of a merchant who always told the truth.",
    basePrompt: "A cheerful cartoon of a busy marketplace with a merchant selling colorful silks. Bright sunlight, happy people, vibrant marketplace atmosphere, clean lines.",
    icon: 'Cloud',
    color: 'bg-sky-400'
  },
  {
    id: 'helpful-neighbor',
    title: "The Helpful Neighbor",
    description: "A heartwarming story about helping those who live right next door.",
    basePrompt: "A cozy cartoon neighborhood with two friendly houses. A child is bringing a basket of fruit to an elderly neighbor. Warm, soft colors, friendly characters.",
    icon: 'Sun',
    color: 'bg-emerald-400'
  }
];

export default function KidsStory() {
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<'select' | 'generate'>('select');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    const user = auth.currentUser;
    if (!user) return;

    // Check for API Key selection (required for Veo)
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      const hasKey = await (window as any).aistudio.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio.openSelectKey();
        // After opening, we assume success or the user will try again
        // We don't block here because of the race condition mentioned in guidelines
      }
    }

    setGenerating(true);
    setProgress(0);
    setError(null);

    try {
      const idToken = await user.getIdToken();
      
      // 1. Create the record in our backend and check credits
      const apiResponse = await fetch('/api/generate-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ 
          prompt: selectedTemplate.basePrompt,
          isKidsStory: true,
          templateId: selectedTemplate.id
        })
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || 'Failed to initiate story generation');
      }

      const { id: videoId } = await apiResponse.json();

      // 2. Initialize Gemini (Create new instance right before call for fresh API key)
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // 3. Generate Audio (TTS) - Using the friendly narrator voice
      const ttsResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Assalamu Alaikum children! Today we are going to hear a story called ${selectedTemplate.title}. ${selectedTemplate.description}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      let audioUrl = '';
      if (base64Audio) {
        audioUrl = `data:audio/mpeg;base64,${base64Audio}`;
      }

      // 4. Generate Video using Veo
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: selectedTemplate.basePrompt,
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
        
        try {
          operation = await ai.operations.getVideosOperation({ operation: operation });
        } catch (pollError: any) {
          // If "Requested entity was not found", it might be an API key issue
          if (pollError.message?.includes('Requested entity was not found')) {
            if ((window as any).aistudio) await (window as any).aistudio.openSelectKey();
            throw new Error('API Key issue. Please select a valid paid API key and try again.');
          }
          throw pollError;
        }
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      
      if (downloadLink) {
        setProgress(100);
        // 5. Update Firestore record with results
        await updateDoc(doc(db, 'videos', videoId), {
          status: 'completed' as VideoStatus,
          downloadUrl: downloadLink,
          audioUrl: audioUrl
        });
        navigate('/');
      } else {
        throw new Error('Failed to generate video URL');
      }
    } catch (err: any) {
      console.error('Story generation error:', err);
      setError(err.message || 'Oops! Something went wrong in the magic story room.');
    } finally {
      setGenerating(false);
    }
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Heart': return <Heart className="w-8 h-8" />;
      case 'Star': return <Star className="w-8 h-8" />;
      case 'Cloud': return <Cloud className="w-8 h-8" />;
      case 'Sun': return <Sun className="w-8 h-8" />;
      default: return <BookOpen className="w-8 h-8" />;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8">
      <header className="text-center space-y-4">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="inline-flex items-center space-x-3 bg-amber-100 text-amber-600 px-6 py-2 rounded-full text-lg font-bold border-4 border-amber-200 shadow-lg"
        >
          <Sparkles className="w-6 h-6 animate-pulse" />
          <span>Noor Magic Stories</span>
        </motion.div>
        <h1 className="text-6xl font-black tracking-tight text-zinc-900 drop-shadow-sm">
          Create Your Own <span className="text-emerald-500 underline decoration-wavy decoration-emerald-200">Magic Story</span>
        </h1>
        <p className="text-zinc-500 text-xl font-medium max-w-2xl mx-auto">
          Pick a story below and watch it come to life with magic animation and voices!
        </p>
      </header>

      <AnimatePresence mode="wait">
        {step === 'select' ? (
          <motion.div
            key="select"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8"
          >
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => {
                  setSelectedTemplate(template);
                  setStep('generate');
                }}
                className="group relative bg-white border-4 border-zinc-100 rounded-[40px] p-8 text-left hover:border-emerald-400 hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 overflow-hidden"
              >
                <div className={clsx(
                  "w-20 h-20 rounded-3xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform shadow-lg",
                  template.color
                )}>
                  {getIcon(template.icon)}
                </div>
                <div className="space-y-3">
                  <h3 className="text-3xl font-black text-zinc-900">{template.title}</h3>
                  <p className="text-zinc-500 text-lg leading-relaxed">{template.description}</p>
                </div>
                <div className="mt-8 flex items-center text-emerald-500 font-bold text-lg group-hover:translate-x-2 transition-transform">
                  <span>Start Magic</span>
                  <ChevronRight className="w-6 h-6 ml-1" />
                </div>
                
                {/* Decorative blobs */}
                <div className={clsx(
                  "absolute -right-12 -bottom-12 w-40 h-40 rounded-full opacity-5 group-hover:opacity-10 transition-opacity",
                  template.color
                )} />
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="generate"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto"
          >
            <div className="bg-white border-4 border-zinc-100 rounded-[50px] p-12 shadow-2xl relative overflow-hidden">
              <button 
                onClick={() => setStep('select')}
                className="absolute top-8 left-8 text-zinc-400 hover:text-zinc-900 font-bold flex items-center space-x-2 transition-colors"
                disabled={generating}
              >
                <ChevronRight className="w-5 h-5 rotate-180" />
                <span>Go Back</span>
              </button>

              <div className="text-center space-y-8 pt-8">
                <div className={clsx(
                  "w-32 h-32 rounded-[40px] flex items-center justify-center text-white mx-auto shadow-2xl",
                  selectedTemplate?.color
                )}>
                  {selectedTemplate && getIcon(selectedTemplate.icon)}
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-4xl font-black text-zinc-900">{selectedTemplate?.title}</h2>
                  <p className="text-zinc-500 text-xl">{selectedTemplate?.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-50 p-6 rounded-3xl border-2 border-zinc-100 flex flex-col items-center space-y-3">
                    <div className="p-3 bg-rose-100 rounded-2xl text-rose-500">
                      <Volume2 className="w-8 h-8" />
                    </div>
                    <span className="font-bold text-zinc-700">Magic Voice</span>
                  </div>
                  <div className="bg-zinc-50 p-6 rounded-3xl border-2 border-zinc-100 flex flex-col items-center space-y-3">
                    <div className="p-3 bg-sky-100 rounded-2xl text-sky-500">
                      <Type className="w-8 h-8" />
                    </div>
                    <span className="font-bold text-zinc-700">Subtitles</span>
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 text-red-500 p-6 rounded-3xl border-2 border-red-100 flex items-center space-x-4">
                    <AlertCircle className="w-8 h-8 shrink-0" />
                    <p className="font-bold text-left">{error}</p>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className={clsx(
                    "w-full py-8 rounded-[35px] text-2xl font-black flex items-center justify-center space-x-4 transition-all shadow-xl active:scale-95 relative overflow-hidden",
                    generating 
                      ? "bg-zinc-100 text-zinc-400 cursor-not-allowed" 
                      : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/30"
                  )}
                >
                  {generating && (
                    <motion.div 
                      className="absolute inset-0 bg-emerald-500/10 origin-left"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: progress / 100 }}
                      transition={{ duration: 0.5 }}
                    />
                  )}
                  <div className="relative z-10 flex items-center space-x-4">
                    {generating ? (
                      <>
                        <Loader2 className="w-10 h-10 animate-spin" />
                        <span>Mixing Magic ({progress}%)</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-10 h-10 fill-current" />
                        <span>Create My Story!</span>
                      </>
                    )}
                  </div>
                </button>
                
                <p className="text-zinc-400 font-medium">
                  This will take about 1 minute. Stay here to see the magic!
                </p>
              </div>

              {/* Decorative background elements */}
              <div className="absolute top-0 right-0 p-12 opacity-10 pointer-events-none">
                <Sparkles className="w-32 h-32 text-emerald-500" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AlertCircle(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
