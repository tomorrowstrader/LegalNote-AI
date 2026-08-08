/** Cross-component signals for mobile chrome (bottom nav ↔ search / voice). */

export const OPEN_GLOBAL_SEARCH_EVENT = "legalnote:open-global-search";
export const OPEN_VOICE_COMMAND_EVENT = "legalnote:open-voice-command";

export function openGlobalSearch() {
  window.dispatchEvent(new CustomEvent(OPEN_GLOBAL_SEARCH_EVENT));
}

export function openVoiceCommand() {
  window.dispatchEvent(new CustomEvent(OPEN_VOICE_COMMAND_EVENT));
}
