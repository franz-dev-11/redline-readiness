export function normalizeAccessibilitySettings(rawSettings = {}) {
  return {
    screenReader: Boolean(rawSettings?.screenReader),
    highContrast: Boolean(rawSettings?.highContrast),
    largeText: Boolean(rawSettings?.largeText),
  };
}

export function getAccessibilityContainerProps(rawSettings = {}) {
  const settings = normalizeAccessibilitySettings(rawSettings);

  return {
    style: {
      fontSize: settings.largeText ? "1.06rem" : "1rem",
      filter: settings.highContrast ? "contrast(1.25)" : "none",
    },
    ariaLive: settings.screenReader ? "polite" : undefined,
  };
}
