#!/usr/bin/env python3
"""mac_bridge.py  macOS entrypoint for the controller bridge.

Thin wrapper that runs bridge.py with the platform fixed to "mac". The shared
loop lives in bridge.py; the macOS input backend lives in input_backends.py.

    python3 mac_bridge.py --server http://localhost:3000 --verbose

Equivalent to: python3 bridge.py --platform mac ...
"""

import bridge

if __name__ == "__main__":
    bridge.main(default_platform="mac")
