"""
The overwrite guard for refine_male_body.py: plain Python, no Blender.

Male_Body.blend becomes hand-authored work (anatomy regions, materials,
metadata) from the first edit in Blender on. The refinement script rebuilds it
from the original source, so it may only replace a file it can prove is still
exactly what it last wrote itself.

The proof is a record next to the output (Male_Body.blend ->
Male_Body.refinement.json), written straight after the save with the SHA-256
of the bytes saved. The .blend cannot hold its own hash, and a rebuild does not
repeat the same bytes (Blender's file differs from run to run while its content
is the same), so the hash is recorded rather than predicted.

An existing output may be replaced only when its bytes still match its record.
Anything else is protected and the script stops: any edit (even re-saving in
Blender without a change), a missing, unreadable or foreign record. The guard
does not try to tell an important edit from a harmless one. There is no
override: whoever wants a rebuild over an edited file first moves that file
aside (or writes the rebuild elsewhere with --out) and so decides what to keep.
"""

import hashlib
import json
import os

RECORD_SUFFIX = ".refinement.json"


class Refusal(SystemExit):
    """Raised instead of overwriting; the message says why and what to do."""


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def record_path(out):
    return os.path.splitext(out)[0] + RECORD_SUFFIX


def _refuse(out, why):
    return Refusal(
        "refine-male-body: REFUSING to overwrite %s\n"
        "  %s\n"
        "  It may hold hand-authored work (anatomy regions, materials, metadata) that a rebuild would destroy.\n"
        "  Nothing has been written. To rebuild anyway, first decide what to keep: commit or move that file\n"
        "  aside yourself, or write the rebuild to a new path with --out <path>." % (out, why))


def check_target(out):
    """Returns the target's SHA-256 if it may be overwritten (None when there is
    no target yet); raises Refusal otherwise."""
    if not os.path.lexists(out):
        return None
    if not os.path.isfile(out) or os.path.islink(out):
        raise _refuse(out, "It is not a plain file.")
    record = record_path(out)
    if not os.path.exists(record):
        raise _refuse(out, "No refinement record (%s) proves it is the script's untouched output."
                      % os.path.basename(record))
    try:
        with open(record, encoding="utf-8") as f:
            recorded = json.load(f)
        expected, named = recorded["output_sha256"], recorded["output"]
    except (OSError, ValueError, KeyError, TypeError) as e:
        raise _refuse(out, "Its refinement record (%s) cannot be read (%s)." % (os.path.basename(record), e))
    if named != os.path.basename(out):
        raise _refuse(out, "Its refinement record (%s) was written for %s, not for this file."
                      % (os.path.basename(record), named))
    actual = sha256_file(out)
    if actual != expected:
        raise _refuse(out, "It has changed since the script wrote it: its SHA-256 is %s, the record says %s."
                      % (actual[:16], str(expected)[:16]))
    return actual


def check_unchanged(out, checked):
    """Just before saving: the target is still what check_target() passed (it may
    have been saved from Blender while the refinement ran)."""
    now = sha256_file(out) if os.path.lexists(out) and os.path.isfile(out) else None
    if now != checked:
        raise _refuse(out, "It changed while the refinement was running.")


def write_record(out, **provenance):
    """Records the bytes just written to `out` (atomically, after the save)."""
    record = record_path(out)
    data = dict(note="Written by tools/anatomy/authored/refine_male_body.py. It may overwrite %s only while "
                     "the file's SHA-256 matches output_sha256; any edit protects the file."
                     % os.path.basename(out),
                output=os.path.basename(out), output_sha256=sha256_file(out), **provenance)
    tmp = record + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    os.replace(tmp, record)
    return data
