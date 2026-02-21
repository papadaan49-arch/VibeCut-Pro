
import React, { useEffect, useRef, useState } from 'react';
import { LogMessage } from '../types';

interface LiveInterfaceProps {
  logs: LogMessage[];
  isConnected: boolean;
  isSpeaking: boolean;
  volume: number;
  connect: (videoRef?: HTMLVideoElement) => void;
  disconnect: () => void;
}

const AudioWaveform = ({ volume, active }: { volume: number, active: boolean }) => {
  return (
    <div className="flex items-center justify-center gap-[3px] h-8 w-16">
      {Array.from({ length: 15 }).map((_, i) => {
        // Create a symmetric waveform effect
        const distFromCenter = Math.abs(i - 7);
        const factor = (8 - distFromCenter) / 8;
        const height = active 
          ? Math.max(2, Math.min(32, volume * 150 * factor * (0.8 + Math.random() * 0.4))) 
          : 2;
        
        return (
          <div
            key={i}
            className={`w-[2px] rounded-full transition-all duration-75 ${
              active ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]' : 'bg-zinc-800'
            }`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};

export const LiveInterface: React.FC<LiveInterfaceProps> = ({ 
  logs, 
  isConnected, 
  isSpeaking, 
  volume, 
  connect, 
  disconnect 
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isSpeaking]);

  useEffect(() => {
    if (isConnected) {
      setShowStatus(true);
      const timer = setTimeout(() => setShowStatus(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isConnected]);

  const handleToggleSession = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect(videoRef.current || undefined);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 w-full shrink-0 font-sans border-t md:border-t-0 md:border-l border-zinc-900 overflow-hidden relative">
      {/* Cinematic HUD Header */}
      <div className="h-16 px-6 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-2xl flex justify-between items-center shrink-0 z-50">
        <div className="flex flex-col">
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-rose-500 animate-pulse' : 'bg-zinc-700'}`}></div>
              <h2 className="text-[10px] font-black text-white tracking-[0.3em] uppercase italic">VibeCut Live Session</h2>
           </div>
           <p className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5 ml-4">
             {isConnected ? 'Signal: Encrypted / Multi-modal' : 'Signal: Offline'}
           </p>
        </div>
        {isConnected && <AudioWaveform volume={volume} active={true} />}
      </div>

      {/* Main Director Viewport */}
      <div className="relative aspect-video md:aspect-auto md:h-72 bg-zinc-900 overflow-hidden shrink-0 border-b border-zinc-900 group">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-full object-cover transition-all duration-700 ${isConnected ? 'opacity-100 scale-100 grayscale-0' : 'opacity-30 scale-105 grayscale'}`} 
        />
        
        {/* Viewfinder Overlays */}
        <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
                <div className="flex flex-col gap-2">
                    <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-3">
                        <span className="text-[9px] font-black text-white uppercase tracking-[0.2em]">DIRECTOR MODE</span>
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-rose-600 animate-pulse' : 'bg-zinc-600'}`}></div>
                    </div>
                    {isConnected && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left duration-500">
                          <div className="px-2 py-0.5 bg-indigo-600/40 backdrop-blur-md rounded text-[7px] font-black text-indigo-300 uppercase tracking-widest border border-indigo-400/20">
                            CAM 01 // ACTIVE
                          </div>
                          <div className="px-2 py-0.5 bg-emerald-600/40 backdrop-blur-md rounded text-[7px] font-black text-emerald-300 uppercase tracking-widest border border-emerald-400/20">
                            VOICE // SYNC
                          </div>
                        </div>
                    )}
                </div>
                <div className="text-[9px] font-mono text-white/40 bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/5">
                    ISO 800 | 1/60 | f2.8
                </div>
            </div>

            {/* AI Vision Status */}
            {isConnected && isSpeaking && (
              <div className="self-center mb-4 px-4 py-2 bg-indigo-600/20 backdrop-blur-xl border border-indigo-500/30 rounded-full animate-in zoom-in duration-300">
                <p className="text-[8px] font-black text-indigo-300 uppercase tracking-[0.4em] flex items-center gap-3">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping"></span>
                  AI Analyzing Visual Context
                </p>
              </div>
            )}
            
            <div className="flex justify-between items-end">
                <div className="text-[9px] font-mono text-white/50 bg-black/40 px-2 py-1 rounded border border-white/5">
                    TC 00:00:{logs.length.toString().padStart(2, '0')}:00
                </div>
                <div className="flex gap-1">
                  <div className="w-1 h-3 bg-white/20"></div>
                  <div className="w-1 h-3 bg-white/20"></div>
                  <div className="w-1 h-3 bg-indigo-500"></div>
                </div>
            </div>
            
            {/* Viewfinder Corners */}
            <div className="absolute top-6 left-6 w-6 h-6 border-t-2 border-l-2 border-white/30"></div>
            <div className="absolute top-6 right-6 w-6 h-6 border-t-2 border-r-2 border-white/30"></div>
            <div className="absolute bottom-6 left-6 w-6 h-6 border-b-2 border-l-2 border-white/30"></div>
            <div className="absolute bottom-6 right-6 w-6 h-6 border-b-2 border-r-2 border-white/30"></div>

            {!isConnected && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                      <p className="text-[12px] font-black text-zinc-500 uppercase tracking-[0.5em] italic">Standby Mode</p>
                      <div className="w-48 h-[1px] bg-gradient-to-r from-transparent via-zinc-800 to-transparent"></div>
                    </div>
                </div>
            )}
        </div>
      </div>

      {/* Transcript Log Container */}
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth" ref={scrollRef}>
          {logs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <div className="w-16 h-16 bg-zinc-900 rounded-3xl flex items-center justify-center text-zinc-600 mb-6 border border-zinc-800 transform rotate-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              </div>
              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.3em] leading-relaxed max-w-[180px]">
                  Bicaralah dengan AI Director <br/> untuk mengatur alur video tim Anda.
              </p>
            </div>
          ) : (
              logs.map((log, i) => {
                  const isUser = log.sender === 'user';
                  return (
                      <div key={i} className={`flex w-full animate-in fade-in slide-in-from-bottom-3 duration-500 ${isUser ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] group relative ${isUser ? 'items-end' : 'items-start'}`}>
                              <div className={`px-4 py-3 rounded-2xl shadow-xl transition-all ${
                                isUser 
                                ? 'bg-zinc-900 border-zinc-800 text-zinc-100 rounded-tr-none' 
                                : 'bg-indigo-600/10 border-indigo-500/20 text-indigo-50 rounded-tl-none backdrop-blur-sm'
                              } border`}>
                                  <div className="flex items-center gap-2 mb-1.5">
                                      <span className={`text-[8px] font-black uppercase tracking-[0.2em] ${isUser ? 'text-zinc-500' : 'text-indigo-400'}`}>
                                          {isUser ? 'YOU' : 'DIRECTOR'}
                                      </span>
                                      <span className="text-[7px] font-mono text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {log.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                  </div>
                                  <p className="text-[13px] leading-relaxed font-medium">
                                      {log.text}
                                  </p>
                              </div>
                          </div>
                      </div>
                  );
              })
          )}
          
          {isSpeaking && (
              <div className="flex justify-start w-full animate-in fade-in duration-300">
                   <div className="flex gap-1.5 px-4 py-3 bg-indigo-600/10 rounded-2xl border border-indigo-500/10 backdrop-blur-sm">
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
                   </div>
              </div>
          )}
        </div>

        {/* Floating Session Status */}
        {showStatus && isConnected && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-full shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 z-50">
            SESSION CONNECTED
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="p-8 bg-zinc-950 border-t border-zinc-900 shrink-0">
         <button
            onClick={handleToggleSession}
            className={`w-full h-16 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 active:scale-95 shadow-2xl border-b-4 ${
                isConnected 
                ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30 border-rose-700' 
                : 'bg-white hover:bg-zinc-200 text-black shadow-white/20 border-zinc-300'
            }`}
         >
            {isConnected ? (
                <>
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  TERMINATE SESSION
                </>
            ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  START AI CONSULTATION
                </>
            )}
         </button>
         <div className="flex justify-between items-center mt-6">
            <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">
               Hardware Acceleration: ON
            </p>
            <p className="text-[8px] text-indigo-500/60 font-black uppercase tracking-widest italic">
               Powered by Gemini 2.5 Flash
            </p>
         </div>
      </div>
    </div>
  );
};
