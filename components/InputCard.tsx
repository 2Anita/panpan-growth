'use client';

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Send, Image, Mic, Loader2, Camera, Pause, Square } from 'lucide-react';
import { toast } from 'sonner';
import Tesseract from 'tesseract.js';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';

interface InputCardProps {
  onSubmit: (content: string) => Promise<void>;
  onVoiceClick?: () => void;
  onImageClick?: () => void;
  isSubmitting?: boolean;
  initialText?: string;
}

export function InputCard({ onSubmit, onVoiceClick, isSubmitting, initialText = '' }: InputCardProps) {
  const [content, setContent] = useState(initialText);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Speech recognition states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState('');

  const {
    isListening,
    isPaused: speechIsPaused,
    isSupported,
    transcript,
    interimTranscript,
    duration,
    start,
    stop,
    pause,
    resume,
  } = useSpeechRecognition({
    onInterimResult: (text) => setLiveTranscript(text),
    onFinalResult: (text) => {
      setContent((prev) => {
        if (prev.trim()) {
          return prev + '\n\n' + text;
        }
        return text;
      });
      setLiveTranscript('');
    },
    onError: (error) => {
      toast.error(error.message);
      setIsRecording(false);
    },
    onEnd: () => {
      setIsRecording(false);
      setIsPaused(false);
      setLiveTranscript('');
    },
  });

  useEffect(() => {
    if (isExpanded && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isExpanded]);

  useEffect(() => {
    if (initialText) {
      setContent(initialText);
      setIsExpanded(true);
    }
  }, [initialText]);

  useEffect(() => {
    setIsRecording(isListening);
    setIsPaused(speechIsPaused);
    setRecordingDuration(duration);
  }, [isListening, speechIsPaused, duration]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('请输入内容');
      return;
    }

    try {
      await onSubmit(content.trim());
      setContent('');
      setIsExpanded(false);
      toast.success('复盘已保存');
    } catch {
      toast.error('保存失败，请重试');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const appendText = (extractedText: string) => {
    setContent((prev) => {
      if (prev.trim()) {
        return prev + '\n\n' + extractedText;
      }
      return extractedText;
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('不支持的图片格式，请上传 JPG、PNG、GIF 或 WEBP 格式');
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('图片大小不能超过10MB');
      return;
    }

    setIsOcrProcessing(true);
    setOcrStatus('图片文字提取中...');

    try {
      const result = await Tesseract.recognize(file, 'chi_sim+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            setOcrStatus(`识别中...${progress}%`);
          }
        },
      });

      const extractedText = result.data.text.trim();

      if (!extractedText) {
        toast.error('未能识别出文字，请手动输入');
        setOcrStatus('');
        setIsOcrProcessing(false);
        return;
      }

      appendText(extractedText);
      setOcrStatus('识别完成');
      toast.success('图片文字已提取');

      if (!isExpanded) {
        setIsExpanded(true);
      }
    } catch (error) {
      console.error('OCR failed:', error);
      toast.error('图片文字提取失败，请重试');
    } finally {
      setIsOcrProcessing(false);
      setOcrStatus('');
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  // Voice recording handlers
  const handleStartRecording = () => {
    if (!isSupported) {
      toast.error('当前浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器');
      return;
    }
    setLiveTranscript('');
    start();
  };

  const handleStopRecording = () => {
    // Save any remaining transcript
    if (transcript) {
      setContent((prev) => {
        if (prev.trim()) {
          return prev + '\n\n' + transcript;
        }
        return transcript;
      });
    }
    stop();
    setLiveTranscript('');
    toast.success('录音已完成');
  };

  const handlePauseRecording = () => {
    pause();
    toast.info('录音已暂停');
  };

  const handleResumeRecording = () => {
    resume();
    toast.info('继续录音');
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isExpanded) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageSelect}
        />
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-4 text-left text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
        >
          <span className="text-base">今天有什么想法？想到什么就说什么...</span>
          <div className="flex items-center gap-3 mt-3">
            <Badge
              variant="secondary"
              className="gap-1 px-3 py-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                handleStartRecording();
                setIsExpanded(true);
              }}
            >
              <Mic className="w-4 h-4" />
              语音
            </Badge>
            <Badge
              variant="secondary"
              className="gap-1 px-3 py-1 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                triggerImageUpload();
              }}
            >
              <Camera className="w-4 h-4" />
              图片
            </Badge>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-x-0 bottom-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl border-t border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (isRecording) {
                  handleStopRecording();
                }
                setIsExpanded(false);
              }}
              className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
            <span className="text-sm text-gray-500">
              {content.length} 字{isOcrProcessing && ` · ${ocrStatus}`}
            </span>
            <Button
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              className="gap-2 bg-indigo-500 hover:bg-indigo-600"
            >
              {isSubmitting ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              提交
            </Button>
          </div>
        </div>

        <div className="p-4 pb-8 max-h-[70vh] overflow-y-auto">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={isOcrProcessing ? '图片文字提取中...' : '今天有什么想法？想到什么就说什么...'}
            className="min-h-[200px] text-base border-0 resize-none focus:ring-0 p-0 bg-transparent"
            autoFocus
            disabled={isOcrProcessing}
          />

          {/* Live transcript display */}
          {isRecording && liveTranscript && (
            <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
              <p className="text-sm text-indigo-600 dark:text-indigo-400 italic">
                {liveTranscript}
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            {isRecording ? (
              <>
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm font-medium">
                    {formatDuration(recordingDuration)}
                  </span>
                </div>
                {isPaused ? (
                  <Button
                    onClick={handleResumeRecording}
                    className="gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800"
                  >
                    <Mic className="w-4 h-4" />
                    继续
                  </Button>
                ) : (
                  <Button
                    onClick={handlePauseRecording}
                    className="gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800"
                  >
                    <Pause className="w-4 h-4" />
                    暂停
                  </Button>
                )}
                <Button
                  onClick={handleStopRecording}
                  className="gap-2 px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white"
                >
                  <Square className="w-4 h-4" />
                  停止
                </Button>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartRecording}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Mic className="w-4 h-4" />
                  语音
                </button>
                <button
                  onClick={triggerImageUpload}
                  disabled={isOcrProcessing}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {isOcrProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{ocrStatus || '处理中...'}</span>
                    </>
                  ) : (
                    <>
                      <Image className="w-4 h-4" />
                      <span>图片</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs text-gray-400 text-center">
            按 ⌘/Ctrl + Enter 快速提交
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageSelect}
        />
      </div>
    </div>
  );
}