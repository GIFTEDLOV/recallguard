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

    # The installed gltest RC currently assumes the v0.6 ``genlayer`` package
    # layout even when the contract header resolves the documented
    # ``genlayer.py`` runner. Keep this adapter in tests only: it selects the
    # storage and nondeterministic hooks belonging to the SDK actually loaded
    # from the contract header. Production code never imports this module.
    original_allocate_contract = loader._allocate_contract

    def allocate_contract(contract_cls, vm, *args, **kwargs):
        try:
            import genlayer.py.storage as legacy_storage
            from genlayer.py.storage._internal.generate import (
                ORIGINAL_INIT_ATTR,
                _storage_build,
            )

            type_desc = _storage_build(contract_cls, {})
            slot = vm._storage.get_store_slot(legacy_storage.ROOT_SLOT_ID)
            instance = type_desc.get(slot, 0)
            init = getattr(type_desc, "cls", None)
            init = getattr(init or contract_cls, "__init__", None)
            if hasattr(init, ORIGINAL_INIT_ATTR):
                init = getattr(init, ORIGINAL_INIT_ATTR)
            if init is not None:
                init(instance, *args, **kwargs)
            return instance
        except ImportError:
            return original_allocate_contract(contract_cls, vm, *args, **kwargs)

    loader._allocate_contract = allocate_contract

    def patch_legacy_nondet():
        try:
            import genlayer.gl.vm as legacy_vm
            from genlayer.py import calldata as legacy_calldata
        except ImportError:
            return
        from gltest.direct import wasi_mock

        # gltest 0.30's WASI shim defaults to the newer calldata namespace;
        # the contract header intentionally selects the documented legacy
        # runner, whose wire format is decoded by genlayer.py.calldata.
        wasi_mock.import_calldata = lambda: legacy_calldata
        if getattr(legacy_vm, "_direct_mode_patched", False):
            return

        def direct_run_nondet_unsafe(leader_fn, validator_fn, /, **kwargs):
            from gltest.direct import wasi_mock

            vm = wasi_mock.get_vm()
            if vm._check_pickling:
                loader._validate_pickling(leader_fn, "leader_fn")
                loader._validate_pickling(validator_fn, "validator_fn")
            vm._in_nondet = True
            try:
                result = leader_fn()
            finally:
                vm._in_nondet = False
            vm._captured_validators.append((result, leader_fn, validator_fn))
            return result

        legacy_vm.run_nondet_unsafe = direct_run_nondet_unsafe
        legacy_vm._direct_mode_patched = True

    loader._patch_run_nondet_for_direct_mode = patch_legacy_nondet

    # VMContext.run_validator in the installed RC imports genlayer.vm. The
    # declared legacy runner exposes the same result types under genlayer.gl.
    from gltest.direct.vm import VMContext, _sentinel

    original_refresh_gl_message = VMContext._refresh_gl_message

    def refresh_gl_message(self):
        original_refresh_gl_message(self)
        try:
            import genlayer.gl as legacy_gl
            from genlayer.py.types import Address, u256

            sender = self.sender
            origin = self.origin
            contract_address = self._contract_address
            if isinstance(sender, bytes):
                sender = Address(sender)
            if isinstance(origin, bytes):
                origin = Address(origin)
            if isinstance(contract_address, bytes):
                contract_address = Address(contract_address)
            legacy_gl.message = legacy_gl.MessageType(
                contract_address=contract_address,
                sender_address=sender,
                origin_address=origin,
                value=u256(self._value),
                chain_id=u256(self._chain_id),
            )
        except ImportError:
            pass

    VMContext._refresh_gl_message = refresh_gl_message

    def run_validator(self, *, leader_result=_sentinel, leader_error=None, index=-1):
        import genlayer.gl.vm as legacy_vm
        if not self._captured_validators:
            raise RuntimeError("No validator captured")
        stored_result, _leader_fn, validator_fn = self._captured_validators[index]
        if leader_error is not None:
            wrapped = legacy_vm.UserError(str(leader_error))
        elif leader_result is not _sentinel:
            wrapped = legacy_vm.Return(calldata=leader_result)
        else:
            wrapped = legacy_vm.Return(calldata=stored_result)
        return validator_fn(wrapped)

    VMContext.run_validator = run_validator

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
