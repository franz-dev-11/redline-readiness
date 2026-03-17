/**
 * VoiceCommandService
 *
 * Architecture:
 *   STT  : Web Speech API (SpeechRecognition) -- continuous, interim results
 *          for near-instant command matching. Pre-warmed on init so start()
 *          has zero setup cost.
 *   TTS  : Kokoro-82M (kokoro-js) loaded in-browser via dynamic import.
 *          Falls back to browser speechSynthesis while the model loads.
 *
 * Singleton exported at the bottom.
 */

// Service class

class VoiceCommandService {
  constructor() {
    this._isListening         = false;
    this._suppressCommands    = false;
    this._ignoreCommandsUntil = 0;

    this._speakQueue      = [];
    this._speakingNow     = false;
    this._statusListeners = [];
    this._supported       = false;

    // Command registry: normalised phrase -> guarded action.
    this._commandActions = new Map();

    // SpeechRecognition
    this._recognition           = null;
    this._lastMatchedTranscript = '';

    // Kokoro TTS
    this._tts        = null;
    this._ttsLoading = false;
    this._ttsCtx     = null;

    this._init();
  }

  // Init

  _init() {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    this._supported = true;
    this._initRecognition(SR);
    this._ensureTTS(); // preload Kokoro in background
  }

  // SpeechRecognition

  _initRecognition(SR) {
    const rec = new SR();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text   = result[0].transcript.trim().toLowerCase();

        if (result.isFinal) {
          this._lastMatchedTranscript = ''; // reset guard on new utterance
          this._notifyStatus({ type: 'transcript', text, isFinal: true });
        } else {
          this._notifyStatus({ type: 'transcript', text, isFinal: false });
        }

        // Match on both interim and final -- whichever comes first.
        if (this._isListening && !this._suppressCommands && Date.now() >= this._ignoreCommandsUntil) {
          this._matchCommand(text);
        }
      }
    };

    rec.onstart = () => {
      if (this._isListening) this._notifyStatus({ type: 'started' });
    };

    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'permission-denied') {
        this._isListening = false;
        this._notifyStatus({ type: 'error', error: 'mic-denied' });
      }
      // 'no-speech' and 'network' are non-fatal -- onend will restart.
    };

    // Keep recognition alive continuously.
    rec.onend = () => setTimeout(() => { try { rec.start(); } catch {} }, 100);

    this._recognition = rec;
    try { rec.start(); } catch {} // pre-warm so first start() is instant
  }

  _matchCommand(text) {
    // Skip if this transcript already fired a command (avoids repeated firing
    // as interim results stream in with slight changes).
    if (text === this._lastMatchedTranscript) return;

    for (const [phrase, action] of this._commandActions) {
      if (text.includes(phrase)) {
        this._lastMatchedTranscript = text;
        this._notifyStatus({ type: 'command-matched' });
        action();
        return;
      }
    }
  }

  // Public API -- commands

  setCommands(commands) {
    this._commandActions.clear();
    for (const { phrase, action } of commands) {
      const normalized = String(phrase || '').toLowerCase().trim();
      if (!normalized || this._commandActions.has(normalized)) continue;
      this._commandActions.set(normalized, () => {
        if (this._suppressCommands || Date.now() < this._ignoreCommandsUntil) return;
        action();
      });
    }
  }

  // Public API -- listening control

  start() {
    if (!this._supported || this._isListening) return;
    this._isListening           = true;
    this._suppressCommands      = false;
    this._ignoreCommandsUntil   = 0;
    this._lastMatchedTranscript = '';
    // Recognition is already running (pre-warmed) -- just flip the flag.
    this._notifyStatus({ type: 'started' });
  }

  stop() {
    if (!this._supported) return;
    this._isListening         = false;
    this._suppressCommands    = false;
    this._ignoreCommandsUntil = 0;
    this._notifyStatus({ type: 'stopped' });
  }

  // TTS -- Kokoro-82M (WebGPU → CPU q8 fallback)

  async _ensureTTS() {
    if (this._tts) return this._tts;
    if (this._ttsLoading) return null; // use speechSynthesis this time
    this._ttsLoading = true;
    this._notifyStatus({ type: 'tts-loading', loading: true });
    try {
      const { KokoroTTS } = await import('kokoro-js');
      const webgpuAvailable = typeof navigator !== 'undefined' && !!navigator.gpu;

      if (webgpuAvailable) {
        try {
          this._tts = await KokoroTTS.from_pretrained(
            'onnx-community/Kokoro-82M-v1.0-ONNX',
            { device: 'webgpu', dtype: 'fp32' },
          );
          console.info('[VoiceCommandService] Kokoro running on WebGPU (fp32)');
        } catch (gpuErr) {
          console.warn('[VoiceCommandService] WebGPU unavailable, falling back to CPU q8:', gpuErr);
          this._tts = await KokoroTTS.from_pretrained(
            'onnx-community/Kokoro-82M-v1.0-ONNX',
            { dtype: 'q8' },
          );
          console.info('[VoiceCommandService] Kokoro running on CPU (q8)');
        }
      } else {
        this._tts = await KokoroTTS.from_pretrained(
          'onnx-community/Kokoro-82M-v1.0-ONNX',
          { dtype: 'q8' },
        );
        console.info('[VoiceCommandService] Kokoro running on CPU (q8) — WebGPU not available');
      }
    } catch (err) {
      console.warn('[VoiceCommandService] Kokoro load error:', err);
    } finally {
      this._ttsLoading = false;
      this._notifyStatus({ type: 'tts-loading', loading: false });
    }
    return this._tts;
  }

  _playPCM(samples, sampleRate) {
    return new Promise((resolve) => {
      if (!this._ttsCtx || this._ttsCtx.state === 'closed') {
        this._ttsCtx = new AudioContext();
      }
      const ctx    = this._ttsCtx;
      const buffer = ctx.createBuffer(1, samples.length, sampleRate);
      buffer.copyToChannel(samples, 0);
      const src = ctx.createBufferSource();
      src.buffer  = buffer;
      src.connect(ctx.destination);
      src.onended = resolve;
      src.start();
    });
  }

  _speakFallback(text) {
    // Kokoro only: no fallback
    return Promise.resolve();
  }

  speak(text, interrupt = false, suppress = true) {
    if (interrupt) {
      this._speakQueue  = [];
      this._speakingNow = false;
      // Kokoro only: no speechSynthesis cancel
    }
    this._speakQueue.push({ text, suppress });
    if (!this._speakingNow) this._processQueue();
  }

  async _processQueue() {
    if (!this._speakQueue.length) return;

    const { text, suppress } = this._speakQueue.shift();
    this._speakingNow      = true;
    this._suppressCommands = suppress;

    try {
      const tts = await this._ensureTTS();
      if (tts) {
        const audio = await tts.generate(text, { voice: 'af_heart' });
        await this._playPCM(audio.audio, audio.sampling_rate);
      }
      // Kokoro only: no fallback
    } catch {
      // Kokoro only: no fallback
    } finally {
      this._speakingNow = false;
    }

    if (this._speakQueue.length > 0) {
      this._processQueue();
    } else {
      this._ignoreCommandsUntil = Date.now() + 200;
      this._suppressCommands    = false;
    }
  }

  cancelSpeech() {
    this._speakQueue  = [];
    this._speakingNow = false;
    // Kokoro only: no speechSynthesis cancel
    if (this._ttsCtx) { this._ttsCtx.close().catch(() => {}); this._ttsCtx = null; }
  }

  // Misc public API

  isSupported()    { return this._supported; }
  getIsListening() { return this._isListening; }

  subscribe(listener) {
    this._statusListeners.push(listener);
    return () => {
      this._statusListeners = this._statusListeners.filter(l => l !== listener);
    };
  }

  _notifyStatus(status) {
    this._statusListeners.forEach(l => l(status));
  }
}

export default new VoiceCommandService();
