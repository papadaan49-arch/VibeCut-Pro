
export interface MediaAsset {
  id: string;
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
  name: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url: string;
  thumbnail: string;
  duration: number;
}

export interface LogMessage {
  timestamp: Date;
  sender: 'user' | 'model' | 'system';
  text: string;
}

export interface LiveStatus {
  isConnected: boolean;
  isSpeaking: boolean;
  isListening: boolean;
}

export interface ExportSettings {
  resolution: '720p' | '1080p' | '4K';
  format: 'mp4' | 'mov' | 'webm';
}
