
import React, { useRef, useState, useEffect } from 'react';
import { MediaAsset, MusicTrack } from '../types';
import { ExportModal } from './ExportModal';
import { MusicVisualizer } from './MusicVisualizer';
import { MusicLibrary } from './MusicLibrary';

interface VideoPlayerProps {
  src: string;
  className?: string;
  isList?: boolean;
  autoPlay?: boolean;
  onEnded?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, className, isList, autoPlay, onEnded }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (autoPlay && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [autoPlay, src]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const time = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = time;
      setProgress(parseFloat(e.target.value));
    }
  };

  return (
    <div className={`relative group/video h-full w-full overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-cover"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        muted={!autoPlay} // Muted if just previewing in gallery, unmuted if in cinematic mode
        playsInline
      />
      {!autoPlay && (
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/video:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-2">
          <input
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={progress}
            onChange={handleSeek}
            className="w-full h-1 bg-zinc-600 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex items-center justify-between">
            <button onClick={togglePlay} className="p-1 hover:bg-white/20 rounded transition-colors text-white">
              {isPlaying ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              )}
            </button>
            {!isList && <span className="text-[9px] text-zinc-300 font-mono">{videoRef.current ? `${Math.floor(videoRef.current.currentTime)}s` : '0s'}</span>}
          </div>
        </div>
      )}
    </div>
  );
};

const getVibeTip = (asset: MediaAsset): string => {
  const name = asset.name.toLowerCase();
  if (asset.type === 'video') {
    if (name.includes('food') || name.includes('makan')) return "Suggest: Slow-mo (0.5x) pada suapan pertama agar dramatis.";
    if (name.includes('jalan') || name.includes('visit')) return "Tip: Gunakan Speed Ramp untuk transisi antar lokasi.";
    if (name.includes('team') || name.includes('tim')) return "Ideal: Group highlight dengan Quick Zoom transisi.";
    return "Suggestion: Gunakan Match Cut di detik ke-2.";
  } else {
    return "Director Note: Tambahkan Ken Burns zoom-in untuk kedalaman sinematik.";
  }
};

interface GalleryProps {
  assets: MediaAsset[];
  onAddAssets: (files: FileList) => void;
  onRemoveAsset: (id: string) => void;
  onReorderAssets?: (startIndex: number, endIndex: number) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const Gallery: React.FC<GalleryProps> = ({ 
  assets, 
  onAddAssets, 
  onRemoveAsset,
  onReorderAssets,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isMusicLibraryOpen, setIsMusicLibraryOpen] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredAssetId, setHoveredAssetId] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.7);
  
  // Cinematic Preview States
  const [isCinematicMode, setIsCinematicMode] = useState(false);
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, selectedMusic, volume]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) onAddAssets(e.target.files);
  };

  const handleSelectMusic = (track: MusicTrack) => {
    setSelectedMusic(track);
    setIsMusicLibraryOpen(false);
    setIsPlaying(true);
  };

  const startCinematicPreview = () => {
    if (assets.length === 0) return;
    setCurrentAssetIndex(0);
    setIsCinematicMode(true);
    setIsPlaying(true);
  };

  const nextCinematicAsset = () => {
    if (currentAssetIndex < assets.length - 1) {
      setCurrentAssetIndex(prev => prev + 1);
    } else {
      setIsCinematicMode(false);
      setIsPlaying(false);
    }
  };

  const moveAsset = (index: number, direction: 'left' | 'right') => {
    if (!onReorderAssets) return;
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < assets.length) {
      onReorderAssets(index, newIndex);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden relative w-full bg-zinc-950">
      <ExportModal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} assets={assets} />
      {isMusicLibraryOpen && <MusicLibrary onSelect={handleSelectMusic} onClose={() => setIsMusicLibraryOpen(false)} />}
      
      {selectedMusic && <audio ref={audioRef} src={selectedMusic.url} loop onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />}

      {/* Cinematic Overlay Player */}
      {isCinematicMode && assets[currentAssetIndex] && (
        <div className="absolute inset-0 z-[80] bg-black flex flex-col items-center justify-center animate-in fade-in duration-700">
           <div className="absolute top-8 left-8 z-[90] flex items-center gap-4">
              <div className="px-4 py-2 bg-indigo-600 rounded-full text-[10px] font-black uppercase tracking-[0.3em] text-white shadow-2xl animate-pulse">
                Cinematic Preview Active
              </div>
              {selectedMusic && (
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">
                  Music: {selectedMusic.title}
                </div>
              )}
           </div>
           
           <button 
             onClick={() => setIsCinematicMode(false)}
             className="absolute top-8 right-8 z-[90] w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white flex items-center justify-center transition-all"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
           </button>

           <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
              <div className="w-full h-full animate-in zoom-in-110 duration-[8000ms] ease-out">
                {assets[currentAssetIndex].type === 'video' ? (
                  <VideoPlayer 
                    src={assets[currentAssetIndex].previewUrl} 
                    autoPlay 
                    onEnded={nextCinematicAsset}
                    className="scale-110"
                  />
                ) : (
                  <img 
                    src={assets[currentAssetIndex].previewUrl} 
                    alt="" 
                    className="w-full h-full object-cover scale-110" 
                    onLoad={() => setTimeout(nextCinematicAsset, 3000)}
                  />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none"></div>
              
              <div className="absolute bottom-12 left-12 right-12 z-[90] flex justify-between items-end">
                  <div className="max-w-md">
                    <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.4em] mb-2">SCENE {currentAssetIndex + 1} / {assets.length}</p>
                    <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">{assets[currentAssetIndex].name}</h2>
                  </div>
                  <div className="flex gap-1 h-1 w-64 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-indigo-500 transition-all duration-500" 
                      style={{ width: `${((currentAssetIndex + 1) / assets.length) * 100}%` }}
                    />
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="p-4 md:p-6 border-b border-zinc-800 bg-zinc-950 flex flex-col gap-4 z-30">
        <div className="flex justify-between items-center md:items-end">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white mb-0.5 tracking-tight">Timeline Alur</h1>
            <p className="text-zinc-500 text-[10px] md:text-xs font-bold uppercase tracking-[0.15em]">Director's Cutting Table</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-900 rounded-xl p-1 border border-zinc-800 mr-2">
              <button 
                onClick={onUndo} 
                disabled={!canUndo}
                className={`p-2 rounded-lg transition-all ${canUndo ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 cursor-not-allowed'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 14 4 9l5-5"></path><path d="M20 20v-7a4 4 0 0 0-4-4H4"></path></svg>
              </button>
              <button 
                onClick={onRedo} 
                disabled={!canRedo}
                className={`p-2 rounded-lg transition-all ${canRedo ? 'text-zinc-300 hover:bg-zinc-800' : 'text-zinc-700 cursor-not-allowed'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 14 5-5-5-5"></path><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>
              </button>
            </div>

            <button 
              onClick={startCinematicPreview}
              disabled={assets.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/20 uppercase tracking-widest active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              Play Preview
            </button>
            
            <button onClick={() => fileInputRef.current?.click()} className="bg-zinc-900 hover:bg-zinc-800 text-zinc-300 px-3 py-2 rounded-xl text-xs font-bold border border-zinc-800 transition-all flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              UPLOAD
            </button>
          </div>
          <input type="file" multiple ref={fileInputRef} className="hidden" accept="image/*,video/*" onChange={handleFileChange} />
        </div>

        <div className="flex items-center gap-4 pt-2 border-t border-zinc-800/50 flex-wrap">
          <button 
            onClick={() => setIsMusicLibraryOpen(true)}
            className="flex items-center gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 hover:bg-zinc-800 transition-all"
          >
            {selectedMusic ? (
              <div className="flex items-center gap-3">
                <img src={selectedMusic.thumbnail} className="w-6 h-6 rounded-md object-cover animate-pulse" alt="" />
                <div className="text-left">
                  <p className="text-[9px] font-black text-white truncate max-w-[100px] uppercase leading-none">{selectedMusic.title}</p>
                  <p className="text-[8px] text-zinc-500 font-bold truncate leading-none mt-1">ONLINE AUDIO</p>
                </div>
              </div>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Add Music (IG/WA)</span>
              </>
            )}
          </button>

          <button onClick={() => setIsPlaying(!isPlaying)} className={`p-2 rounded-xl transition-all ${isPlaying ? 'bg-rose-500/10 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}>
            {isPlaying ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            )}
          </button>
          
          <div className="flex-1 min-w-[120px] h-8 bg-zinc-950 rounded-lg overflow-hidden border border-zinc-800 group relative">
            <MusicVisualizer isPlaying={isPlaying} pacing={selectedMusic ? 'fast' : 'normal'} colorTheme={selectedMusic ? 'rose' : 'indigo'} />
            {selectedMusic && (
              <div className="absolute inset-0 flex items-center px-4 pointer-events-none opacity-40">
                <p className="text-[8px] font-black text-white tracking-widest truncate uppercase">NOW STREAMING: {selectedMusic.title}</p>
              </div>
            )}
          </div>
          
          <div className="hidden sm:flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-zinc-600"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
             <input type="range" min="0" max="1" step="0.1" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="w-16 h-1 bg-zinc-800 rounded-full appearance-none accent-indigo-500" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {assets.length === 0 ? (
          <div onClick={() => fileInputRef.current?.click()} className="h-full min-h-[300px] border-2 border-dashed border-zinc-800 rounded-3xl flex flex-col items-center justify-center text-zinc-600 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all cursor-pointer p-6 text-center group">
            <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
            </div>
            <p className="font-bold text-zinc-400 uppercase tracking-widest text-xs">Belum ada footage tim</p>
            <p className="text-[10px] mt-2 opacity-60">Upload video atau foto keseruan acaramu di sini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {assets.map((asset, index) => (
              <div 
                key={asset.id} 
                className="group relative aspect-[3/4] bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 transition-all hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/10"
                onMouseEnter={() => setHoveredAssetId(asset.id)}
                onMouseLeave={() => setHoveredAssetId(null)}
              >
                {asset.type === 'video' ? <VideoPlayer src={asset.previewUrl} /> : <img src={asset.previewUrl} alt={asset.name} className="w-full h-full object-cover" />}
                
                <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity flex justify-between">
                  <p className="text-[10px] text-white truncate font-bold uppercase tracking-wider max-w-[60%]">{asset.name}</p>
                  <span className="text-[10px] text-indigo-400 font-black">#{index + 1}</span>
                </div>

                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <button 
                      onClick={(e) => { e.stopPropagation(); moveAsset(index, 'left'); }}
                      disabled={index === 0}
                      className={`w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center pointer-events-auto backdrop-blur-sm transition-all hover:bg-indigo-600 ${index === 0 ? 'opacity-20 cursor-not-allowed' : ''}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); moveAsset(index, 'right'); }}
                      disabled={index === assets.length - 1}
                      className={`w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center pointer-events-auto backdrop-blur-sm transition-all hover:bg-indigo-600 ${index === assets.length - 1 ? 'opacity-20 cursor-not-allowed' : ''}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </button>
                </div>

                <div className={`absolute inset-x-2 bottom-2 p-3 bg-indigo-600/90 backdrop-blur-md rounded-xl text-white shadow-xl transition-all duration-300 transform pointer-events-none z-20 flex gap-2 items-start border border-indigo-400/50 ${
                  hoveredAssetId === asset.id ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'
                }`}>
                  <div className="shrink-0 mt-0.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path><path d="M5 22v-6a7 7 0 0 1 14 0v6"></path><path d="M9 13v-1a3 3 0 0 1 6 0v1"></path></svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-0.5 opacity-70">Director's Note</p>
                    <p className="text-[10px] font-medium leading-snug">{getVibeTip(asset)}</p>
                  </div>
                </div>

                <button onClick={() => onRemoveAsset(asset.id)} className="absolute top-2 right-2 p-2 bg-black/40 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/80 z-30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Floating Action Hint */}
      {assets.length > 0 && !isCinematicMode && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 duration-500">
          <div className="px-6 py-3 bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 rounded-full shadow-2xl flex items-center gap-4">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Ready to flow?</p>
            <button 
              onClick={startCinematicPreview}
              className="px-4 py-2 bg-indigo-600 rounded-lg text-[9px] font-black text-white uppercase tracking-widest hover:bg-indigo-500 transition-all active:scale-95"
            >
              Start Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
