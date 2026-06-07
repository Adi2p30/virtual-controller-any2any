# Windows keyboard scancodes (Set 1) for the keys we care about.
# We inject with KEYEVENTF_SCANCODE so DirectInput games (which read scancodes
# rather than virtual-key codes) see the presses. Keys in EXTENDED need the
# KEYEVENTF_EXTENDEDKEY flag (arrows, right-hand modifiers, etc.).
#
# Reference: https://learn.microsoft.com/windows/win32/inputdev/about-keyboard-input
SCANCODES = {
    "a": 0x1E, "b": 0x30, "c": 0x2E, "d": 0x20, "e": 0x12, "f": 0x21,
    "g": 0x22, "h": 0x23, "i": 0x17, "j": 0x24, "k": 0x25, "l": 0x26,
    "m": 0x32, "n": 0x31, "o": 0x18, "p": 0x19, "q": 0x10, "r": 0x13,
    "s": 0x1F, "t": 0x14, "u": 0x16, "v": 0x2F, "w": 0x11, "x": 0x2D,
    "y": 0x15, "z": 0x2C,
    "1": 0x02, "2": 0x03, "3": 0x04, "4": 0x05, "5": 0x06, "6": 0x07,
    "7": 0x08, "8": 0x09, "9": 0x0A, "0": 0x0B,
    "return": 0x1C, "enter": 0x1C, "tab": 0x0F, "space": 0x39,
    "delete": 0x0E,  # Backspace (matches the mac map's "delete")
    "escape": 0x01, "esc": 0x01,
    "shift": 0x2A, "control": 0x1D, "ctrl": 0x1D, "option": 0x38,
    "alt": 0x38, "command": 0x5B, "cmd": 0x5B,
    "left": 0x4B, "right": 0x4D, "down": 0x50, "up": 0x48,
}

# Scancodes that must carry the extended-key flag (E0 prefix).
EXTENDED = {"left", "right", "down", "up", "command", "cmd"}
