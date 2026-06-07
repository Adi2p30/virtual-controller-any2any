"""Platform input backends for the virtual-controller bridge.

Each backend turns abstract requests (press key "w", hold left mouse, move the
cursor by dx/dy) into real OS input events. The shared bridge loop talks only to
this interface, so adding a platform means adding a Backend subclass.

Backends:
    MacBackend      - macOS, via Quartz CGEvent (Accessibility permission).
    WindowsBackend  - Windows, via ctypes SendInput with keyboard scancodes.

Pick one with `make_backend("mac" | "windows" | "auto")`.
"""

import sys
import threading


class Backend:
    """Common edge-detection + held-state bookkeeping for all platforms.

    Subclasses implement the low-level `_key`, `_mouse_button`, and
    `_mouse_move` primitives. This base tracks what is currently held so we only
    emit down/up transitions and can release everything on shutdown.
    """

    def __init__(self, verbose=False):
        self.verbose = verbose
        self._io_lock = threading.Lock()
        self._held_keys = set()   # key *names* currently held down by us
        self._mouse_down = set()  # {"left","right"} currently held

    def log(self, *a):
        if self.verbose:
            print(*a, flush=True)

    # ---- to override ----
    def _key(self, name, down):
        """Emit a single key down/up. Return False if the key is unknown."""
        raise NotImplementedError

    def _mouse_button(self, name, down):
        raise NotImplementedError

    def _mouse_move(self, dx, dy, drag):
        """Move cursor by (dx, dy). `drag` is "left"/"right"/None if a button
        is held (so apps see a drag instead of a bare move)."""
        raise NotImplementedError

    # ---- public, edge-detected API used by the bridge loop ----
    def set_key(self, name, want_down):
        with self._io_lock:
            is_down = name in self._held_keys
            if want_down and not is_down:
                if self._key(name, True) is not False:
                    self._held_keys.add(name)
                    self.log("key down", name)
            elif not want_down and is_down:
                self._key(name, False)
                self._held_keys.discard(name)
                self.log("key up", name)

    def set_mouse(self, name, want_down):
        with self._io_lock:
            is_down = name in self._mouse_down
            if want_down and not is_down:
                self._mouse_down.add(name)  # add first so move() drags
                self._mouse_button(name, True)
                self.log("mouse down", name)
            elif not want_down and is_down:
                self._mouse_button(name, False)
                self._mouse_down.discard(name)
                self.log("mouse up", name)

    def mouse_move(self, dx, dy):
        with self._io_lock:
            drag = next(iter(self._mouse_down), None)
            self._mouse_move(dx, dy, drag)

    def apply_target(self, target, want_down):
        """target is 'none', 'mouse:left'/'mouse:right', or a key name."""
        if not target or target == "none":
            return
        if target.startswith("mouse:"):
            self.set_mouse(target.split(":", 1)[1], want_down)
        else:
            self.set_key(target, want_down)

    def release_all(self):
        with self._io_lock:
            for name in list(self._held_keys):
                self._key(name, False)
            self._held_keys.clear()
            for name in list(self._mouse_down):
                self._mouse_button(name, False)
            self._mouse_down.clear()


# --------------------------- macOS ---------------------------
class MacBackend(Backend):
    def __init__(self, verbose=False):
        super().__init__(verbose)
        import Quartz  # imported lazily so Windows never needs pyobjc
        from keycodes import KEYCODES
        self.Q = Quartz
        self.KEYCODES = KEYCODES
        self._MOUSE_BTN = {
            "left": (Quartz.kCGEventLeftMouseDown, Quartz.kCGEventLeftMouseUp,
                     Quartz.kCGMouseButtonLeft, Quartz.kCGEventLeftMouseDragged),
            "right": (Quartz.kCGEventRightMouseDown, Quartz.kCGEventRightMouseUp,
                      Quartz.kCGMouseButtonRight, Quartz.kCGEventRightMouseDragged),
        }

    def _mouse_pos(self):
        ev = self.Q.CGEventCreate(None)
        return self.Q.CGEventGetLocation(ev)

    def _key(self, name, down):
        code = self.KEYCODES.get(name)
        if code is None:
            self.log("unknown key:", name)
            return False
        ev = self.Q.CGEventCreateKeyboardEvent(None, code, down)
        self.Q.CGEventPost(self.Q.kCGHIDEventTap, ev)

    def _mouse_button(self, name, down):
        down_t, up_t, btn, _ = self._MOUSE_BTN[name]
        pos = self._mouse_pos()
        ev = self.Q.CGEventCreateMouseEvent(
            None, down_t if down else up_t, pos, btn)
        self.Q.CGEventPost(self.Q.kCGHIDEventTap, ev)

    def _mouse_move(self, dx, dy, drag):
        pos = self._mouse_pos()
        nx, ny = pos.x + dx, pos.y + dy
        if drag:
            _, _, btn, drag_t = self._MOUSE_BTN[drag]
            ev = self.Q.CGEventCreateMouseEvent(None, drag_t, (nx, ny), btn)
        else:
            ev = self.Q.CGEventCreateMouseEvent(
                None, self.Q.kCGEventMouseMoved, (nx, ny), 0)
        self.Q.CGEventPost(self.Q.kCGHIDEventTap, ev)


# --------------------------- Windows ---------------------------
class WindowsBackend(Backend):
    def __init__(self, verbose=False):
        super().__init__(verbose)
        import ctypes
        from ctypes import wintypes
        from win_keycodes import SCANCODES, EXTENDED

        self.ctypes = ctypes
        self.SCANCODES = SCANCODES
        self.EXTENDED = EXTENDED
        self.user32 = ctypes.windll.user32

        # --- SendInput structures ---
        ULONG_PTR = ctypes.POINTER(wintypes.ULONG)

        class KEYBDINPUT(ctypes.Structure):
            _fields_ = [("wVk", wintypes.WORD), ("wScan", wintypes.WORD),
                        ("dwFlags", wintypes.DWORD), ("time", wintypes.DWORD),
                        ("dwExtraInfo", ULONG_PTR)]

        class MOUSEINPUT(ctypes.Structure):
            _fields_ = [("dx", wintypes.LONG), ("dy", wintypes.LONG),
                        ("mouseData", wintypes.DWORD), ("dwFlags", wintypes.DWORD),
                        ("time", wintypes.DWORD), ("dwExtraInfo", ULONG_PTR)]

        class _INPUTunion(ctypes.Union):
            _fields_ = [("ki", KEYBDINPUT), ("mi", MOUSEINPUT)]

        class INPUT(ctypes.Structure):
            _fields_ = [("type", wintypes.DWORD), ("u", _INPUTunion)]

        self.KEYBDINPUT = KEYBDINPUT
        self.MOUSEINPUT = MOUSEINPUT
        self.INPUT = INPUT
        self._INPUTunion = _INPUTunion

        # constants
        self.INPUT_KEYBOARD = 1
        self.INPUT_MOUSE = 0
        self.KEYEVENTF_KEYUP = 0x0002
        self.KEYEVENTF_SCANCODE = 0x0008
        self.KEYEVENTF_EXTENDEDKEY = 0x0001
        self.MOUSEEVENTF_MOVE = 0x0001
        self._MOUSE_FLAGS = {
            "left": (0x0002, 0x0004),   # LEFTDOWN, LEFTUP
            "right": (0x0008, 0x0010),  # RIGHTDOWN, RIGHTUP
        }

    def _send(self, inp):
        self.user32.SendInput(1, self.ctypes.byref(inp),
                              self.ctypes.sizeof(self.INPUT))

    def _key(self, name, down):
        scan = self.SCANCODES.get(name)
        if scan is None:
            self.log("unknown key:", name)
            return False
        flags = self.KEYEVENTF_SCANCODE
        if name in self.EXTENDED:
            flags |= self.KEYEVENTF_EXTENDEDKEY
        if not down:
            flags |= self.KEYEVENTF_KEYUP
        ki = self.KEYBDINPUT(0, scan, flags, 0, None)
        inp = self.INPUT(self.INPUT_KEYBOARD, self._INPUTunion(ki=ki))
        self._send(inp)

    def _mouse_button(self, name, down):
        down_f, up_f = self._MOUSE_FLAGS[name]
        mi = self.MOUSEINPUT(0, 0, 0, down_f if down else up_f, 0, None)
        inp = self.INPUT(self.INPUT_MOUSE, self._INPUTunion(mi=mi))
        self._send(inp)

    def _mouse_move(self, dx, dy, drag):
        # SendInput relative motion takes integer pixels; buttons already held
        # by us make Windows treat this as a drag, so `drag` needs no special
        # casing here.
        mi = self.MOUSEINPUT(int(round(dx)), int(round(dy)), 0,
                             self.MOUSEEVENTF_MOVE, 0, None)
        inp = self.INPUT(self.INPUT_MOUSE, self._INPUTunion(mi=mi))
        self._send(inp)


def make_backend(platform="auto", verbose=False):
    if platform == "auto":
        platform = "windows" if sys.platform.startswith("win") else "mac"
    if platform == "mac":
        return MacBackend(verbose)
    if platform == "windows":
        return WindowsBackend(verbose)
    raise ValueError(f"unknown platform: {platform!r} (use mac|windows|auto)")
