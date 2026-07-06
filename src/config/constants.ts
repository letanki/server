export const INVITE_CODE_LENGTH = 5;
export const INVITE_CODE_CHARACTERS = "0123456789abcdef";

export const DEFAULT_PORT = 1337;
export const DEFAULT_MAX_CLIENTS = 10;

/**
 * In-game web panel (HTMLLoader) defaults. The server tells the client which URL/size/position
 * to open via the OpenWebPanel packet, so the host lives here (not hardcoded in the SWF patch).
 * x/y = -1 → the client centers the panel on the stage. Override URL with the WEBPANEL_URL env.
 */
export const WEBPANEL = {
  URL: process.env.WEBPANEL_URL || "http://127.0.0.1:9999/panel",
  WIDTH: 380,
  HEIGHT: 320,
  X: -1,
  Y: -1,
};

export const CALLBACK = {
  LOGIN_FORM: 3,
  GARAGE_DATA: 4,
  LOBBY_DATA: 5,
  BATTLE_MAP_LIBS_LOADED: 6,
  BATTLE_SKYBOX_LOADED: 7,
  BATTLE_MAP_GEOMETRY_LOADED: 8,
  BATTLE_GENERAL_RESOURCES_LOADED: 9,
  BATTLE_PLAYER_EQUIPMENT_LOADED: 10,
  TIPS_LOADED: 11,
};