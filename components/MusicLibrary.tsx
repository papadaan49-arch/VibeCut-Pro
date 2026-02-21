
import React, { useState } from 'react';
import { MusicTrack } from '../types';
import { GoogleGenAI } from '@google/genai';

interface MusicLibraryProps {
  onSelect: (track: MusicTrack) => void;
  onClose: () => void;
}

const MOCK_TRENDING: MusicTrack[] = [
  { id: '1', title: 'Better Together', artist: 'Jack Johnson', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', thumbnail: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop', duration: 208 },
  { id: '2', title: 'Summer Vibe', artist: 'Tropical House', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', thumbnail: 'https://images.unsplash.com/photo-1526218626217-dc65a29bb444?w=100&h=100&fit=crop', duration: 185 },
  { id: '3', title: 'Work Hard Play Hard', artist: 'Wiz Khalifa', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', thumbnail: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=100&h=100&fit=crop', duration: 230 },
  { id: '4', title: 'Team Spirit', artist: 'Victory Collective', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', thumbnail: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=100&h=100&fit=crop', duration: 195 },
];

export const MusicLibrary: React.FC<MusicLibraryProps> = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'trending' | 'discovery' | 'recent'>('trending');
  const [aiResults, setAiResults] = useState<MusicTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleAISearch = async () => {
    if (!search.trim()) return;
    
    setIsSearching(true);
    setActiveTab('discovery');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Cari 5 lagu yang sedang viral di Instagram Reels, TikTok, atau WhatsApp Status yang cocok dengan vibe: "${search}". Berikan dalam format JSON array: [{"title": "Judul", "artist": "Penyanyi", "vibe": "Alasan cocok"}]. Hanya JSON.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        },
      });

      const rawJson = response.text.trim();
      const parsed = JSON.parse(rawJson);
      
      const tracks: MusicTrack[] = parsed.map((item: any, idx: number) => ({
        id: `ai-${idx}`,
        title: item.title,
        artist: item.artist,
        // Fallback audio for simulation since we can't extract MP3 directly from random links easily in frontend
        url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(idx % 15) + 1}.mp3`,
        thumbnail: `https://images.unsplash.com/photo-${1500000000000 + idx}?w=100&h=100&fit=crop`,
        duration: 180,
        description: item.vibe
      }));

      setAiResults(tracks);
    } catch (e) {
      console.error("AI Music Discovery failed", e);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="absolute inset-0 z-[60] bg-zinc-950/95 backdrop-blur-3xl animate-in fade-in zoom-in duration-300 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/50">
        <div>
          <h2 className="text-xl font-black text-white italic tracking-tighter">MUSIC DISCOVERY</h2>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Online Trends via Google Search Grounding
          </p>
        </div>
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center text-zinc-400 hover:text-white transition-colors border border-zinc-800">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      {/* Search Input */}
      <div className="p-6 space-y-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-zinc-500 group-focus-within:text-indigo-400 transition-colors"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <input 
            type="text" 
            placeholder="Ketik tema (misal: 'outing kantor ceria' atau 'lofi sunset')..." 
            className="w-full h-14 bg-zinc-900 border border-zinc-800 rounded-2xl pl-12 pr-32 text-sm font-medium focus:outline-none focus:border-indigo-500 transition-all text-white placeholder:text-zinc-600"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAISearch()}
          />
          <button 
            onClick={handleAISearch}
            disabled={isSearching}
            className="absolute right-2 top-2 bottom-2 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
          >
            {isSearching ? 'Analyzing...' : 'Find Trends'}
          </button>
        </div>

        <div className="flex gap-6 overflow-x-auto pb-2 no-scrollbar">
          {(['trending', 'discovery', 'recent'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[10px] font-black uppercase tracking-[0.2em] pb-2 border-b-2 transition-all shrink-0 ${activeTab === tab ? 'text-white border-white' : 'text-zinc-600 border-transparent hover:text-zinc-400'}`}
            >
              {tab === 'discovery' ? 'AI Discovery' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-20 space-y-3">
        {isSearching && (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-zinc-900/50 rounded-2xl border border-zinc-800"></div>
            ))}
            <p className="text-center text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Searching trending social media audios...</p>
          </div>
        )}

        {!isSearching && activeTab === 'discovery' && aiResults.length === 0 && (
          <div className="h-40 flex flex-col items-center justify-center text-center opacity-40">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mb-4"><path d="m21 21-6-6m6 6-9-9 9 9Z"></path><circle cx="10" cy="10" r="7"></circle></svg>
            <p className="text-[10px] font-bold uppercase tracking-widest">Gunakan fitur 'Find Trends' di atas <br/> untuk mencari lagu viral.</p>
          </div>
        )}

        {((activeTab === 'trending' ? MOCK_TRENDING : aiResults)).map((track) => (
          <div 
            key={track.id} 
            onClick={() => onSelect(track)}
            className="flex items-center gap-4 p-4 bg-zinc-900/40 hover:bg-zinc-800/60 border border-zinc-900 hover:border-indigo-500/30 rounded-2xl cursor-pointer transition-all group"
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 shadow-2xl group-hover:scale-105 transition-transform relative">
              <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <h4 className="text-[11px] font-black text-white truncate uppercase tracking-tight">{track.title}</h4>
                {activeTab === 'discovery' && <span className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 text-[7px] font-black rounded uppercase">Viral</span>}
              </div>
              <p className="text-[10px] text-zinc-500 font-bold truncate mb-1">{track.artist}</p>
              {(track as any).description && (
                <p className="text-[9px] text-zinc-600 italic truncate leading-tight">“{(track as any).description}”</p>
              )}
            </div>
            <div className="text-[9px] font-mono text-zinc-600 group-hover:text-indigo-400 transition-colors bg-zinc-950 px-2 py-1 rounded-lg">
              {Math.floor(track.duration / 60)}:{Math.floor(track.duration % 60).toString().padStart(2, '0')}
            </div>
          </div>
        ))}

        {activeTab === 'trending' && (
          <div className="pt-8 pb-4">
            <div className="p-6 bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform">
                <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              </div>
              <div className="flex items-center gap-3 mb-3 relative z-10">
                <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                </div>
                <h5 className="text-[11px] font-black text-white uppercase tracking-[0.2em]">External Link Extractor</h5>
              </div>
              <p className="text-[10px] text-zinc-500 mb-5 leading-relaxed font-medium">Tempel tautan video Instagram Reels atau video dari website. AI akan mengekstrak musiknya untuk Anda.</p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Paste URL (IG/WA/Web)..." 
                  className="flex-1 bg-black border border-zinc-800 rounded-xl px-4 text-[10px] text-white focus:outline-none focus:border-indigo-500 transition-all"
                />
                <button className="px-4 py-3 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all active:scale-95 shadow-xl">
                  Extract
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer Info */}
      <div className="p-4 bg-zinc-950 border-t border-zinc-900 text-center">
        <p className="text-[8px] text-zinc-700 font-bold uppercase tracking-[0.3em]">Credits: Gemini Search Grounding • No Extra Cost</p>
      </div>
    </div>
  );
};
