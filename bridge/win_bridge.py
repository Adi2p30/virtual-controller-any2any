#!/usr/bin/env python3
"""win_bridge.py  Windows entrypoint for the controller bridge.

Thin wrapper that runs bridge.py with the platform fixed to "windows". The
shared loop lives in bridge.py; the Windows input backend (ctypes SendInput
with keyboard scancodes) lives in input_backends.py.

    python win_bridge.py --server http://localhost:3000 --verbose

Equivalent to: python bridge.py --platform windows ...

No extra dependencies: SendInput is reached through ctypes from the stdlib, so
nothing in requirements.txt is needed on Windows. Some anti-cheat-protected
games block injected input  that's expected; ordinary games and apps work.
"""

import bridge

if __name__ == "__main__":
    bridge.main(default_platform="windows")
