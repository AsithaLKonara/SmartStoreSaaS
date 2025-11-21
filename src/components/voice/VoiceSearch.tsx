'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Mic, MicOff } from 'lucide-react';
import { SpeechRecognitionService } from '@/lib/voice/speechRecognitionService';

export function VoiceSearch({ onSearch }: { onSearch: (query: string) => void }) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [recognitionService, setRecognitionService] = useState<SpeechRecognitionService | null>(null);

  useEffect(() => {
    const service = new SpeechRecognitionService();
    setRecognitionService(service);
    
    if (!service.isSpeechRecognitionSupported()) {
      setError('Speech recognition not supported in this browser');
    }
  }, []);

  const startListening = () => {
    if (!recognitionService) {
      setError('Speech recognition not initialized');
      return;
    }

    setIsListening(true);
    setError(null);
    setTranscript('');

    recognitionService.startListening(
      (transcript) => {
        setTranscript(transcript);
        setIsListening(false);
        onSearch(transcript);
      },
      (error) => {
        setError(error);
        setIsListening(false);
      }
    );
  };

  const stopListening = () => {
    if (recognitionService) {
      recognitionService.stopListening();
    }
    setIsListening(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={isListening ? stopListening : startListening}
        variant={isListening ? 'destructive' : 'default'}
        disabled={!recognitionService || !!error}
      >
        {isListening ? (
          <>
            <MicOff className="h-4 w-4 mr-2" />
            Stop Listening
          </>
        ) : (
          <>
            <Mic className="h-4 w-4 mr-2" />
            Start Voice Search
          </>
        )}
      </Button>
      
      {transcript && (
        <span className="text-sm text-gray-600">Heard: {transcript}</span>
      )}
      
      {error && (
        <span className="text-sm text-red-600">{error}</span>
      )}
    </div>
  );
}

