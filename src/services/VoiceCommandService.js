import createVoice, { JSVoice } from "jsvoice";

/**
 * VoiceCommandService - Manages voice recognition and speech synthesis
 * for accessibility support (visually impaired users).
 *
 * Uses JSVoice (Web Speech API wrapper) for recognition and command matching.
 * Web Speech API SpeechSynthesis is used directly for TTS so we can apply
 * echo-suppression via onend timing.
 *
 * Singleton instance exported at the bottom.
 */
class VoiceCommandService {
  constructor() {
    // SpeechSynthesis stays direct so we control onend timing for
    // the TTS echo-suppression mechanism.
    this._synthesis =
      typeof window !== "undefined" ? window.speechSynthesis : null;
    this._isListening = false;
    // While TTS is playing, mic stays open but command matching is muted
    // to prevent the assistant's own voice from triggering commands.
    this._suppressCommands = false;
    this._ignoreCommandsUntil = 0;
    this._statusListeners = [];
    this._supported = false;
    this._voice = null;
    // Track phrases currently registered with JSVoice so we can cleanly
    // swap the command set when the active view changes.
    this._registeredPhrases = new Set();
    this._init();
  }

  _init() {
    if (typeof window === "undefined") return;
    if (!JSVoice.isApiSupported) return;

    this._supported = true;

    this._voice = createVoice({
      continuous: true,
      interimResults: true,
      lang: "en-US",
      autoRestart: true,
      restartDelay: 300,

      // Fires when JSVoice matched a registered command phrase.
      onCommandRecognized: (phrase, raw) => {
        const text = String(raw || phrase || "")
          .trim()
          .toLowerCase();
        if (text) {
          this._notifyStatus({ type: "transcript", text, isFinal: true });
        }
        this._notifyStatus({ type: "command-matched" });
      },

      // Fires for speech that didn't match any registered command.
      onCommandNotRecognized: (raw) => {
        const text = String(raw || "")
          .trim()
          .toLowerCase();
        if (text) {
          this._notifyStatus({ type: "transcript", text, isFinal: true });
        }
      },

      onMicrophonePermissionDenied: () => {
        this._isListening = false;
        this._notifyStatus({ type: "error", error: "mic-denied" });
      },

      onError: (error) => {
        const msg = String(error || "").toLowerCase();
        if (msg.includes("not-allowed") || msg.includes("permission")) {
          this._isListening = false;
          this._notifyStatus({ type: "error", error: "mic-denied" });
        }
        // Other errors (network glitches, etc.) are handled by autoRestart.
      },
    });
  }

  /**
   * Replace the active command set.
   * Removes all previously registered JSVoice commands, then registers the
   * new set.  Each action is wrapped to honour the TTS suppression window.
   * @param {Array<{phrase: string, label: string, action: Function}>} commands
   */
  setCommands(commands) {
    if (!this._voice) return;

    for (const phrase of this._registeredPhrases) {
      try {
        this._voice.removeCommand(phrase);
      } catch {
        // Ignore removal errors (phrase may not exist any more).
      }
    }
    this._registeredPhrases.clear();

    for (const { phrase, action } of commands) {
      const normalized = String(phrase || "")
        .toLowerCase()
        .trim();
      if (!normalized || this._registeredPhrases.has(normalized)) continue;

      this._voice.addCommand(normalized, () => {
        if (this._suppressCommands || Date.now() < this._ignoreCommandsUntil) {
          return;
        }
        action();
      });
      this._registeredPhrases.add(normalized);
    }
  }

  /** Start listening for voice commands. */
  async start() {
    if (!this._supported || this._isListening) return;
    this._isListening = true;
    this._suppressCommands = false;
    this._ignoreCommandsUntil = 0;
    try {
      await this._voice.start();
      this._notifyStatus({ type: "started" });
    } catch {
      this._isListening = false;
      this._notifyStatus({ type: "error", error: "mic-denied" });
    }
  }

  /** Stop listening for voice commands. */
  stop() {
    if (!this._supported) return;
    this._isListening = false;
    this._suppressCommands = false;
    this._ignoreCommandsUntil = 0;
    try {
      this._voice.stop();
    } catch {
      // Ignore stop errors.
    }
    this._notifyStatus({ type: "stopped" });
  }

  /**
   * Speak text via TTS.  The mic stays open; command matching is suppressed
   * while speech plays and for 1800 ms after it ends to prevent echo-matching.
   * @param {string} text
   * @param {boolean} [interrupt=false] Cancel any current speech first.
   */
  speak(text, interrupt = false) {
    if (!this._synthesis) return;
    if (interrupt) this._synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    this._suppressCommands = true;

    utterance.onend = () => {
      this._ignoreCommandsUntil = Date.now() + 1800;
      setTimeout(() => {
        this._suppressCommands = false;
      }, 400);
    };
    utterance.onerror = () => {
      this._suppressCommands = false;
      this._ignoreCommandsUntil = 0;
    };

    this._synthesis.speak(utterance);
  }

  /** Cancel any in-progress TTS speech. */
  cancelSpeech() {
    if (this._synthesis) this._synthesis.cancel();
  }

  /** @returns {boolean} Whether JSVoice / Web Speech API is available */
  isSupported() {
    return this._supported;
  }

  /** @returns {boolean} Whether currently listening */
  getIsListening() {
    return this._isListening;
  }

  /**
   * Subscribe to service events: started | stopped | transcript |
   * command-matched | error.
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
