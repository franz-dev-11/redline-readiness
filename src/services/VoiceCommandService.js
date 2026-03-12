/**
 * VoiceCommandService - Manages voice recognition and speech synthesis
 * for accessibility support (visually impaired users).
 *
 * Uses the Web Speech API (SpeechRecognition + SpeechSynthesis).
 * Singleton instance exported at the bottom.
 */
class VoiceCommandService {
  constructor() {
    this._recognition = null;
    this._synthesis =
      typeof window !== "undefined" ? window.speechSynthesis : null;
    this._isListening = false;
    // When TTS is playing we suppress command matching (mic stays open).
    // This avoids the stop/start race that caused recognition to go silent.
    this._suppressCommands = false;
    this._restartTimer = null;
    this._commands = [];
    this._statusListeners = [];
    this._supported = false;
    this._init();
  }

  _init() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    this._supported = true;
    this._recognition = new SpeechRecognition();
    this._recognition.continuous = true;
    this._recognition.interimResults = true;
    this._recognition.lang = "en-US";
    this._recognition.maxAlternatives = 1;

    this._recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript.trim().toLowerCase();

      this._notifyStatus({
        type: "transcript",
        text: transcript,
        isFinal: result.isFinal,
      });

      if (result.isFinal) {
        this._processCommand(transcript);
      }
    };

    this._recognition.onend = () => {
      if (this._isListening) {
        // Auto-restart — delay 250 ms so the browser is fully idle
        if (this._restartTimer) clearTimeout(this._restartTimer);
        this._restartTimer = setTimeout(() => {
          if (this._isListening) {
            try { this._recognition.start(); } catch { /* ok */ }
          }
        }, 250);
      } else {
        this._notifyStatus({ type: "stopped" });
      }
    };

    this._recognition.onerror = (event) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed") {
        this._isListening = false;
        this._notifyStatus({ type: "error", error: "mic-denied" });
        return;
      }
      this._notifyStatus({ type: "error", error: event.error });
    };
  }

  /**
   * Match a finalized transcript against registered commands.
   * Picks the most specific (longest phrase) match.
   * @param {string} transcript
   */
  _processCommand(transcript) {
    let bestMatch = null;
    let bestScore = 0;

    for (const { phrase, action } of this._commands) {
      if (transcript.includes(phrase)) {
        const score = phrase.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = action;
        }
      }
    }

    if (bestMatch) {
      this._notifyStatus({ type: "command-matched" });
      if (!this._suppressCommands) {
        bestMatch();
      }
    }
  }

  /**
   * Replace the current command set entirely.
   * @param {Array<{phrase: string, label: string, action: Function}>} commands
   */
  setCommands(commands) {
    this._commands = commands.map((cmd) => ({
      ...cmd,
      phrase: cmd.phrase.toLowerCase().trim(),
    }));
  }

  /** Start listening for voice commands. */
  start() {
    if (!this._supported || this._isListening) return;
    this._isListening = true;
    this._suppressCommands = false;
    try {
      this._recognition.start();
    } catch { /* already started */ }
    this._notifyStatus({ type: "started" });
  }

  /** Stop listening for voice commands. */
  stop() {
    if (!this._supported) return;
    this._isListening = false;
    this._suppressCommands = false;
    if (this._restartTimer) {
      clearTimeout(this._restartTimer);
      this._restartTimer = null;
    }
    try {
      this._recognition.stop();
    } catch { /* already stopped */ }
    this._notifyStatus({ type: "stopped" });
  }

  /**
   * Speak text via TTS. Recognition stays running; commands are suppressed
   * while speech is playing so the mic cannot trigger a command echo.
   * @param {string} text
   * @param {boolean} [interrupt=false] - Cancel current speech first
   */
  speak(text, interrupt = false) {
    if (!this._synthesis) return;
    if (interrupt) this._synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Suppress command matching while TTS plays (mic stays open)
    this._suppressCommands = true;

    utterance.onend = () => {
      // Short buffer after speech ends before accepting commands again
      setTimeout(() => { this._suppressCommands = false; }, 400);
    };
    utterance.onerror = () => {
      this._suppressCommands = false;
    };

    this._synthesis.speak(utterance);
  }

  /** Cancel any in-progress speech. */
  cancelSpeech() {
    if (this._synthesis) this._synthesis.cancel();
  }

  /** @returns {boolean} Whether the Web Speech API is available */
  isSupported() {
    return this._supported;
  }

  /** @returns {boolean} Whether currently listening */
  getIsListening() {
    return this._isListening;
  }

  /**
   * Subscribe to service events (started, stopped, transcript, command-matched, error).
   * @param {Function} listener
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    this._statusListeners.push(listener);
    return () => {
      this._statusListeners = this._statusListeners.filter(
        (l) => l !== listener,
      );
    };
  }

  _notifyStatus(status) {
    this._statusListeners.forEach((l) => l(status));
  }
}

export default new VoiceCommandService();
