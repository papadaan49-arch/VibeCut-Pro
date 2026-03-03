import { GoogleGenAI, Type } from "@google/genai";
import { MediaAsset, AIEditSuggestion } from "../types";

// Helper to get fresh AI instance
const getAI = () => {
  const apiKey = process.env.API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

// Helper to extract frames from video file
const extractFrames = async (file: File, count: number = 5): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    const frames: string[] = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const interval = duration / (count + 1);
      
      canvas.width = 320; // Low res for AI analysis
      canvas.height = (video.videoHeight / video.videoWidth) * 320;

      for (let i = 1; i <= count; i++) {
        video.currentTime = interval * i;
        await new Promise(r => { video.onseeked = r; });
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL('image/jpeg', 0.6).split(',')[1]);
        }
      }
      
      URL.revokeObjectURL(video.src);
      resolve(frames);
    };

    video.onerror = (e) => reject(e);
  });
};

export const detectScenes = async (asset: MediaAsset): Promise<AIEditSuggestion[]> => {
  try {
    const ai = getAI();
    const frames = await extractFrames(asset.file, 5);
    
    const prompt = "Analyze these video frames. Identify key events, actions, or scene changes. Return a JSON array of scenes with 'description', 'timestamp' (approximate based on frame index 1-5), and 'confidence' (0-1).";

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: {
        parts: [
          ...frames.map(f => ({ inlineData: { mimeType: 'image/jpeg', data: f } })),
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              description: { type: Type.STRING },
              timestamp: { type: Type.NUMBER },
              confidence: { type: Type.NUMBER }
            }
          }
        }
      }
    });

    const scenes = JSON.parse(response.text || '[]');
    return scenes.map((s: any, i: number) => ({
      id: `scene-${Date.now()}-${i}`,
      type: 'scene',
      description: s.description,
      timestamp: s.timestamp, // This is just an index 1-5, needs mapping to actual time if needed
      confidence: s.confidence
    }));
  } catch (error) {
    console.error("Scene detection failed:", error);
    return [];
  }
};

export const generateAutoCut = async (assets: MediaAsset[], vibe: string): Promise<AIEditSuggestion[]> => {
  const ai = getAI();
  // For auto-cut, we send descriptions of assets (names) and the vibe
  const assetDescriptions = assets.map((a, i) => `Asset ${i}: ${a.name} (${a.type})`).join('\n');
  
  const prompt = `I have these video assets:\n${assetDescriptions}\n\nCreate a rough cut edit list for a video with this vibe: "${vibe}". Return a JSON array of cuts with 'assetIndex', 'start', 'end', and 'description'.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const cuts = JSON.parse(response.text || '[]');
    return cuts.map((c: any, i: number) => ({
      id: `cut-${Date.now()}-${i}`,
      type: 'cut',
      description: `Cut ${c.assetIndex}: ${c.description}`,
      confidence: 0.9
    }));
  } catch (error) {
    console.error("Auto-cut generation failed:", error);
    return [];
  }
};

export const generateVeoVideo = async (prompt: string, onStatusUpdate?: (status: string) => void): Promise<string | null> => {
  try {
    const ai = getAI();
    onStatusUpdate?.("Initializing Veo 3.1 generation...");
    
    let operation = await ai.models.generateVideos({
      model: 'veo-3.1-fast-generate-preview',
      prompt: prompt,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: '16:9'
      }
    });

    onStatusUpdate?.("Veo is dreaming up your video... (this may take a minute)");

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
      onStatusUpdate?.("Still rendering... AI magic in progress...");
    }

    const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!videoUri) throw new Error("No video URI returned");

    // Fetch the actual video blob
    const apiKey = process.env.API_KEY || '';
    const response = await fetch(videoUri, {
      headers: { 'x-goog-api-key': apiKey }
    });
    
    if (!response.ok) throw new Error("Failed to download generated video");
    
    const blob = await response.blob();
    return URL.createObjectURL(blob);

  } catch (error) {
    console.error("Veo generation failed:", error);
    onStatusUpdate?.("Generation failed. Please try again.");
    return null;
  }
};
