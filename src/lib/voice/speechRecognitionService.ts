'use client';

export class SpeechRecognitionService {
  private recognition: any;
  private isSupported: boolean;

  constructor() {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      this.isSupported = !!SpeechRecognition;
      
      if (this.isSupported) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'en-US';
      }
    } else {
      this.isSupported = false;
    }
  }

  startListening(
    onResult: (transcript: string) => void,
    onError?: (error: string) => void
  ): void {
    if (!this.isSupported || !this.recognition) {
      onError?.('Speech recognition not supported in this browser');
      return;
    }

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    this.recognition.onerror = (event: any) => {
      onError?.(event.error);
    };

    this.recognition.start();
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  isSpeechRecognitionSupported(): boolean {
    return this.isSupported;
  }
}

