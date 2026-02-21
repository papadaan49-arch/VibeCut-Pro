
import React, { useState, useEffect } from 'react';
import { ExportSettings, MediaAsset } from '../types';
import { GoogleGenAI } from '@google/genai';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  assets?: MediaAsset[];
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, assets = [] }) => {
  const [resolution, setResolution] = useState<ExportSettings['resolution']>('1080p');
  const [format, setFormat] = useState<ExportSettings['format']>('mp4');
  const [status, setStatus] = useState<'idle' | 'exporting' | 'completed'>('idle');
  const [progress, setProgress] = useState(0);
  const [currentAction, setCurrentAction] = useState('Initializing...');
  const [useAIIntro, setUseAIIntro] = useState(false);
  const [aiIntroUrl, setAiIntroUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStatus('idle');
      setProgress(0);
      setAiIntroUrl(null);
    }
  }, [isOpen]);

  const generateVeoIntro = async () => {
    setCurrentAction('Summoning Veo AI for Cinematic Intro...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: 'A professional cinematic video intro for a corporate team outing, golden hour, high-end motion graphics, smooth camera glide, professional 4k quality.',
        config: {
          numberOfVideos: 1,
          resolution: '1080p',
          aspectRatio: '16:9'
        }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
        // Simulating progress while waiting for long operation
        setProgress(prev => Math.min(prev + 5, 95));
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const blob = await response.blob();
        setAiIntroUrl(URL.createObjectURL(blob));
      }
    } catch (e) {
      console.error("Veo Generation Failed", e);
      // Fallback to simulation if Veo is unavailable
    }
  };

  const handleExport = async () => {
    setStatus('exporting');
    setProgress(0);
    
    if (useAIIntro) {
      await generateVeoIntro();
    }

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + 5;
        if (next < 30) setCurrentAction('Analyzing Footage Content...');
        else if (next < 60) setCurrentAction('Applying AI Pacing & Cuts...');
        else if (next < 90) setCurrentAction('Finalizing Render...');
        
        if (next >= 100) {
          clearInterval(interval);
          setStatus('completed');
          return 100;
        }
        return next;
      });
    }, 150);
  };

  const triggerDownload = () => {
    const projectData = {
      project_name: "VibeCut Pro Project",
      tier: "Google Cloud Enterprise",
      ai_intro_included: useAIIntro,
      assets: assets.map(a => ({ id: a.id, name: a.name, suggestion: "Pro Tier Optimized" }))
    };

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `vibecut_pro_${new Date().getTime()}.json`;
    link.click();
    document.body.removeChild(link);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/95 backdrop-blur-2xl p-0 sm:p-4">
      <div className="bg-zinc-900 border-t sm:border border-zinc-800 w-full max-w-lg rounded-t-[2.5rem] sm:rounded-3xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-500">
        
        <div className="px-8 py-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
          <div>
            <h3 className="text-xl font-black text-white tracking-tighter italic">EXPORT PRO</h3>
            <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-1">Tier: Google Cloud Paid</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="p-8">
          {status === 'idle' && (
            <div className="space-y-8">
              <div 
                onClick={() => setUseAIIntro(!useAIIntro)}
                className={`p-5 rounded-2xl border-2 cursor-pointer transition-all flex items-center gap-4 ${useAIIntro ? 'border-indigo-500 bg-indigo-500/10' : 'border-zinc-800 bg-zinc-900'}`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${useAIIntro ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-white uppercase tracking-wider">Generate AI Intro (Veo 3.1)</p>
                  <p className="text-[10px] text-zinc-500 font-medium">Buat video pembuka sinematik otomatis</p>
                </div>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${useAIIntro ? 'border-indigo-500' : 'border-zinc-700'}`}>
                   {useAIIntro && <div className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse"></div>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 opacity-50">
                  <div className="p-4 bg-zinc-800 rounded-2xl border border-zinc-700">
                    <p className="text-[10px] text-zinc-500 font-bold mb-1">QUALITY</p>
                    <p className="text-white font-black">{resolution}</p>
                  </div>
                  <div className="p-4 bg-zinc-800 rounded-2xl border border-zinc-700">
                    <p className="text-[10px] text-zinc-500 font-bold mb-1">FORMAT</p>
                    <p className="text-white font-black">{format.toUpperCase()}</p>
                  </div>
              </div>

              <button onClick={handleExport} className="w-full h-16 bg-white text-black font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-2xl active:scale-95 transition-transform flex items-center justify-center gap-3">
                START PRO RENDER
              </button>
            </div>
          )}

          {status === 'exporting' && (
            <div className="py-8 flex flex-col items-center text-center space-y-8">
              <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <div className="space-y-2">
                <h4 className="text-white font-black text-lg italic tracking-tighter animate-pulse">{currentAction}</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Powered by Google Cloud Project</p>
              </div>
            </div>
          )}

          {status === 'completed' && (
            <div className="py-8 flex flex-col items-center text-center space-y-8">
               <div className="w-20 h-20 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl shadow-indigo-600/30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>
               </div>
               <div className="space-y-2">
                <h4 className="text-white font-black text-2xl uppercase tracking-tighter italic">READY!</h4>
                <p className="text-xs text-zinc-400 px-6">Pro Bundle telah disinkronkan dengan project GCP Anda.</p>
              </div>
              
              {aiIntroUrl && (
                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-zinc-800 shadow-inner group relative">
                   <video src={aiIntroUrl} controls className="w-full h-full object-cover" />
                   <div className="absolute top-2 left-2 px-2 py-1 bg-indigo-600 rounded text-[8px] font-black text-white uppercase tracking-widest">AI Intro Generated</div>
                </div>
              )}

              <button onClick={triggerDownload} className="w-full h-16 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-600/30">
                UNDUH PRO BUNDLE
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
