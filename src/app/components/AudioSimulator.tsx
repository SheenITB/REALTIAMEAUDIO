import { useEffect, useRef } from 'react';
import { PitchData } from './PitchDetector';

interface AudioSimulatorProps {
  onPitchDetected: (pitches: PitchData[]) => void;
  onWaveformData?: (waveformData: Record<string, number[]>) => void;
  isActive: boolean;
}

const noteStrings = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Piano chord progression at 90 BPM
const BPM = 90;
const BEAT_DURATION = 60 / BPM; // 0.667 seconds per beat

// Chord progression: C Major -> A minor -> F Major -> G Major
const chordProgression = [
  { 
    name: 'C Major',
    notes: [
      { freq: 261.63, note: 'C', octave: 4 }, // C4
      { freq: 329.63, note: 'E', octave: 4 }, // E4
      { freq: 392.00, note: 'G', octave: 4 }, // G4
    ],
    duration: 2 // 2 beats
  },
  { 
    name: 'A minor',
    notes: [
      { freq: 220.00, note: 'A', octave: 3 }, // A3
      { freq: 261.63, note: 'C', octave: 4 }, // C4
      { freq: 329.63, note: 'E', octave: 4 }, // E4
    ],
    duration: 2 // 2 beats
  },
  { 
    name: 'F Major',
    notes: [
      { freq: 174.61, note: 'F', octave: 3 }, // F3
      { freq: 220.00, note: 'A', octave: 3 }, // A3
      { freq: 261.63, note: 'C', octave: 4 }, // C4
    ],
    duration: 2 // 2 beats
  },
  { 
    name: 'G Major',
    notes: [
      { freq: 196.00, note: 'G', octave: 3 }, // G3
      { freq: 246.94, note: 'B', octave: 3 }, // B3
      { freq: 293.66, note: 'D', octave: 4 }, // D4
    ],
    duration: 2 // 2 beats
  },
];

function frequencyToNote(frequency: number, magnitude?: number): PitchData {
  const A4 = 440;
  const A4_INDEX = 57;
  
  const halfStepsFromA4 = 12 * Math.log2(frequency / A4);
  const noteIndex = Math.round(halfStepsFromA4) + A4_INDEX;
  
  const octave = Math.floor(noteIndex / 12);
  const note = noteStrings[noteIndex % 12];
  
  const perfectFreq = A4 * Math.pow(2, (noteIndex - A4_INDEX) / 12);
  const cents = Math.floor(1200 * Math.log2(frequency / perfectFreq));
  
  return { frequency, note, octave, cents, magnitude };
}

export function AudioSimulator({ onPitchDetected, onWaveformData, isActive }: AudioSimulatorProps) {
  const rafIdRef = useRef<number | null>(null);
  const timeRef = useRef<number>(0);
  const chordStartTimeRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorsRef = useRef<Map<string, { osc: OscillatorNode, gain: GainNode }>>(new Map());
  const waveformHistoryRef = useRef<Record<string, number[]>>(
    noteStrings.reduce((acc, note) => {
      acc[note] = new Array(120).fill(0);
      return acc;
    }, {} as Record<string, number[]>)
  );

  useEffect(() => {
    if (!isActive) {
      // Stop all oscillators
      oscillatorsRef.current.forEach(({ osc, gain }) => {
        gain.gain.setTargetAtTime(0, audioContextRef.current?.currentTime || 0, 0.1);
        setTimeout(() => {
          osc.stop();
          osc.disconnect();
          gain.disconnect();
        }, 500);
      });
      oscillatorsRef.current.clear();
      
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      onPitchDetected([]);
      onWaveformData?.(noteStrings.reduce((acc, note) => {
        acc[note] = new Array(120).fill(0);
        return acc;
      }, {} as Record<string, number[]>));
      timeRef.current = 0;
      chordStartTimeRef.current = 0;
      return;
    }

    // Initialize audio context
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }

    let lastTime = Date.now();
    let currentChordIndex = 0;
    chordStartTimeRef.current = 0;

    function simulate() {
      const now = Date.now();
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;
      
      timeRef.current += deltaTime;
      
      // Calculate total progression duration
      let totalProgressionDuration = 0;
      chordProgression.forEach(chord => {
        totalProgressionDuration += chord.duration * BEAT_DURATION;
      });
      
      // Find current chord
      const progressTime = timeRef.current % totalProgressionDuration;
      let accumulatedTime = 0;
      let newChordIndex = 0;
      
      for (let i = 0; i < chordProgression.length; i++) {
        const chordDuration = chordProgression[i].duration * BEAT_DURATION;
        if (progressTime >= accumulatedTime && progressTime < accumulatedTime + chordDuration) {
          newChordIndex = i;
          chordStartTimeRef.current = accumulatedTime;
          break;
        }
        accumulatedTime += chordDuration;
      }
      
      currentChordIndex = newChordIndex;
      const currentChord = chordProgression[currentChordIndex];
      const timeInChord = progressTime - chordStartTimeRef.current;
      
      // Piano ADSR envelope
      const attackTime = 0.05;  // 50ms attack
      const decayTime = 0.3;    // 300ms decay
      const sustainLevel = 0.6; // 60% sustain level
      const releaseTime = 0.5;  // 500ms release
      
      let envelope = 1.0;
      if (timeInChord < attackTime) {
        // Attack phase
        envelope = timeInChord / attackTime;
      } else if (timeInChord < attackTime + decayTime) {
        // Decay phase
        const decayProgress = (timeInChord - attackTime) / decayTime;
        envelope = 1.0 - (1.0 - sustainLevel) * decayProgress;
      } else {
        // Sustain phase with slow decay (piano damping)
        const sustainTime = timeInChord - attackTime - decayTime;
        envelope = sustainLevel * Math.exp(-sustainTime * 0.8); // Exponential decay
      }
      
      // Generate chord notes with envelope and slight detuning
      const pitches: PitchData[] = currentChord.notes.map(({ freq, note, octave }, index) => {
        // Add very slight random detuning (like real piano strings)
        const detune = Math.sin(timeRef.current * 0.3 + index) * 0.5; // ±0.5 Hz
        const magnitude = envelope * (0.7 + index * 0.1); // Slight variation per note
        
        return frequencyToNote(freq + detune, magnitude);
      }).sort((a, b) => (b.magnitude || 0) - (a.magnitude || 0));

      // Update audio synthesis
      if (audioContextRef.current) {
        const ctx = audioContextRef.current;
        const currentNoteKeys = new Set(currentChord.notes.map(n => `${n.note}${n.octave}`));
        
        // Stop notes that are no longer in the chord
        oscillatorsRef.current.forEach(({ osc, gain }, key) => {
          if (!currentNoteKeys.has(key)) {
            gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
            setTimeout(() => {
              osc.stop();
              osc.disconnect();
              gain.disconnect();
              oscillatorsRef.current.delete(key);
            }, 500);
          }
        });
        
        // Create or update oscillators for current chord
        currentChord.notes.forEach(({ freq, note, octave }) => {
          const key = `${note}${octave}`;
          
          if (!oscillatorsRef.current.has(key)) {
            // Create new oscillator with piano-like timbre
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            // Piano timbre: mix of sine and triangle waves
            osc.type = 'triangle'; // Richer than sine, softer than square
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            
            // Connect: oscillator -> gain -> destination
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            // Initial volume (will be updated in animation loop)
            gain.gain.setValueAtTime(0, ctx.currentTime);
            
            osc.start();
            oscillatorsRef.current.set(key, { osc, gain });
          }
          
          // Update gain with envelope
          const oscData = oscillatorsRef.current.get(key);
          if (oscData) {
            const volume = envelope * 0.15; // Master volume (15% to avoid clipping)
            oscData.gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
          }
        });
      }

      onPitchDetected(pitches);

      // Update waveform data with envelope
      if (onWaveformData) {
        const newWaveformData = { ...waveformHistoryRef.current };
        
        noteStrings.forEach((note) => {
          const matchingPitch = pitches.find(p => p.note === note);
          const targetMagnitude = matchingPitch 
            ? (matchingPitch.magnitude || 0) * 255
            : 0;
          
          // Piano-like smooth transition
          const currentValue = newWaveformData[note][newWaveformData[note].length - 1] || 0;
          const newValue = currentValue * 0.92 + targetMagnitude * 0.08;
          
          // Shift array and add new value
          newWaveformData[note] = [...newWaveformData[note].slice(1), newValue];
        });
        
        waveformHistoryRef.current = newWaveformData;
        onWaveformData(newWaveformData);
      }

      rafIdRef.current = requestAnimationFrame(simulate);
    }

    simulate();

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isActive, onPitchDetected, onWaveformData]);

  return null;
}