import { useEffect, useRef, useState } from 'react';

export interface PitchData {
  frequency: number;
  note: string;
  octave: number;
  cents: number;
  magnitude?: number;
}

export interface NoteWaveformData {
  note: string;
  magnitudes: number[]; // Array of magnitude values over time
}

interface PitchDetectorProps {
  onPitchDetected: (pitches: PitchData[]) => void;
  onWaveformData?: (waveformData: Record<string, number[]>) => void; // New callback for waveform data
  onError?: (error: string) => void;
  isActive: boolean;
  monitorVolume?: number; // 0-1, volume for audio monitoring (pass-through)
  useDAWInput?: boolean; // NEW: If true, will process audio from DAW instead of microphone
}

const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// ============================================================================
// VST3 INTEGRATION INTERFACE
// ============================================================================
// When building as VST3 with iPlug2, this interface will be used to pass
// audio buffers from the DAW to the pitch detector.
// 
// iPlug2 should call: window.processDAWAudioBuffer(leftChannel, rightChannel, sampleRate)
// where leftChannel and rightChannel are Float32Array buffers from the DAW
// ============================================================================

declare global {
  interface Window {
    processDAWAudioBuffer?: (leftChannel: Float32Array, rightChannel: Float32Array, sampleRate: number) => void;
    __pitchDetectorReady?: boolean;
  }
}

// Calculate the average magnitude for a specific note across octaves
function getMagnitudeForNote(
  frequencyData: Float32Array,
  note: string,
  sampleRate: number,
  fftSize: number
): number {
  const binSize = sampleRate / fftSize;
  const noteIndex = noteStrings.indexOf(note);

  let totalMagnitude = 0;
  let count = 0;

  for (let octave = 1; octave <= 6; octave++) {
    const noteNumber = octave * 12 + noteIndex;
    const A4_INDEX = 57;
    const frequency = 440 * Math.pow(2, (noteNumber - A4_INDEX) / 12);

    if (frequency < 50 || frequency > 2000) continue;

    const binIndex = Math.round(frequency / binSize);

    if (binIndex >= 0 && binIndex < frequencyData.length) {
      const left = frequencyData[Math.max(0, binIndex - 1)];
      const center = frequencyData[binIndex];
      const right = frequencyData[Math.min(frequencyData.length - 1, binIndex + 1)];
      totalMagnitude += (left + center + right) / 3;
      count++;
    }
  }

  return count > 0 ? totalMagnitude / count : 0;
}

function frequencyToNote(frequency: number, magnitude?: number): PitchData {
  const A4 = 440;
  const A4_INDEX = 57; // A4 is the 57th key on a piano (starting from C0)
  
  const halfStepsFromA4 = 12 * Math.log2(frequency / A4);
  const noteIndex = Math.round(halfStepsFromA4) + A4_INDEX;
  
  const octave = Math.floor(noteIndex / 12);
  const note = noteStrings[noteIndex % 12];
  
  // Calculate cents (deviation from perfect pitch)
  const perfectFreq = A4 * Math.pow(2, (noteIndex - A4_INDEX) / 12);
  const cents = Math.floor(1200 * Math.log2(frequency / perfectFreq));
  
  return { frequency, note, octave, cents, magnitude };
}

// Polyphonic pitch detection using FFT
function detectPolyphonicPitches(
  frequencyData: Float32Array,
  sampleRate: number
): PitchData[] {
  const fftSize = frequencyData.length * 2;
  const binSize = sampleRate / fftSize;
  const detectedPitches: PitchData[] = [];

  let rms = 0;
  for (let i = 0; i < frequencyData.length; i++) {
    rms += frequencyData[i] * frequencyData[i];
  }
  rms = Math.sqrt(rms / frequencyData.length);

  if (rms < 0.0004) return [];

  const peaks: Array<{ frequency: number; magnitude: number }> = [];
  const dynamicFloor = Math.max(0.001, rms * 1.8);
  const minFrequency = 50;
  const maxFrequency = 4000;

  for (let i = 5; i < frequencyData.length / 2; i++) {
    const frequency = i * binSize;
    if (frequency < minFrequency || frequency > maxFrequency) continue;

    const magnitude = frequencyData[i];

    if (
      magnitude > dynamicFloor &&
      magnitude > frequencyData[i - 1] &&
      magnitude > frequencyData[i + 1] &&
      magnitude > frequencyData[i - 2] &&
      magnitude > frequencyData[i + 2]
    ) {
      peaks.push({ frequency, magnitude });
    }
  }

  if (peaks.length === 0) return [];

  peaks.sort((a, b) => b.magnitude - a.magnitude);
  const strongestMagnitude = peaks[0].magnitude;
  const maxPeaks = 6;
  const candidates = peaks.slice(0, maxPeaks * 4).sort((a, b) => a.frequency - b.frequency);
  const processedNotes = new Set<string>();

  for (const peak of candidates) {
    if (peak.magnitude < strongestMagnitude * 0.22) continue;

    const isRelatedHarmonic = detectedPitches.some(existing => {
      const ratio = peak.frequency / existing.frequency;
      const inverseRatio = existing.frequency / peak.frequency;
      const nearest = Math.round(ratio);
      const nearestInverse = Math.round(inverseRatio);
      const harmonicMatch = nearest >= 2 && Math.abs(ratio - nearest) < 0.025;
      const subHarmonicMatch = nearestInverse >= 2 && Math.abs(inverseRatio - nearestInverse) < 0.025;
      return harmonicMatch || subHarmonicMatch;
    });

    if (isRelatedHarmonic) continue;

    const pitchData = frequencyToNote(peak.frequency, peak.magnitude);
    const noteKey = `${pitchData.note}${pitchData.octave}`;

    if (processedNotes.has(noteKey)) continue;

    detectedPitches.push(pitchData);
    processedNotes.add(noteKey);

    if (detectedPitches.length >= maxPeaks) break;
  }

  return detectedPitches;
}

function detectMonoPitch(timeDomainData: Float32Array, sampleRate: number): number | null {
  let rms = 0;
  for (let i = 0; i < timeDomainData.length; i++) {
    rms += timeDomainData[i] * timeDomainData[i];
  }
  rms = Math.sqrt(rms / timeDomainData.length);
  if (rms < 0.0002) return null;

  const mean = timeDomainData.reduce((sum, v) => sum + v, 0) / timeDomainData.length;
  const adjusted = new Float32Array(timeDomainData.length);
  for (let i = 0; i < timeDomainData.length; i++) {
    const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (timeDomainData.length - 1)));
    adjusted[i] = (timeDomainData[i] - mean) * window;
  }

  const minFrequency = 50;
  const maxFrequency = 2000;
  const maxLag = Math.floor(sampleRate / minFrequency);
  const minLag = Math.floor(sampleRate / maxFrequency);

  let bestLag = -1;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < adjusted.length - lag; i++) {
      sum += adjusted[i] * adjusted[i + lag];
    }
    const normalized = sum / (adjusted.length - lag);
    if (normalized > bestCorrelation) {
      bestCorrelation = normalized;
      bestLag = lag;
    }
  }

  if (bestLag === -1 || bestCorrelation < 0.1) return null;

  return sampleRate / bestLag;
}

function analyzePitchFrame(
  frequencyDataDb: Float32Array,
  timeDomainData: Float32Array,
  sampleRate: number
): { pitches: PitchData[]; magnitudes: Float32Array } {
  const magnitudes = new Float32Array(frequencyDataDb.length);
  for (let i = 0; i < frequencyDataDb.length; i++) {
    magnitudes[i] = Math.pow(10, frequencyDataDb[i] / 20);
  }

  const polyphonic = detectPolyphonicPitches(magnitudes, sampleRate);
  const mono = detectMonoPitch(timeDomainData, sampleRate);

  if (polyphonic.length === 0 && mono) {
    return { pitches: [frequencyToNote(mono, 1)], magnitudes };
  }

  if (polyphonic.length > 0 && mono) {
    const fundamental = polyphonic[0];
    const distance = Math.abs(fundamental.frequency - mono);
    const tolerance = Math.max(2, fundamental.frequency * 0.01);
    if (distance > tolerance) {
      polyphonic.unshift(frequencyToNote(mono, 1));
    }
  }

  return { pitches: polyphonic, magnitudes };
}

export function PitchDetector({ onPitchDetected, onWaveformData, onError, isActive, monitorVolume, useDAWInput }: PitchDetectorProps) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const outputSilenceRef = useRef<GainNode | null>(null);
  
  // Store waveform history for each note (120 samples = ~2 seconds at 60fps)
  const waveformHistoryRef = useRef<Record<string, number[]>>(
    noteStrings.reduce((acc, note) => {
      acc[note] = new Array(120).fill(0);
      return acc;
    }, {} as Record<string, number[]>)
  );

  // ============================================================================
  // DAW INPUT MODE: Setup AudioContext that receives external buffers
  // ============================================================================
  useEffect(() => {
    if (!isActive || !useDAWInput) return;

    // Setup AudioContext for DAW input mode
    const setupDAWInput = async () => {
      try {
        audioContextRef.current = new AudioContext({ sampleRate: 48000 }); // Common DAW sample rate
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 8192;
        analyserRef.current.smoothingTimeConstant = 0.1;
        analyserRef.current.minDecibels = -100;
        analyserRef.current.maxDecibels = -10;
        // Ensure the graph pulls audio even with monitor muted
        outputSilenceRef.current = audioContextRef.current.createGain();
        outputSilenceRef.current.gain.value = 0;
        analyserRef.current.connect(outputSilenceRef.current);
        outputSilenceRef.current.connect(audioContextRef.current.destination);

        const connectMonitor = () => {
          if (!audioContextRef.current || !monitorVolume || monitorVolume <= 0) return null;
          const monitorGain = audioContextRef.current.createGain();
          monitorGain.gain.value = monitorVolume;
          monitorGain.connect(audioContextRef.current.destination);
          return monitorGain;
        };

        // Expose global function for iPlug2 to send audio buffers
        window.processDAWAudioBuffer = (leftChannel: Float32Array, rightChannel: Float32Array, sampleRate: number) => {
          if (!audioContextRef.current || !analyserRef.current) return;

          // Resume context if suspended (can happen on first call)
          if (audioContextRef.current.state === 'suspended') {
            audioContextRef.current.resume();
          }

          // Recreate context if the DAW sample rate changes
          if (audioContextRef.current.sampleRate !== sampleRate) {
            audioContextRef.current.close();
            audioContextRef.current = new AudioContext({ sampleRate });
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 8192;
            analyserRef.current.smoothingTimeConstant = 0.1;
            analyserRef.current.minDecibels = -100;
            analyserRef.current.maxDecibels = -10;
            outputSilenceRef.current = audioContextRef.current.createGain();
            outputSilenceRef.current.gain.value = 0;
            analyserRef.current.connect(outputSilenceRef.current);
            outputSilenceRef.current.connect(audioContextRef.current.destination);
          }

          const ctx = audioContextRef.current;
          const analyser = analyserRef.current;

          // Build an AudioBuffer from the incoming DAW block
          const buffer = ctx.createBuffer(2, leftChannel.length, sampleRate);
          buffer.copyToChannel(leftChannel, 0);
          buffer.copyToChannel(rightChannel, 1);

          const source = ctx.createBufferSource();
          source.buffer = buffer;

          const monitorGain = connectMonitor();

          source.connect(analyser);
          if (monitorGain) {
            source.connect(monitorGain);
          }

          source.start();
          // Stop after the buffer duration to avoid overlap
          source.stop(ctx.currentTime + buffer.duration);
          source.onended = () => {
            source.disconnect();
            if (monitorGain) monitorGain.disconnect();
          };
        };

        window.__pitchDetectorReady = true;
        console.log('[VST3 Mode] Pitch detector ready for DAW input');

        // Start pitch detection loop
        detectPitchDAW();
      } catch (error) {
        console.error('[VST3 Mode] Error setting up DAW input:', error);
        onError?.('Failed to initialize DAW audio input mode');
      }
    };

    setupDAWInput();

    return () => {
      window.processDAWAudioBuffer = undefined;
      window.__pitchDetectorReady = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
      if (outputSilenceRef.current) {
        outputSilenceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isActive, useDAWInput, onError]);

  // Pitch detection loop for DAW input mode
  function detectPitchDAW() {
    if (!analyserRef.current || !audioContextRef.current || !useDAWInput) return;
    
    const frequencyDataDb = new Float32Array(analyserRef.current.frequencyBinCount);
    const timeDomainData = new Float32Array(analyserRef.current.fftSize);
    analyserRef.current.getFloatFrequencyData(frequencyDataDb);
    analyserRef.current.getFloatTimeDomainData(timeDomainData);

    const { pitches, magnitudes } = analyzePitchFrame(
      frequencyDataDb,
      timeDomainData,
      audioContextRef.current.sampleRate
    );

    onPitchDetected(pitches);

    if (onWaveformData) {
      const fftSize = analyserRef.current.fftSize;
      const sampleRate = audioContextRef.current.sampleRate;

      noteStrings.forEach(note => {
        const magnitude = getMagnitudeForNote(magnitudes, note, sampleRate, fftSize);
        const history = waveformHistoryRef.current[note];
        history.shift();
        history.push(magnitude);
      });

      onWaveformData(waveformHistoryRef.current);
    }

    rafIdRef.current = requestAnimationFrame(detectPitchDAW);
  }

  // ============================================================================
  // MICROPHONE INPUT MODE: Original implementation for browser testing
  // ============================================================================
  useEffect(() => {
    if (!isActive || useDAWInput) return; // Skip if using DAW input

    async function setupAudio() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          } 
        });
        
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 8192;
        analyserRef.current.smoothingTimeConstant = 0.1;
        analyserRef.current.minDecibels = -100;
        analyserRef.current.maxDecibels = -10;
        
        sourceRef.current = audioContextRef.current.createMediaStreamSource(stream);
        sourceRef.current.connect(analyserRef.current);
        
        // Add audio monitoring if monitorVolume is set
        if (monitorVolume !== undefined && monitorVolume > 0) {
          const gainNode = audioContextRef.current.createGain();
          gainNode.gain.value = monitorVolume;
          sourceRef.current.connect(gainNode);
          gainNode.connect(audioContextRef.current.destination);
        }
        
        detectPitch();
      } catch (error) {
        console.error('Error accessing microphone:', error);
        
        if (error instanceof DOMException) {
          if (error.name === 'NotAllowedError') {
            onError?.('Microphone access denied. Please allow microphone access in your browser settings.');
          } else if (error.name === 'NotFoundError') {
            onError?.('No microphone found. Please connect a microphone and try again.');
          } else {
            onError?.(`Microphone error: ${error.message}`);
          }
        } else {
          onError?.('Failed to access microphone. Please check your browser permissions.');
        }
        
        onPitchDetected([]);
      }
    }

    function detectPitch() {
      if (!analyserRef.current || !audioContextRef.current) return;
      
      const frequencyDataDb = new Float32Array(analyserRef.current.frequencyBinCount);
      const timeDomainData = new Float32Array(analyserRef.current.fftSize);
      analyserRef.current.getFloatFrequencyData(frequencyDataDb);
      analyserRef.current.getFloatTimeDomainData(timeDomainData);

      const { pitches, magnitudes } = analyzePitchFrame(
        frequencyDataDb,
        timeDomainData,
        audioContextRef.current.sampleRate
      );

      onPitchDetected(pitches);

      if (onWaveformData) {
        const fftSize = analyserRef.current.fftSize;
        const sampleRate = audioContextRef.current.sampleRate;

        noteStrings.forEach(note => {
          const magnitude = getMagnitudeForNote(magnitudes, note, sampleRate, fftSize);
          const history = waveformHistoryRef.current[note];
          history.shift();
          history.push(magnitude);
        });

        onWaveformData(waveformHistoryRef.current);
      }

      rafIdRef.current = requestAnimationFrame(detectPitch);
    }

    setupAudio();

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [isActive, onPitchDetected, onWaveformData, onError, monitorVolume]);

  return null;
}