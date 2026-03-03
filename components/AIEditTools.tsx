import React, { useState } from 'react';
import { MediaAsset, AIEditSuggestion } from '../types';
import { detectScenes, generateAutoCut, generateVeoVideo } from '../services/aiEditingService';

interface AIEditToolsProps {
  assets: MediaAsset[];
  onApplyEdit: (suggestion: AIEditSuggestion) => void;
  onAddAsset: (asset: MediaAsset) => void;
  onClose: () => void;
}

export const AIEditTools: React.FC<AIEditToolsProps> = ({ assets, onApplyEdit, onAddAsset, onClose }) => {
  const [activeTab, setActiveTab] = useState<'scene' | 'autocut' | 'veo'>('scene');
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState('');
  const [suggestions, setSuggestions] = useState<AIEditSuggestion[]>([]);
  const [veoPrompt, setVeoPrompt] = useState('');
  const [vibe, setVibe] = useState('');

  const handleSceneDetect = async () => {
    if (assets.length === 0) return;
    setIsProcessing(true);
    setStatus('Analyzing video frames with Gemini 3 Pro...');
    
    // Analyze the first video asset for demo purposes
    const videoAsset = assets.find(a => a.type === 'video');
    if (!videoAsset) {
      setStatus('No video assets found.');
      setIsProcessing(false);
      return;
    }

    const results = await detectScenes(videoAsset);
    setSuggestions(results);
    setIsProcessing(false);
    setStatus('');
  };

  const handleAutoCut = async () => {
    if (assets.length === 0) return;
    setIsProcessing(true);
    setStatus('Gemini is crafting your edit decision list...');
    
    const results = await generateAutoCut(assets, vibe || 'Cinematic and fast-paced');
    setSuggestions(results);
    setIsProcessing(false);
    setStatus('');
  };

  const handleVeoGenerate = async () => {
    if (!veoPrompt) return;
    setIsProcessing(true);
    setStatus('Initializing Veo 3.1...');

    const videoUrl = await generateVeoVideo(veoPrompt, (msg) => setStatus(msg));
    
    if (videoUrl) {
      const newAsset: MediaAsset = {
        id: `veo-${Date.now()}`,
        name: `Veo: ${veoPrompt.slice(0, 20)}...`,
        type: 'video',
        file: new File([], 'veo-generated.mp4', { type: 'video/mp4' }), // Placeholder file object
        previewUrl: videoUrl
      };
      onAddAsset(newAsset);
      setStatus('Video generated and added to gallery!');
    } else {
      setStatus('Generation failed.');
    }
    setIsProcessing(false);
  };

  return (
    <div className="absolute inset-0 z-[70] bg-zinc-950/95 backdrop-blur-3xl animate-in fade-in slide-in-from-bottom-10 duration-500 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/50">
        <div>
          <h2 className="text-xl font-black text-white italic tracking-tighter flex items-center gap-3">
            <span className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>
            AI DIRECTOR SUITE
          </h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
            Powered by Gemini 3 Pro & Veo 3.1
          </p>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white transition-colors border border-zinc-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-900">
        <button 
          onClick={() => setActiveTab('scene')}
          className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'scene' ? 'bg-indigo-600/10 text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-600 hover:text-zinc-400'}`}
        >
          Scene Detect
        </button>
        <button 
          onClick={() => setActiveTab('autocut')}
          className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'autocut' ? 'bg-indigo-600/10 text-indigo-400 border-b-2 border-indigo-500' : 'text-zinc-600 hover:text-zinc-400'}`}
        >
          Auto Cut
        </button>
        <button 
          onClick={() => setActiveTab('veo')}
          className={`flex-1 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'veo' ? 'bg-emerald-600/10 text-emerald-400 border-b-2 border-emerald-500' : 'text-zinc-600 hover:text-zinc-400'}`}
        >
          Veo Gen (B-Roll)
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'scene' && (
          <div className="space-y-6 max-w-2xl mx-auto">
            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white">Smart Scene Analysis</h3>
              <p className="text-xs text-zinc-500">Gemini 3 Pro will analyze your footage frame-by-frame to identify key moments.</p>
            </div>
            
            <div className="flex justify-center">
              <button 
                onClick={handleSceneDetect}
                disabled={isProcessing}
                className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center gap-3"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20"></path><path d="M2 12l5 5"></path><path d="M2 12l5-5"></path></svg>
                    Start Analysis
                  </>
                )}
              </button>
            </div>

            {status && <p className="text-center text-xs text-indigo-400 font-mono animate-pulse">{status}</p>}

            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl flex justify-between items-center animate-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                  <div>
                    <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">SCENE {i + 1}</span>
                    <p className="text-sm text-zinc-300 font-medium">{s.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-mono text-zinc-600">CONFIDENCE</span>
                    <p className="text-xs font-bold text-white">{(s.confidence * 100).toFixed(0)}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'autocut' && (
          <div className="space-y-6 max-w-2xl mx-auto">
             <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white">Magic Auto-Cut</h3>
              <p className="text-xs text-zinc-500">Describe the vibe, and Gemini will generate an Edit Decision List (EDL) for you.</p>
            </div>

            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="e.g. 'High energy sports montage with fast cuts'"
                value={vibe}
                onChange={(e) => setVibe(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all"
              />
              
              <button 
                onClick={handleAutoCut}
                disabled={isProcessing || !vibe}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl transition-all"
              >
                {isProcessing ? 'Generating EDL...' : 'Generate Cut'}
              </button>
            </div>

            {status && <p className="text-center text-xs text-indigo-400 font-mono animate-pulse">{status}</p>}

            <div className="space-y-2">
              {suggestions.map((s, i) => (
                <div key={i} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-start gap-4 animate-in slide-in-from-bottom-2 duration-300">
                  <div className="w-6 h-6 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 text-xs font-bold shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm text-zinc-300">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'veo' && (
          <div className="space-y-6 max-w-2xl mx-auto">
             <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-white">Veo Generative Video</h3>
              <p className="text-xs text-zinc-500">Generate high-quality B-Roll footage using Veo 3.1.</p>
            </div>

            <div className="space-y-4">
              <textarea 
                placeholder="Describe the video you want to generate (e.g. 'A cinematic drone shot of a futuristic city at sunset, cyberpunk style')..."
                value={veoPrompt}
                onChange={(e) => setVeoPrompt(e.target.value)}
                className="w-full h-32 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:border-emerald-500 transition-all resize-none"
              />
              
              <button 
                onClick={handleVeoGenerate}
                disabled={isProcessing || !veoPrompt}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-3"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Generating with Veo...
                  </>
                ) : (
                  'Generate Video'
                )}
              </button>
            </div>

            {status && (
              <div className="p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-xl text-center">
                <p className="text-xs text-emerald-400 font-mono animate-pulse">{status}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
