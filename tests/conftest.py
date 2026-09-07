"""Project test compatibility hooks."""

import os
import tempfile


def _patch_windows_direct_loader():
    """Keep the injected stdin file open on Windows.

    genlayer-test 0.29.2 unlinks the file while fd 0 still owns it, which
    raises WinError 32 on Windows. The direct VM closes the process-scoped
    descriptor at teardown; retaining these tiny temp files is safer than
    bypassing direct execution or patching installed packages.
    """
    if os.name != "nt":
        return

    try:
        from gltest.direct import loader
    except ImportError:
        return

    def inject_message_to_fd0(vm):
        from genlayer.py import calldata
        from genlayer.py.types import Address

        message_data = {
            "contract_address": Address(vm._contract_address),
            "sender_address": Address(vm.sender),
            "origin_address": Address(vm.origin),
            "stack": [],
            "value": vm._value,
            "datetime": vm._datetime,
            "is_init": False,
            "chain_id": vm._chain_id,
            "entry_kind": 0,
            "entry_data": b"",
            "entry_stage_data": None,
        }
        encoded = calldata.encode(message_data)
        fd, _path = tempfile.mkstemp()
        os.write(fd, encoded)
        os.lseek(fd, 0, os.SEEK_SET)
        vm._original_stdin_fd = os.dup(0)
        os.dup2(fd, 0)
        os.close(fd)

    loader._inject_message_to_fd0 = inject_message_to_fd0


_patch_windows_direct_loader()
