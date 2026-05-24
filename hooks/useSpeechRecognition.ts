'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionOptions {
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (error: Error) => void;
  onEnd?: () => void;
  lang?: string;
}

export function useSpeechRecognition({
  onInterimResult,
  onFinalResult,
  onError,
  onEnd,
  lang = 'zh-CN',
}: UseSpeechRecognitionOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [duration, setDuration] = useState(0);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef('');

  useEffect(() => {
    const SpeechRecognitionAPI =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);
    setIsSupported(!!SpeechRecognitionAPI);
  }, []);

  const start = useCallback(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      onError?.(new Error('当前浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器'));
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    finalTranscriptRef.current = '';
    setTranscript('');
    setInterimTranscript('');

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }

      if (finalText) {
        finalTranscriptRef.current += finalText;
        setTranscript(finalTranscriptRef.current);
        onFinalResult?.(finalText);
      }
      if (interimText) {
        setInterimTranscript(interimText);
        onInterimResult?.(interimText);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        onError?.(new Error(getErrorMessage(event.error)));
      }
      stopTimer();
      setIsListening(false);
      setIsPaused(false);
    };

    recognition.onend = () => {
      if (isListening && !isPaused) {
        // Only restart if we haven't explicitly stopped
        try {
          recognition.start();
        } catch {
          // Already stopped
        }
      } else {
        stopTimer();
        setIsListening(false);
        setIsPaused(false);
        onEnd?.();
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
      setIsPaused(false);
      startTimer();
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      onError?.(new Error('启动语音识别失败，请检查麦克风权限'));
      return;
    }
  }, [lang, onError, onFinalResult, onInterimResult, onEnd, isListening, isPaused]);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
      recognitionRef.current.stop();
    }
    stopTimer();
    setIsListening(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      setIsPaused(true);
      stopTimer();
    }
  }, [isListening]);

  const resume = useCallback(() => {
    if (recognitionRef.current && isPaused) {
      setIsPaused(false);
      startTimer();
      try {
        recognitionRef.current.start();
      } catch {
        // Already stopped
      }
    }
  }, [isPaused]);

  const startTimer = () => {
    stopTimer();
    setDuration(0);
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      stopTimer();
    };
  }, []);

  return {
    isListening,
    isPaused,
    isSupported,
    transcript,
    interimTranscript,
    duration,
    start,
    stop,
    pause,
    resume,
  };
}

function getErrorMessage(error: string): string {
  switch (error) {
    case 'not-allowed':
      return '麦克风权限被拒绝，请在浏览器设置中允许访问麦克风';
    case 'no-speech':
      return '未检测到语音，请对准麦克风说话';
    case 'network':
      return '网络错误，语音识别服务不可用';
    case 'audio-capture':
      return '未检测到麦克风设备，请连接麦克风';
    case 'aborted':
      return '语音识别已停止';
    default:
      return '语音识别出错，请重试';
  }
}

// Type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: {
    [key: number]: {
      [key: number]: {
        transcript: string;
        confidence: number;
      };
      isFinal: boolean;
      length: number;
    };
    length: number;
  };
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}