import React, { useState, useEffect, useRef } from 'react';
import { MediaAsset } from '../types';

interface LocalSyncProps {
  onReceiveAsset: (asset: MediaAsset) => void;
}

interface TransferState {
  id: string;
  name: string;
  progress: number;
  type: 'upload' | 'download';
}

export const LocalSync: React.FC<LocalSyncProps> = ({ onReceiveAsset }) => {
  const [roomId, setRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [transfers, setTransfers] = useState<TransferState[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  
  // Reassembly state: fileId -> { chunks: string[], receivedCount: number, totalCount: number, meta: any }
  const incomingFiles = useRef<Map<string, { chunks: string[], receivedCount: number, totalCount: number, meta: any }>>(new Map());

  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const addLog = (msg: string) => setLogs(prev => [msg, ...prev].slice(0, 50));

  const updateTransfer = (id: string, update: Partial<TransferState>) => {
    setTransfers(prev => {
      const idx = prev.findIndex(t => t.id === id);
      if (idx === -1) return prev;
      const newTransfers = [...prev];
      newTransfers[idx] = { ...newTransfers[idx], ...update };
      return newTransfers;
    });
  };

  const connect = () => {
    if (!roomId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}`);

    ws.onopen = () => {
      addLog('Connected to server');
      ws.send(JSON.stringify({ type: 'join', roomId }));
      setIsConnected(true);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'joined') {
          addLog(`Joined room: ${data.roomId}`);
          setPeerCount(data.count || 0);
        } else if (data.type === 'user-joined') {
          addLog('A peer joined the room');
          setPeerCount(data.count || 0);
        } else if (data.type === 'user-left') {
          addLog('A peer left the room');
          setPeerCount(data.count || 0);
        } else if (data.type === 'file-meta') {
          addLog(`Receiving: ${data.name} (${(data.size / 1024 / 1024).toFixed(2)} MB)`);
          incomingFiles.current.set(data.id, {
            chunks: [],
            receivedCount: 0,
            totalCount: Math.ceil(data.size / (16 * 1024)), // Assuming 16KB chunks
            meta: data
          });
          setTransfers(prev => [...prev, { id: data.id, name: data.name, progress: 0, type: 'download' }]);
        } else if (data.type === 'file-chunk') {
          const fileId = data.id;
          const entry = incomingFiles.current.get(fileId);
          
          if (entry) {
            entry.chunks[data.index] = data.chunk;
            entry.receivedCount++;
            
            // Update progress UI
            const progress = Math.round((entry.receivedCount / data.total) * 100);
            updateTransfer(fileId, { progress });

            if (entry.receivedCount === data.total) {
              // Reassembly
              addLog(`Reassembling: ${data.name}`);
              
              // Sort chunks by index just in case (though array index assignment handles this)
              // Convert base64 chunks to Blob
              const blobParts = entry.chunks.map(b64 => {
                const byteCharacters = atob(b64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                  byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                return new Uint8Array(byteNumbers);
              });

              const blob = new Blob(blobParts, { type: data.fileType });
              const newAsset: MediaAsset = {
                id: Math.random().toString(36).substr(2, 9),
                file: new File([blob], data.name, { type: data.fileType }),
                previewUrl: URL.createObjectURL(blob),
                type: data.fileType.startsWith('video/') ? 'video' : 'image',
                name: data.name
              };
              
              onReceiveAsset(newAsset);
              addLog(`Completed: ${data.name}`);
              
              // Cleanup
              incomingFiles.current.delete(fileId);
              setTimeout(() => {
                setTransfers(prev => prev.filter(t => t.id !== fileId));
              }, 3000);
            }
          }
        } else if (data.type === 'error') {
            addLog(`Error: ${data.message}`);
        }
      } catch (e) {
        console.error('WebSocket message error', e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      addLog('Disconnected from server');
    };

    wsRef.current = ws;
  };

  const sendFile = async (file: File) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Not connected to a room');
      return;
    }

    if (!file.type.startsWith('video/')) {
      alert('Only video files are allowed in this secure channel.');
      return;
    }

    const fileId = Math.random().toString(36).substr(2, 9);
    const CHUNK_SIZE = 16 * 1024; // 16KB chunks
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    setTransfers(prev => [...prev, { id: fileId, name: file.name, progress: 0, type: 'upload' }]);

    // Send Metadata
    wsRef.current.send(JSON.stringify({
      type: 'file-meta',
      id: fileId,
      name: file.name,
      fileType: file.type,
      size: file.size
    }));

    const buffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(buffer);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = uint8Array.slice(start, end);
      
      // Convert chunk to base64
      const binary = String.fromCharCode.apply(null, Array.from(chunk));
      const base64 = btoa(binary);

      wsRef.current.send(JSON.stringify({
        type: 'file-chunk',
        id: fileId,
        name: file.name,
        fileType: file.type,
        chunk: base64,
        index: i,
        total: totalChunks
      }));

      // Update progress
      const progress = Math.round(((i + 1) / totalChunks) * 100);
      updateTransfer(fileId, { progress });

      // Yield to main thread every few chunks to keep UI responsive
      if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));
    }

    addLog(`Sent: ${file.name}`);
    setTimeout(() => {
      setTransfers(prev => prev.filter(t => t.id !== fileId));
    }, 3000);
  };

  return (
    <div className="bg-zinc-900/50 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 w-full max-w-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Safe House Sync
        </h2>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 rounded text-[10px] font-mono text-zinc-400 border border-zinc-700">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
            <span>LIMIT: 8 MBPS</span>
        </div>
      </div>
      
      {!isConnected ? (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">SECURE CHANNEL ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. ALPHA-1"
                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-indigo-500 transition-colors font-mono uppercase"
              />
              <button
                onClick={connect}
                disabled={!roomId}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
            <div>
              <p className="text-xs text-zinc-400">Channel</p>
              <p className="font-mono text-emerald-400 font-bold">{roomId}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-zinc-400">Devices</p>
              <p className="font-mono text-white font-bold">{peerCount}</p>
            </div>
            <button 
              onClick={() => {
                wsRef.current?.close();
                setIsConnected(false);
                setLogs([]);
              }}
              className="text-xs text-rose-400 hover:text-rose-300 underline"
            >
              Leave
            </button>
          </div>

          {/* Active Transfers */}
          {transfers.length > 0 && (
            <div className="space-y-2">
                {transfers.map(t => (
                    <div key={t.id} className="bg-zinc-800/50 p-2 rounded border border-zinc-700">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-white truncate max-w-[150px]">{t.name}</span>
                            <span className={t.type === 'upload' ? 'text-indigo-400' : 'text-emerald-400'}>
                                {t.type === 'upload' ? 'UPLOADING' : 'DOWNLOADING'} {t.progress}%
                            </span>
                        </div>
                        <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
                            <div 
                                className={`h-full transition-all duration-300 ${t.type === 'upload' ? 'bg-indigo-500' : 'bg-emerald-500'}`} 
                                style={{ width: `${t.progress}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
          )}

          <div className="border-t border-zinc-800 pt-4">
            <label className="block w-full cursor-pointer group">
              <div className="border-2 border-dashed border-zinc-700 group-hover:border-indigo-500 rounded-xl p-8 text-center transition-colors relative overflow-hidden">
                <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-colors relative z-10">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <p className="text-sm text-zinc-300 font-medium relative z-10">Drop Video Payload</p>
                <p className="text-xs text-zinc-500 mt-1 relative z-10">Encrypted video transmission only</p>
              </div>
              <input 
                type="file" 
                className="hidden" 
                accept="video/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    sendFile(e.target.files[0]);
                  }
                }}
              />
            </label>
          </div>

          <div className="bg-zinc-950 rounded-lg p-3 h-32 overflow-y-auto font-mono text-[10px] text-zinc-400 space-y-1 scrollbar-thin scrollbar-thumb-zinc-700">
            {logs.map((log, i) => (
              <div key={i} className="border-l-2 border-zinc-800 pl-2 py-0.5">{log}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
