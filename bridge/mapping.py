# Editable mapping from controller state -> macOS input.
#
# Buttons map to keyboard keys (or the special "mouse:left"/"mouse:right").
# Left stick drives WASD-style digital keys past a deadzone.
# Right stick drives the mouse cursor (continuous, in the bridge's apply loop).
# Triggers map to keys/mouse buttons once they cross a threshold.
#
# Key names are looked up in KEYCODES (bridge/keycodes.py). Add more there.

# --- buttons -> key name (see keycodes.py) or "mouse:left" / "mouse:right" ---
BUTTON_MAP = {
    "A": "space",
    "B": "shift",
    "X": "e",
    "Y": "f",
    "LB": "q",
    "RB": "r",
    "LS": "c",
    "RS": "mouse:right",
    "Back": "tab",
    "Start": "escape",
    "Guide": "g",
    "DPadUp": "up",
    "DPadDown": "down",
    "DPadLeft": "left",
    "DPadRight": "right",
}

# --- left stick -> digital keys (WASD). Pressed when axis past LSTICK_DEADZONE ---
LEFT_STICK_KEYS = {
    "up": "w",     # y < -deadzone   (stick up = negative y)
    "down": "s",   # y >  deadzone
    "left": "a",   # x < -deadzone
    "right": "d",  # x >  deadzone
}
LSTICK_DEADZONE = 0.5

# --- right stick -> mouse movement ---
RSTICK_DEADZONE = 0.12
MOUSE_SENSITIVITY = 18.0   # pixels per apply-tick at full deflection
MOUSE_TICK_HZ = 250.0      # how often the mouse position is updated

# --- triggers -> key/mouse, fire once past threshold ---
TRIGGER_MAP = {
    "LT": "mouse:right",
    "RT": "mouse:left",
}
TRIGGER_THRESHOLD = 0.5
