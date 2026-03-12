import React, { useState, useEffect, useCallback, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
  faQuestion,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import VoiceCommandService from "../services/VoiceCommandService";
import ViewManager from "../services/ViewManager";

// ---------------------------------------------------------------------------
// Page descriptions read aloud when the user says "read page" / "describe page"
// ---------------------------------------------------------------------------
const PAGE_DESCRIPTIONS = {
  selection:
    "You are on the Redline Readiness Portal home page. Say resident to open the resident portal, or say government to open the government portal.",
  "resident-auth-selection":
    "You are on the resident account selection page. Say individual for an individual account, or say family for a family account. Say go back to return to the main page.",
  "individual-login":
    "Individual resident login page. Enter your email and password to log in. Say register to create a new account, or say go back to return.",
  "family-login":
    "Family account login page. Enter your family email and password. Say register to create a new account, or say go back to return.",
  "gov-login":
    "Government portal login page. Enter your credentials to access the government dashboard. Say register to create a government account, or say go back.",
  "gov-register":
    "Government registration page. Fill in your details to create a government portal account. Say go back to return to login.",
  "individual-register":
    "Individual resident registration page. Fill in your information to create your account. Say go back to return to login.",
  "family-register":
    "Family registration page. Fill in your family information to create your account. Say go back to return to login.",
  home: "Resident dashboard. Navigate by saying: dashboard, alerts, evacuation plan, resources, contacts, or sectors. Say view profile to open your profile, or say log out to sign out.",
  "setup-profile":
    "Profile setup page. Fill in your personal information and save your profile. Say go back to return to the dashboard.",
  "family-setup-profile":
    "Family profile setup page. Add your family members and their emergency information. Say go back to return to the dashboard.",
  "view-profile":
    "Profile view page. Your personal and emergency information is displayed here. Say go back to return to the dashboard.",
  "gov-dashboard":
    "Government dashboard. You can manage evacuation plans, registered users, response teams, and reports. Say log out to sign out.",
  "gov-pending-approval":
    "Pending approval page. Your government account is currently under review by the administrator. Say go back to return to login.",
  "admin-dashboard":
    "Administrator dashboard. You have access to all system administration features.",
};

function buildHelpSpeech(commands) {
  const nonNavigationLabels = new Set([
    "Read page description",
    "Describe current page",
    "Show available commands",
    "Stop voice assistant",
  ]);

  const spokenPhrases = [];
  const seenLabels = new Set();

  commands.forEach((command) => {
    if (nonNavigationLabels.has(command.label) || seenLabels.has(command.label)) {
      return;
    }

    seenLabels.add(command.label);
    spokenPhrases.push(command.phrase);
  });

  if (spokenPhrases.length === 0) {
    return "There are no navigation commands available on this page.";
  }

  return `Available navigation commands are: ${spokenPhrases.join(", ")}.`;
}

// ---------------------------------------------------------------------------
// Build the command list for a given view
// ---------------------------------------------------------------------------
function buildCommandsForView(view) {
  const speak = (text) => VoiceCommandService.speak(text, true);
  let getCurrentCommandsForHelp = () => [];

  const globalCommands = [
    {
      phrase: "go to main menu",
      label: "Go to main menu",
      action: () => {
        ViewManager.goToSelection();
        speak("Opening the main menu.");
      },
    },
    {
      phrase: "main menu",
      label: "Go to main menu",
      action: () => {
        ViewManager.goToSelection();
        speak("Opening the main menu.");
      },
    },
    {
      phrase: "home page",
      label: "Go to main menu",
      action: () => {
        ViewManager.goToSelection();
        speak("Opening the home page.");
      },
    },
    {
      phrase: "resident portal",
      label: "Open Resident portal",
      action: () => {
        ViewManager.goToResidentLogin();
        speak("Opening resident portal.");
      },
    },
    {
      phrase: "government portal",
      label: "Open Government portal",
      action: () => {
        ViewManager.goToGovLogin();
        speak("Opening government portal.");
      },
    },
    {
      phrase: "resident login",
      label: "Open Resident portal",
      action: () => {
        ViewManager.goToResidentLogin();
        speak("Opening resident login choices.");
      },
    },
    {
      phrase: "government login",
      label: "Open Government portal",
      action: () => {
        ViewManager.goToGovLogin();
        speak("Opening government login.");
      },
    },
    {
      phrase: "individual login",
      label: "Open Individual login",
      action: () => {
        ViewManager.goToIndividualLogin();
        speak("Opening individual login.");
      },
    },
    {
      phrase: "family login",
      label: "Open Family login",
      action: () => {
        ViewManager.goToFamilyLogin();
        speak("Opening family login.");
      },
    },
    {
      phrase: "resident dashboard",
      label: "Open Resident dashboard",
      action: () => {
        ViewManager.goToHome();
        speak("Opening resident dashboard.");
      },
    },
    {
      phrase: "my dashboard",
      label: "Open Resident dashboard",
      action: () => {
        ViewManager.goToHome();
        speak("Opening your dashboard.");
      },
    },
    {
      phrase: "view my profile",
      label: "View profile",
      action: () => {
        ViewManager.goToViewProfile();
        speak("Opening your profile.");
      },
    },
    {
      phrase: "open profile",
      label: "View profile",
      action: () => {
        ViewManager.goToViewProfile();
        speak("Opening your profile.");
      },
    },
    {
      phrase: "setup profile",
      label: "Open profile setup",
      action: () => {
        ViewManager.goToSetupProfile();
        speak("Opening profile setup.");
      },
    },
    {
      phrase: "family profile setup",
      label: "Open family profile setup",
      action: () => {
        ViewManager.goToFamilySetupProfile();
        speak("Opening family profile setup.");
      },
    },
    {
      phrase: "go back",
      label: "Go back",
      action: () => {
        const backRoutes = {
          "resident-auth-selection": () => ViewManager.goToSelection(),
          "individual-login": () => ViewManager.goToResidentLogin(),
          "family-login": () => ViewManager.goToResidentLogin(),
          "gov-login": () => ViewManager.goToSelection(),
          "gov-register": () => ViewManager.goToGovLogin(),
          "gov-pending-approval": () => ViewManager.goToGovLogin(),
          "individual-register": () => ViewManager.goToIndividualLogin(),
          "family-register": () => ViewManager.goToFamilyLogin(),
          "setup-profile": () => ViewManager.goToHome(),
          "family-setup-profile": () => ViewManager.goToHome(),
          "view-profile": () => ViewManager.goToHome(),
          "gov-dashboard": () => ViewManager.goToSelection(),
          "admin-dashboard": () => ViewManager.goToSelection(),
        };

        const navigateBack = backRoutes[view];
        if (navigateBack) {
          navigateBack();
          speak("Going back.");
          return;
        }

        speak("There is no back action available on this page.");
      },
    },
    {
      phrase: "read page",
      label: "Read page description",
      action: () => {
        speak(PAGE_DESCRIPTIONS[view] || "You are on the current page.");
      },
    },
    {
      phrase: "describe page",
      label: "Describe current page",
      action: () => {
        speak(PAGE_DESCRIPTIONS[view] || "You are on the current page.");
      },
    },
    {
      phrase: "what page am i on",
      label: "Describe current page",
      action: () => {
        speak(PAGE_DESCRIPTIONS[view] || "You are on the current page.");
      },
    },
    {
      phrase: "help",
      label: "Show available commands",
      action: () => {
        speak(buildHelpSpeech(getCurrentCommandsForHelp()));
        window.dispatchEvent(new CustomEvent("voiceShowHelp"));
      },
    },
    {
      phrase: "stop listening",
      label: "Stop voice assistant",
      action: () => {
        VoiceCommandService.stop();
        VoiceCommandService.speak(
          "Voice assistant stopped. Press the microphone button to restart.",
        );
      },
    },
  ];

  const viewCommands = {
    selection: [
      {
        phrase: "open resident",
        label: "Open Resident portal",
        action: () => {
          ViewManager.goToResidentLogin();
          speak("Opening resident portal.");
        },
      },
      {
        phrase: "select resident",
        label: "Open Resident portal",
        action: () => {
          ViewManager.goToResidentLogin();
          speak("Opening resident portal.");
        },
      },
      {
        phrase: "resident",
        label: "Open Resident portal",
        action: () => {
          ViewManager.goToResidentLogin();
          speak("Opening resident portal.");
        },
      },
      {
        phrase: "select government",
        label: "Open Government portal",
        action: () => {
          ViewManager.goToGovLogin();
          speak("Opening government portal.");
        },
      },
      {
        phrase: "open government",
        label: "Open Government portal",
        action: () => {
          ViewManager.goToGovLogin();
          speak("Opening government portal.");
        },
      },
      {
        phrase: "government",
        label: "Open Government portal",
        action: () => {
          ViewManager.goToGovLogin();
          speak("Opening government portal.");
        },
      },
    ],

    "resident-auth-selection": [
      {
        phrase: "open individual",
        label: "Individual login",
        action: () => {
          ViewManager.goToIndividualLogin();
          speak("Opening individual login.");
        },
      },
      {
        phrase: "select individual",
        label: "Individual login",
        action: () => {
          ViewManager.goToIndividualLogin();
          speak("Opening individual login.");
        },
      },
      {
        phrase: "individual",
        label: "Individual login",
        action: () => {
          ViewManager.goToIndividualLogin();
          speak("Opening individual login.");
        },
      },
      {
        phrase: "select family",
        label: "Family login",
        action: () => {
          ViewManager.goToFamilyLogin();
          speak("Opening family login.");
        },
      },
      {
        phrase: "open family",
        label: "Family login",
        action: () => {
          ViewManager.goToFamilyLogin();
          speak("Opening family login.");
        },
      },
      {
        phrase: "family",
        label: "Family login",
        action: () => {
          ViewManager.goToFamilyLogin();
          speak("Opening family login.");
        },
      },
      {
        phrase: "go back",
        label: "Go back",
        action: () => {
          ViewManager.goToSelection();
          speak("Going back.");
        },
      },
    ],

    "individual-login": [
      {
        phrase: "open registration",
        label: "Register new account",
        action: () => {
          ViewManager.goToIndividualRegister();
          speak("Opening individual registration.");
        },
      },
      {
        phrase: "go back",
        label: "Go back",
        action: () => {
          ViewManager.goToResidentLogin();
          speak("Going back.");
        },
      },
      {
        phrase: "create account",
        label: "Register new account",
        action: () => {
          ViewManager.goToIndividualRegister();
          speak("Opening registration.");
        },
      },
      {
        phrase: "register",
        label: "Register new account",
        action: () => {
          ViewManager.goToIndividualRegister();
          speak("Opening individual registration.");
        },
      },
    ],

    "family-login": [
      {
        phrase: "open registration",
        label: "Register family account",
        action: () => {
          ViewManager.goToFamilyRegister();
          speak("Opening family registration.");
        },
      },
      {
        phrase: "go back",
        label: "Go back",
        action: () => {
          ViewManager.goToResidentLogin();
          speak("Going back.");
        },
      },
      {
        phrase: "create account",
        label: "Register family account",
        action: () => {
          ViewManager.goToFamilyRegister();
          speak("Opening family registration.");
        },
      },
      {
        phrase: "register",
        label: "Register family account",
        action: () => {
          ViewManager.goToFamilyRegister();
          speak("Opening family registration.");
        },
      },
    ],

    "gov-login": [
      {
        phrase: "open registration",
        label: "Register government account",
        action: () => {
          ViewManager.goToGovRegister();
          speak("Opening government registration.");
        },
      },
      {
        phrase: "go back",
        label: "Go back",
        action: () => {
          ViewManager.goToSelection();
          speak("Going back.");
        },
      },
      {
        phrase: "register",
        label: "Register government account",
        action: () => {
          ViewManager.goToGovRegister();
          speak("Opening government registration.");
        },
      },
    ],

    "gov-register": [
      {
        phrase: "go back",
        label: "Go back",
        action: () => {
          ViewManager.goToGovLogin();
          speak("Going back.");
        },
      },
    ],

    "individual-register": [
      {
        phrase: "go back",
        label: "Go back",
        action: () => {
          ViewManager.goToIndividualLogin();
          speak("Going back.");
        },
      },
    ],

    "family-register": [
      {
        phrase: "go back",
        label: "Go back",
        action: () => {
          ViewManager.goToFamilyLogin();
          speak("Going back.");
        },
      },
    ],

    "gov-pending-approval": [
      {
        phrase: "go back",
        label: "Go back",
        action: () => {
          ViewManager.goToGovLogin();
          speak("Going back.");
        },
      },
    ],

    "gov-dashboard": [
      {
        phrase: "log out",
        label: "Log out",
        action: () => {
          ViewManager.goToSelection();
          speak("Logged out.");
        },
      },
      {
        phrase: "sign out",
        label: "Sign out",
        action: () => {
          ViewManager.goToSelection();
          speak("Signed out.");
        },
      },
    ],

    "setup-profile": [
      {
        phrase: "go back",
        label: "Go back to dashboard",
        action: () => {
          ViewManager.goToHome();
          speak("Going back to dashboard.");
        },
      },
    ],

    "family-setup-profile": [
      {
        phrase: "go back",
        label: "Go back to dashboard",
        action: () => {
          ViewManager.goToHome();
          speak("Going back to dashboard.");
        },
      },
    ],

    "view-profile": [
      {
        phrase: "go back",
        label: "Go back to dashboard",
        action: () => {
          ViewManager.goToHome();
          speak("Going back to dashboard.");
        },
      },
    ],

    home: [
      {
        phrase: "dashboard",
        label: "Dashboard tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "dashboard" } }),
          );
          speak("Dashboard.");
        },
      },
      {
        phrase: "go to dashboard",
        label: "Dashboard tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "dashboard" } }),
          );
          speak("Dashboard.");
        },
      },
      {
        phrase: "go to alerts",
        label: "Alerts tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "alerts" } }),
          );
          speak("Alerts tab.");
        },
      },
      {
        phrase: "open alerts",
        label: "Alerts tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "alerts" } }),
          );
          speak("Alerts tab.");
        },
      },
      {
        phrase: "alerts",
        label: "Alerts tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "alerts" } }),
          );
          speak("Alerts.");
        },
      },
      {
        phrase: "go to evacuation plan",
        label: "Evacuation Plan tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", {
              detail: { tab: "evac-plan" },
            }),
          );
          speak("Evacuation plan tab.");
        },
      },
      {
        phrase: "evacuation plan",
        label: "Evacuation Plan tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", {
              detail: { tab: "evac-plan" },
            }),
          );
          speak("Evacuation plan tab.");
        },
      },
      {
        phrase: "evacuation",
        label: "Evacuation Plan tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", {
              detail: { tab: "evac-plan" },
            }),
          );
          speak("Evacuation plan.");
        },
      },
      {
        phrase: "evac",
        label: "Evacuation Plan tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", {
              detail: { tab: "evac-plan" },
            }),
          );
          speak("Evacuation plan.");
        },
      },
      {
        phrase: "open resources",
        label: "Resources tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", {
              detail: { tab: "resources" },
            }),
          );
          speak("Resources tab.");
        },
      },
      {
        phrase: "go to resources",
        label: "Resources tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", {
              detail: { tab: "resources" },
            }),
          );
          speak("Resources tab.");
        },
      },
      {
        phrase: "resources",
        label: "Resources tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", {
              detail: { tab: "resources" },
            }),
          );
          speak("Resources.");
        },
      },
      {
        phrase: "open contacts",
        label: "Contacts tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "contacts" } }),
          );
          speak("Contacts tab.");
        },
      },
      {
        phrase: "go to contacts",
        label: "Contacts tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "contacts" } }),
          );
          speak("Contacts tab.");
        },
      },
      {
        phrase: "contacts",
        label: "Contacts tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "contacts" } }),
          );
          speak("Contacts.");
        },
      },
      {
        phrase: "open sectors",
        label: "Sectors tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "sectors" } }),
          );
          speak("Sectors tab.");
        },
      },
      {
        phrase: "go to sectors",
        label: "Sectors tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "sectors" } }),
          );
          speak("Sectors tab.");
        },
      },
      {
        phrase: "sectors",
        label: "Sectors tab",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("voiceTabChange", { detail: { tab: "sectors" } }),
          );
          speak("Sectors.");
        },
      },
      {
        phrase: "view profile",
        label: "View profile",
        action: () => {
          ViewManager.goToViewProfile();
          speak("Opening your profile.");
        },
      },
      {
        phrase: "my profile",
        label: "View profile",
        action: () => {
          ViewManager.goToViewProfile();
          speak("Opening your profile.");
        },
      },
      {
        phrase: "log out",
        label: "Log out",
        action: () => {
          ViewManager.goToSelection();
          speak("Logged out.");
        },
      },
      {
        phrase: "sign out",
        label: "Sign out",
        action: () => {
          ViewManager.goToSelection();
          speak("Signed out.");
        },
      },
    ],
  };

  getCurrentCommandsForHelp = () => [
    ...(viewCommands[view] || []),
    ...globalCommands,
  ];

  return [...(viewCommands[view] || []), ...globalCommands];
}

// ---------------------------------------------------------------------------
// VoiceAssistant component
// ---------------------------------------------------------------------------
const VoiceAssistant = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showHelp, setShowHelp] = useState(false);
  const [currentView, setCurrentView] = useState(ViewManager.getCurrentView());
  const [commandMatched, setCommandMatched] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [isSupported] = useState(() => VoiceCommandService.isSupported());
  const transcriptTimerRef = useRef(null);
  const commandFeedbackTimerRef = useRef(null);

  // Request microphone permission immediately on mount so the browser prompts
  // the user right away instead of waiting for the button to be clicked.
  useEffect(() => {
    if (!isSupported) return;
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((stream) => {
        // Permission granted — release the stream immediately (Web Speech API
        // manages its own audio capture internally).
        stream.getTracks().forEach((t) => t.stop());
        setMicDenied(false);
      })
      .catch(() => {
        setMicDenied(true);
      });
  }, [isSupported]);

  // Re-register commands whenever the view changes
  useEffect(() => {
    const commands = buildCommandsForView(currentView);
    VoiceCommandService.setCommands(commands);
  }, [currentView]);

  // Subscribe to ViewManager view changes
  useEffect(() => {
    return ViewManager.subscribe((newView) => setCurrentView(newView));
  }, []);

  // Subscribe to VoiceCommandService status events
  useEffect(() => {
    return VoiceCommandService.subscribe((status) => {
      if (status.type === "started") {
        setIsListening(true);
        setMicDenied(false);
      } else if (status.type === "stopped") {
        setIsListening(false);
        setTranscript("");
      } else if (status.type === "transcript") {
        setTranscript(status.text);
        if (transcriptTimerRef.current)
          clearTimeout(transcriptTimerRef.current);
        transcriptTimerRef.current = setTimeout(() => setTranscript(""), 3000);
      } else if (status.type === "command-matched") {
        setCommandMatched(true);
        if (commandFeedbackTimerRef.current)
          clearTimeout(commandFeedbackTimerRef.current);
        commandFeedbackTimerRef.current = setTimeout(
          () => setCommandMatched(false),
          1500,
        );
      } else if (status.type === "error" && status.error === "mic-denied") {
        setIsListening(false);
        setMicDenied(true);
      }
    });
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (transcriptTimerRef.current) clearTimeout(transcriptTimerRef.current);
      if (commandFeedbackTimerRef.current)
        clearTimeout(commandFeedbackTimerRef.current);
      VoiceCommandService.stop();
    };
  }, []);

  // Listen for voiceShowHelp event dispatched by the "help" command
  useEffect(() => {
    const handler = () => setShowHelp(true);
    window.addEventListener("voiceShowHelp", handler);
    return () => window.removeEventListener("voiceShowHelp", handler);
  }, []);

  const handleToggle = useCallback(() => {
    if (isListening) {
      VoiceCommandService.stop();
      VoiceCommandService.cancelSpeech();
    } else {
      setMicDenied(false);
      VoiceCommandService.start();
      VoiceCommandService.speak(
        "Voice assistant activated. Say help for a list of available commands.",
      );
    }
  }, [isListening]);

  // Unique command labels for help panel display
  const displayCommands = Array.from(
    new Map(
      buildCommandsForView(currentView).map((c) => [c.label, c]),
    ).values(),
  );

  if (!isSupported) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "0.5rem",
        pointerEvents: "none",
      }}
      aria-live='polite'
      aria-label='Voice assistant'
    >
      {/* ---- Help panel ---- */}
      {showHelp && (
        <div
          role='dialog'
          aria-label='Available voice commands'
          style={{
            pointerEvents: "all",
            backgroundColor: "white",
            borderRadius: "1rem",
            boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
            padding: "1rem 1.1rem",
            width: "230px",
            maxHeight: "320px",
            overflowY: "auto",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.6rem",
            }}
          >
            <span
              style={{
                fontWeight: 700,
                fontSize: "0.78rem",
                color: "#1e293b",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Voice Commands
            </span>
            <button
              onClick={() => setShowHelp(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#64748b",
                padding: "2px 4px",
                borderRadius: "4px",
              }}
              aria-label='Close help panel'
            >
              <FontAwesomeIcon icon={faTimes} style={{ fontSize: "0.8rem" }} />
            </button>
          </div>

          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {displayCommands.map((cmd, i) => (
              <li
                key={i}
                style={{
                  fontSize: "0.73rem",
                  color: "#475569",
                  padding: "0.25rem 0",
                  borderBottom:
                    i < displayCommands.length - 1
                      ? "1px solid #f1f5f9"
                      : "none",
                  lineHeight: 1.4,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    color: "#dc2626",
                  }}
                >
                  &ldquo;{cmd.phrase}&rdquo;
                </span>
                {" — "}
                {cmd.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ---- Transcript bubble ---- */}
      {transcript && isListening && (
        <div
          aria-live='polite'
          style={{
            pointerEvents: "none",
            backgroundColor: commandMatched
              ? "#dcfce7"
              : "rgba(15, 23, 42, 0.85)",
            color: commandMatched ? "#166534" : "white",
            borderRadius: "2rem",
            padding: "0.4rem 0.9rem",
            fontSize: "0.74rem",
            fontWeight: 500,
            maxWidth: "200px",
            textAlign: "center",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            transition: "background-color 0.2s, color 0.2s",
          }}
        >
          {transcript}
        </div>
      )}

      {/* ---- Button row ---- */}
      <div style={{ display: "flex", gap: "0.5rem", pointerEvents: "all" }}>
        {/* Help button */}
        <button
          onClick={() => setShowHelp((s) => !s)}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "9999px",
            border: showHelp ? "2px solid #dc2626" : "2px solid #e2e8f0",
            backgroundColor: showHelp ? "#fff1f2" : "white",
            color: showHelp ? "#dc2626" : "#64748b",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            transition: "all 0.2s",
          }}
          aria-label='Show voice commands help'
          aria-pressed={showHelp}
          title='Voice commands help'
        >
          <FontAwesomeIcon icon={faQuestion} style={{ fontSize: "0.85rem" }} />
        </button>

        {/* Microphone toggle button */}
        <button
          onClick={handleToggle}
          style={{
            width: "52px",
            height: "52px",
            borderRadius: "9999px",
            border: micDenied
              ? "2px solid #f97316"
              : isListening
                ? "3px solid #ef4444"
                : "2px solid #e2e8f0",
            backgroundColor: micDenied
              ? "#fff7ed"
              : isListening
                ? "#dc2626"
                : "white",
            color: micDenied ? "#f97316" : isListening ? "white" : "#334155",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: isListening
              ? "0 0 0 6px rgba(220,38,38,0.2), 0 4px 16px rgba(220,38,38,0.3)"
              : "0 4px 16px rgba(0,0,0,0.12)",
            transition: "all 0.2s",
            animation: isListening ? "va-pulse 1.5s infinite" : "none",
          }}
          aria-label={
            micDenied
              ? "Microphone access denied — click to retry"
              : isListening
                ? "Stop voice assistant"
                : "Start voice assistant"
          }
          aria-pressed={isListening}
          title={
            micDenied
              ? "Microphone blocked. Allow microphone access in your browser then click to retry."
              : isListening
                ? 'Stop listening (or say "stop listening")'
                : "Start voice assistant"
          }
        >
          <FontAwesomeIcon
            icon={isListening ? faMicrophone : faMicrophoneSlash}
            style={{ fontSize: "1.1rem" }}
          />
        </button>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes va-pulse {
          0%   { box-shadow: 0 0 0 0   rgba(220,38,38,0.35), 0 4px 16px rgba(220,38,38,0.3); }
          70%  { box-shadow: 0 0 0 10px rgba(220,38,38,0),   0 4px 16px rgba(220,38,38,0.3); }
          100% { box-shadow: 0 0 0 0   rgba(220,38,38,0),   0 4px 16px rgba(220,38,38,0.3); }
        }
      `}</style>
    </div>
  );
};

export default VoiceAssistant;
