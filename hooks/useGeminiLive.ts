
import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { createPcmBlob, decodeAudioData, PCM_SAMPLE_RATE_INPUT, PCM_SAMPLE_RATE_OUTPUT } from '../services/audioUtils';

interface UseGeminiLiveProps {
  apiKey: string;
  systemInstruction?: string;
  onTranscript?: (text: string, sender: 'user' | 'model') => void;
}

export const useGeminiLive = ({ apiKey, systemInstruction, onTranscript }: UseGeminiLiveProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volume, setVolume] = useState(0);

  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<Promise<any> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const frameIntervalRef = useRef<number | null>(null);
  
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const connect = useCallback(async (videoElement?: HTMLVideoElement) => {
    const currentApiKey = process.env.API_KEY;
    if (!currentApiKey) return;

    try {
      const ai = new GoogleGenAI({ apiKey: currentApiKey });
      
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: PCM_SAMPLE_RATE_INPUT,
      });
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: PCM_SAMPLE_RATE_OUTPUT,
      });

      // Get Mic & Camera
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: true 
      });
      streamRef.current = stream;

      if (videoElement) {
        videoElement.srcObject = stream;
      }

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: systemInstruction || "You are a helpful assistant.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            
            if (!inputContextRef.current || !streamRef.current) return;
            
            // Audio Stream
            const source = inputContextRef.current.createMediaStreamSource(streamRef.current);
            sourceRef.current = source;
            const processor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length));

              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(processor);
            processor.connect(inputContextRef.current.destination);

            // Video Stream (Image Frames)
            if (videoElement) {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              frameIntervalRef.current = window.setInterval(() => {
                if (!ctx || !videoElement.videoWidth) return;
                canvas.width = 320; // Reduced for performance
                canvas.height = (videoElement.videoHeight / videoElement.videoWidth) * 320;
                ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                
                const base64Data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
                sessionPromise.then(session => {
                  session.sendRealtimeInput({
                    media: { data: base64Data, mimeType: 'image/jpeg' }
                  });
                });
              }, 1000); // 1 FPS for native session
            }
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.outputTranscription?.text) {
                onTranscriptRef.current?.(message.serverContent.outputTranscription.text, 'model');
            }
            if (message.serverContent?.inputTranscription?.text) {
                onTranscriptRef.current?.(message.serverContent.inputTranscription.text, 'user');
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputContextRef.current) {
               setIsSpeaking(true);
               const ctx = outputContextRef.current;
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               try {
                   const audioBuffer = await decodeAudioData(base64Audio, ctx);
                   const source = ctx.createBufferSource();
                   source.buffer = audioBuffer;
                   source.connect(ctx.destination);
                   source.addEventListener('ended', () => {
                     activeSourcesRef.current.delete(source);
                     if (activeSourcesRef.current.size === 0) setIsSpeaking(false);
                   });
                   source.start(nextStartTimeRef.current);
                   activeSourcesRef.current.add(source);
                   nextStartTimeRef.current += audioBuffer.duration;
               } catch (e) {}
            }

            if (message.serverContent?.interrupted) {
              activeSourcesRef.current.forEach(src => { try { src.stop(); } catch(e) {} });
              activeSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setIsSpeaking(false);
            }
          },
          onclose: () => {
            setIsConnected(false);
            cleanup();
          },
          onerror: (err) => {
            setIsConnected(false);
            cleanup();
          }
        }
      });
      sessionRef.current = sessionPromise;
    } catch (error) {
      setIsConnected(false);
      cleanup();
    }
  }, [systemInstruction]);

  const cleanup = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (processorRef.current && inputContextRef.current) {
      processorRef.current.disconnect();
      if (sourceRef.current) sourceRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputContextRef.current && inputContextRef.current.state !== 'closed') {
      inputContextRef.current.close();
      inputContextRef.current = null;
    }
    if (outputContextRef.current && outputContextRef.current.state !== 'closed') {
      outputContextRef.current.close();
      outputContextRef.current = null;
    }
    activeSourcesRef.current.forEach(src => { try { src.stop(); } catch(e){} });
    activeSourcesRef.current.clear();
    setVolume(0);
    setIsSpeaking(false);
  }, []);

  const disconnect = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.then(session => session.close()).catch(() => {});
      sessionRef.current = null;
    }
    cleanup();
    setIsConnected(false);
  }, [cleanup]);

  useEffect(() => { return () => cleanup(); }, [cleanup]);

  return { isConnected, isSpeaking, volume, connect, disconnect };
};
