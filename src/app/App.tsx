import { useState, useCallback, useEffect, useMemo } from 'react';
import { PitchDetector, PitchData } from './components/PitchDetector';
import { AudioSimulator } from './components/AudioSimulator';
import { PageTabs } from './components/PageTabs';
import { AlertCircle, X, Zap, Volume2, VolumeX, AlertTriangle } from 'lucide-react';

// ============================================================================
// VST3 MODE DETECTION
// ============================================================================
// Automatically detect if running as VST3 plugin or in browser
// When deployed as VST3 with iPlug2, set window.__VST3_MODE = true in your
// plugin wrapper code before loading this app
// ============================================================================
const detectVST3Bootstrap = () => {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  // Flag from host
  if (w.__VST3_MODE === true) return true;
  // Heuristic: if loaded from bundle (file://) assume plugin
  if (window.location && window.location.protocol === 'file:') return true;
  return false;
};

const initialVST3Mode = detectVST3Bootstrap();

export default function App() {
  const [isVST3, setIsVST3] = useState(initialVST3Mode);
  const [isListening, setIsListening] = useState(false);
  const [pitchData, setPitchData] = useState<PitchData[]>([]);
  const [waveformData, setWaveformData] = useState<Record<string, number[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [useDemoMode, setUseDemoMode] = useState(!initialVST3Mode); // Auto-disable demo mode in VST3
  const [monitorVolume, setMonitorVolume] = useState(0); // 0 = muted, 1 = full volume

  // Derived flag: when VST3, force DAW input and disable demo
  const shouldUseDAW = useMemo(() => isVST3 && !useDemoMode, [isVST3, useDemoMode]);

  // In VST3 the host sets window.__VST3_MODE after the page is loaded. Sync it here to avoid demo piano.
  useEffect(() => {
    const syncVstMode = () => {
      const flag = detectVST3Bootstrap();
      if (flag) {
        setIsVST3(true);
        setUseDemoMode(false);
      }
    };

    syncVstMode();
    (window as any).__setVST3Mode = syncVstMode;

    return () => {
      delete (window as any).__setVST3Mode;
    };
  }, []);

  const handlePitchDetected = useCallback((pitches: PitchData[]) => {
    setPitchData(pitches);
  }, []);
  
  const handleWaveformData = useCallback((waveform: Record<string, number[]>) => {
    setWaveformData(waveform);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    console.error('Pitch detection error:', errorMessage);
    setError(errorMessage);
    setIsListening(false);
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    setIsListening(true);
  }, []);

  return (
    <div className="size-full bg-slate-900 flex items-center justify-center">
      {/* Audio Source - Demo Mode or Real Microphone */}
      {useDemoMode ? (
        <AudioSimulator
          onPitchDetected={handlePitchDetected}
          onWaveformData={handleWaveformData}
          isActive={isListening}
        />
      ) : (
        <PitchDetector 
          onPitchDetected={handlePitchDetected}
          onWaveformData={handleWaveformData}
          onError={handleError}
          isActive={isListening}
          monitorVolume={monitorVolume}
          useDAWInput={shouldUseDAW}
        />
      )}
      
      {/* Error Notification */}
      {error && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-md w-full mx-4">
          <div className="bg-gradient-to-br from-red-900 to-pink-900 border-2 border-red-500 rounded-xl p-4 shadow-2xl shadow-red-500/50 backdrop-blur-sm animate-in slide-in-from-top duration-300">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="flex-1">
                <h4 className="font-mono text-red-200 mb-2 font-bold">⚠️ Microphone Access Blocked</h4>
                <p className="text-sm text-red-100 mb-3">{error}</p>
                <div className="bg-red-950/50 rounded-lg p-3 text-xs text-red-200 space-y-2 mb-3">
                  <p className="font-medium text-red-100">📋 Step-by-step fix:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-red-300">
                    <li>Look for the <strong>🔒 lock/camera icon</strong> in your browser's address bar (top left)</li>
                    <li>Click it and find <strong>"Microphone"</strong> permissions</li>
                    <li>Change it to <strong>"Allow"</strong></li>
                    <li>Click the button below to retry</li>
                  </ol>
                </div>
                <button
                  onClick={handleRetry}
                  className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white py-2 px-4 rounded-lg font-mono text-sm transition-all duration-300 shadow-lg"
                >
                  🔄 Retry Microphone Access
                </button>
              </div>
              <button 
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-200 transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
      
      <PageTabs 
        pitchData={pitchData} 
        waveformData={waveformData} 
        isListening={isListening}
        onToggleListening={() => {
          // On first start in plugin, ensure demo is disabled and DAW path is used
          if (!isListening && (isVST3 || (window as any).processDAWAudioBuffer)) {
            setUseDemoMode(false);
            setIsVST3(true);
          }
          setIsListening(!isListening);
        }}
      />
    </div>
  );
}