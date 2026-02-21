
import React, { useState, useEffect, useCallback } from 'react';
import { Gallery } from './components/Gallery';
import { LiveInterface } from './components/LiveInterface';
import { MediaAsset, LogMessage } from './types';
import { useGeminiLive } from './hooks/useGeminiLive';
import { virtualServer } from './services/storageService';

// Fix: Correctly define the AIStudio interface and extend Window to match existing global definitions.
// Added '?' to aistudio property in Window interface to resolve modifier mismatch error.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}

function App() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [past, setPast] = useState<MediaAsset[][]>([]);
  const [future, setFuture] = useState<MediaAsset[][]>([]);
  const [logs, setLogs] = useState<LogMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'gallery' | 'assistant'>('gallery');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isKeySelected, setIsKeySelected] = useState<boolean | null>(null);
  
  const apiKey = process.env.API_KEY || ''; 

  // Check GCP Key Status on Mount
  useEffect(() => {
    const checkKey = async () => {
      try {
        if (window.aistudio) {
          const hasKey = await window.aistudio.hasSelectedApiKey();
          setIsKeySelected(hasKey);
        } else {
          setIsKeySelected(!!apiKey);
        }
      } catch (e) {
        console.error("Key check failed", e);
        setIsKeySelected(false);
      }
    };
    checkKey();
  }, [apiKey]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setIsKeySelected(true); 
      } catch (e) {
        console.error("Key selection failed", e);
      }
    }
  };

  useEffect(() => {
    const loadFromStore = async () => {
      try {
        const stored = await virtualServer.getAllAssets();
        const mapped = stored.map(s => ({
          ...s,
          file: s.data,
          previewUrl: URL.createObjectURL(s.data)
        }));
        setAssets(mapped);
      } catch (e) {
        console.error("Failed to load from virtual server", e);
      }
    };
    loadFromStore();
  }, []);

  const recordHistory = useCallback((newState: MediaAsset[]) => {
    setPast(prev => [...prev, assets]);
    setFuture([]);
    setAssets(newState);
  }, [assets]);

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setFuture(prev => [assets, ...prev]);
    setAssets(previous);
    setPast(past.slice(0, past.length - 1));
  }, [past, assets]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setPast(prev => [...prev, assets]);
    setAssets(next);
    setFuture(future.slice(1));
  }, [future, assets]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleTranscript = useCallback((text: string, sender: 'user' | 'model') => {
    setLogs(prev => [...prev, { timestamp: new Date(), sender, text }]);
  }, []);

  const { isConnected, isSpeaking, volume, connect, disconnect } = useGeminiLive({
    apiKey,
    systemInstruction: `Anda adalah 'VibeCut Pro Director', editor ahli dengan rasa estetika tinggi. 
    Anda bekerja dalam ekosistem Google Cloud gratis (0 rupiah).
    
    Tugas: 
    1. Membantu tim menyusun video mentah menjadi cerita sinematik yang 'mengalir' (flow).
    2. MEMBERIKAN REKOMENDASI MUSIK: Jika ditanya, gunakan pengetahuan Anda tentang musik yang sedang tren di Instagram Reels, TikTok, atau WhatsApp Status tahun 2024/2025.
    3. STRATEGI FLOW: Gunakan teknik 'Match Cut' (menyambung aksi serupa), 'Speed Ramps' (cepat-lambat), dan 'J-cuts/L-cuts' untuk membuat video tim outing terasa hangat dan profesional.
    4. TEAM ATMOSPHERE: Fokus pada ekspresi bahagia tim, momen bonding, dan interaksi natural. 
    
    Berikan instruksi urutan footage yang konkret (misal: "Mulai dengan footage kedatangan, lalu potong cepat ke momen makan-makan").
    
    Gunakan Bahasa Indonesia yang elegan, profesional, dan inspiratif.`,
    onTranscript: handleTranscript
  });

  const handleAddAssets = async (files: FileList) => {
    setIsSyncing(true);
    const newAssetsToRecord: MediaAsset[] = [...assets];
    for (const file of Array.from(files)) {
      const id = Math.random().toString(36).substr(2, 9);
      await virtualServer.saveAsset({ id, name: file.name, type: file.type, data: file });
      newAssetsToRecord.push({
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'video' : 'image',
        name: file.name
      });
    }
    recordHistory(newAssetsToRecord);
    setIsSyncing(false);
  };

  const handleRemoveAsset = async (id: string) => {
    recordHistory(assets.filter(a => a.id !== id));
    await virtualServer.deleteAsset(id);
  };

  const handleReorderAssets = (startIndex: number, endIndex: number) => {
    const result = Array.from(assets);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    recordHistory(result);
  };

  if (isKeySelected === null) {
    return (
      <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Checking GCP Auth...</p>
      </div>
    );
  }

  if (!isKeySelected) {
    return (
      <div className="h-[100dvh] w-screen bg-zinc-950 flex items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-10 rounded-[3rem] text-center shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-rose-500 to-emerald-500"></div>
           <div className="w-20 h-20 bg-indigo-600/20 rounded-3xl flex items-center justify-center mx-auto mb-8 text-indigo-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><path d="M7 21h10"></path><path d="M12 21v-4"></path><path d="M7 3h10"></path><path d="M12 3v4"></path></svg>
           </div>
           <h1 className="text-3xl font-black text-white mb-4 tracking-tighter italic">VibeCut Pro</h1>
           <p className="text-zinc-400 text-sm leading-relaxed mb-8 font-medium">Aktifkan <b>Google Cloud Project</b> Anda untuk akses ke <b>Veo Video Gen</b> dan <b>Gemini 3 Pro</b>.</p>
           
           <button 
             onClick={handleSelectKey}
             className="w-full py-5 bg-white text-black font-black text-[11px] uppercase tracking-[0.2em] rounded-2xl hover:scale-[1.02] transition-all shadow-xl mb-6 active:scale-95"
           >
             CONNECT GOOGLE CLOUD
           </button>
           
           <a 
             href="https://ai.google.dev/gemini-api/docs/billing" 
             target="_blank" 
             rel="noreferrer"
             className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest hover:text-white transition-colors block"
           >
             DOKUMENTASI BILLING GCP
           </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] w-screen bg-zinc-950 text-white overflow-hidden font-sans flex-col md:flex-row">
      {isSyncing && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-indigo-600 px-5 py-2.5 rounded-full shadow-2xl flex items-center gap-3 animate-pulse border border-indigo-400/30">
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span className="text-[10px] font-black uppercase tracking-widest">GCP Syncing</span>
        </div>
      )}

      {/* Desktop Navigation */}
      <div className="hidden md:flex w-24 flex-col items-center py-10 border-r border-zinc-900 bg-zinc-950 shrink-0">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 via-purple-500 to-rose-500 rounded-2xl flex items-center justify-center mb-12 shadow-2xl shadow-indigo-500/20 group relative cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-white"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
            <div className="absolute left-full ml-4 px-3 py-1 bg-white text-black text-[9px] font-black uppercase tracking-widest rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">VibeCut Pro v2.5</div>
        </div>
        <div className="space-y-10">
            <button 
              onClick={() => setActiveTab('gallery')} 
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${activeTab === 'gallery' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/40' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900'}`}
              title="Footage Gallery"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            </button>
            <button 
              onClick={() => setActiveTab('assistant')} 
              className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all relative ${activeTab === 'assistant' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/40' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900'}`}
              title="AI Assistant"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
               {isConnected && <div className="absolute top-0 right-0 w-3 h-3 bg-rose-500 rounded-full border-4 border-zinc-950"></div>}
            </button>
        </div>
      </div>

      <div className="flex-1 flex h-full overflow-hidden relative">
        <div className={`absolute inset-0 transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${activeTab === 'gallery' ? 'translate-x-0 opacity-100 z-20' : '-translate-x-12 opacity-0 z-10 pointer-events-none md:translate-x-0 md:opacity-100 md:pointer-events-auto'}`}>
            <Gallery 
              assets={assets} 
              onAddAssets={handleAddAssets} 
              onRemoveAsset={handleRemoveAsset}
              onReorderAssets={handleReorderAssets}
              onUndo={handleUndo}
              onRedo={handleRedo}
              canUndo={past.length > 0}
              canRedo={future.length > 0}
            />
        </div>
        <div className={`absolute inset-0 md:relative md:translate-x-0 md:w-[480px] md:border-l border-zinc-900 transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${activeTab === 'assistant' ? 'translate-x-0 opacity-100 z-30' : 'translate-x-12 opacity-0 z-10 pointer-events-none md:translate-x-0 md:opacity-100 md:pointer-events-auto'}`}>
            <LiveInterface 
              logs={logs} 
              isConnected={isConnected} 
              isSpeaking={isSpeaking} 
              volume={volume} 
              connect={connect} 
              disconnect={disconnect} 
            />
        </div>
      </div>

      {/* Mobile Navigation Footer */}
      <div className="md:hidden h-24 border-t border-zinc-900 bg-zinc-950/95 backdrop-blur-3xl flex items-center px-6 shrink-0 z-[100] pb-safe">
        <button 
          onClick={() => setActiveTab('gallery')} 
          className={`flex-1 flex flex-col items-center gap-2 transition-all ${activeTab === 'gallery' ? 'text-indigo-400' : 'text-zinc-600'}`}
        >
            <div className={`p-2 rounded-xl ${activeTab === 'gallery' ? 'bg-indigo-500/10' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Timeline</span>
        </button>
        
        <div className="flex-1 flex justify-center">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center -translate-y-8 border-8 border-zinc-950 transition-all duration-500 ${isConnected ? 'bg-rose-600 shadow-[0_0_25px_rgba(225,29,72,0.4)]' : 'bg-zinc-800 shadow-xl'}`}>
              <div className={`w-4 h-4 rounded-full ${isConnected ? 'bg-white animate-pulse' : 'bg-zinc-600'}`}></div>
          </div>
        </div>

        <button 
          onClick={() => setActiveTab('assistant')} 
          className={`flex-1 flex flex-col items-center gap-2 transition-all ${activeTab === 'assistant' ? 'text-indigo-400' : 'text-zinc-600'}`}
        >
            <div className={`p-2 rounded-xl ${activeTab === 'assistant' ? 'bg-indigo-500/10' : ''}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Director</span>
        </button>
      </div>
    </div>
  );
}

export default App;
