import React, { useRef, useState } from 'react';
import { Volume2, RotateCw, Play, Pause } from 'lucide-react';
import { AudioData } from '../types';

interface AudioPlayerProps {
  audio: AudioData;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
}

export function AudioPlayer({ audio, onRegenerate, isRegenerating }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSpeedChange = (speed: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed;
      setPlaybackRate(speed);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-blue-600" />
          <span className="font-medium">Audio Lecture</span>
        </div>
        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCw className={`w-4 h-4 ${isRegenerating ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handlePlayPause}
          className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5" />
          )}
        </button>

        <audio
          ref={audioRef}
          src={audio.url}
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
        />

        <div className="flex-1">
          <div className="text-sm text-gray-600">
            Voice: {audio.voice}
          </div>
          <div className="text-xs text-gray-500">
            Generated: {new Date(audio.generatedAt).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Speed:</span>
        {[0.75, 1, 1.25, 1.5].map(speed => (
          <button
            key={speed}
            onClick={() => handleSpeedChange(speed)}
            className={`px-2 py-1 text-sm rounded ${
              playbackRate === speed
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}