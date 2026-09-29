"""
Tests that refine_male_body.py cannot overwrite hand-authored work.

    python3 tools/anatomy/authored/test_refine_guard.py

The guard's own tests (refine_guard.py) need only Python and run in a moment.
The end-to-end tests run the real refinement in Blender (BLENDER, or
/Applications/Blender.app) on temporary copies, about a minute in all; they
are skipped when Blender is not there. assets/anatomy/Male_Body.blend and its
record are only read, and checked unchanged at the end.

  A  untouched target     a copy of the committed Male_Body.blend and its
                          record: rebuilt, with the same content
  B  edited target        a region-like material assignment, a metadata-only
                          change, a re-save with no change, a missing record,
                          and --force: all refused, the file left untouched
  C  exact expected       the script's own fresh output is accepted as a target
  D  repeated runs        two rebuilds in a row: identical content, no
                          accumulation, no false refusal
"""

import hashlib
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
sys.path.insert(0, HERE)
sys.dont_write_bytecode = True  # no __pycache__ beside the tools
import refine_guard as guard  # noqa: E402

SCRIPT = os.path.join(HERE, "refine_male_body.py")
REAL = os.path.join(ROOT, "assets", "anatomy", "Male_Body.blend")
BLENDER = os.environ.get("BLENDER", "/Applications/Blender.app/Contents/MacOS/Blender")

# The content of a .blend, for "same sculpture" checks: Blender does not repeat
# a file's bytes, so they cannot be compared directly.
DIGEST = r"""
import bpy, hashlib, numpy as np
h = hashlib.sha256()
for me in sorted(bpy.data.meshes, key=lambda m: m.name):
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); h.update(co.tobytes())
    pv = np.empty(len(me.loops), np.int32); me.polygons.foreach_get("vertices", pv); h.update(pv.tobytes())
    mi = np.empty(len(me.polygons), np.int32); me.polygons.foreach_get("material_index", mi); h.update(mi.tobytes())
    for uv in me.uv_layers:
        d = np.empty(len(me.loops) * 2, np.float32); uv.data.foreach_get("uv", d); h.update(uv.name.encode() + d.tobytes())
    h.update(repr(sorted((a.name, a.domain, a.data_type) for a in me.attributes)).encode())
    h.update(repr([m.name if m else None for m in me.materials]).encode())
    h.update(repr(sorted((k, str(me[k])) for k in me.keys())).encode())
for coll in ("objects", "meshes", "materials", "images", "collections", "node_groups", "texts", "scenes"):
    h.update(repr((coll, sorted(i.name for i in getattr(bpy.data, coll)))).encode())
print("DIGEST", h.hexdigest())
"""

# Hand edits, as they will come: each opens the .blend and saves it back.
EDITS = {
    # A region painted: a new material on some faces; the vertices do not move.
    "region": r"""
import bpy
me = bpy.data.meshes["Mesh_0"]
mat = bpy.data.materials.new("atlas-region-test")
me.materials.append(mat)
idx = len(me.materials) - 1
for p in me.polygons[:500]:
    p.material_index = idx
bpy.ops.wm.save_mainfile()
""",
    # Metadata only.
    "metadata": r"""
import bpy
bpy.data.meshes["Mesh_0"]["atlas_note"] = "hand-authored"
bpy.ops.wm.save_mainfile()
""",
    # Opened and saved with no change at all.
    "resave": r"""
import bpy
bpy.ops.wm.save_mainfile()
""",
}


def sha(path):
    return guard.sha256_file(path)


def read_bytes(path):
    with open(path, "rb") as f:
        return f.read()


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def blender(*args):
    return subprocess.run([BLENDER, "-b", "--factory-startup", *args], capture_output=True, text=True)


def refine(out, *extra):
    return blender("--python", SCRIPT, "--", "--out", out, *extra)


def run_py(blend, code, tmp):
    path = os.path.join(tmp, "snippet_%s.py" % hashlib.sha1(code.encode()).hexdigest()[:8])
    with open(path, "w") as f:
        f.write(code)
    r = blender(blend, "--python-exit-code", "1", "--python", path)
    if r.returncode:
        raise AssertionError("Blender failed on %s:\n%s%s" % (blend, r.stdout[-2000:], r.stderr[-2000:]))
    return r.stdout


# ------------------------------------------------------------ the guard alone

class GuardTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="refine-guard-")
        self.out = os.path.join(self.tmp, "Male_Body.blend")

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def written(self, data=b"refined sculpture"):
        """A target as the script leaves it: the file and its record."""
        with open(self.out, "wb") as f:
            f.write(data)
        guard.write_record(self.out, script="test")

    def assertRefused(self, *words):
        with self.assertRaises(guard.Refusal) as caught:
            guard.check_target(self.out)
        msg = str(caught.exception)
        for w in ("REFUSING", "hand-authored", "Nothing has been written") + words:
            self.assertIn(w, msg)

    def test_no_target_yet_may_be_written(self):
        self.assertIsNone(guard.check_target(self.out))

    def test_exact_recorded_output_may_be_overwritten(self):
        self.written()
        self.assertEqual(guard.check_target(self.out), sha(self.out))

    def test_edited_target_is_refused(self):
        self.written()
        with open(self.out, "ab") as f:
            f.write(b"\0")
        self.assertRefused("changed since the script wrote it")

    def test_same_size_edit_is_refused(self):
        self.written(b"refined sculpture")
        with open(self.out, "wb") as f:
            f.write(b"refined sculptur3")
        self.assertRefused("changed since")

    def test_target_without_record_is_refused(self):
        with open(self.out, "wb") as f:
            f.write(b"someone's work")
        self.assertRefused("No refinement record")

    def test_unreadable_record_is_refused(self):
        self.written()
        with open(guard.record_path(self.out), "w") as f:
            f.write("{not json")
        self.assertRefused("cannot be read")

    def test_record_without_hash_is_refused(self):
        self.written()
        with open(guard.record_path(self.out), "w") as f:
            json.dump({"output": "Male_Body.blend"}, f)
        self.assertRefused("cannot be read")

    def test_record_for_another_file_is_refused(self):
        self.written()
        other = os.path.join(self.tmp, "Other.blend")
        shutil.copy(self.out, other)
        shutil.copy(guard.record_path(self.out), guard.record_path(other))
        self.out = other
        self.assertRefused("written for Male_Body.blend")

    def test_symlinked_target_is_refused(self):
        real = os.path.join(self.tmp, "real.blend")
        with open(real, "wb") as f:
            f.write(b"x")
        os.symlink(real, self.out)
        self.assertRefused("not a plain file")

    def test_edit_during_the_run_is_refused(self):
        self.written()
        checked = guard.check_target(self.out)
        with open(self.out, "ab") as f:
            f.write(b"painted while refining")
        with self.assertRaises(guard.Refusal):
            guard.check_unchanged(self.out, checked)

    def test_target_appearing_during_the_run_is_refused(self):
        checked = guard.check_target(self.out)
        with open(self.out, "wb") as f:
            f.write(b"new work")
        with self.assertRaises(guard.Refusal):
            guard.check_unchanged(self.out, checked)

    def test_record_is_written_atomically_beside_the_output(self):
        self.written()
        rec = read_json(guard.record_path(self.out))
        self.assertEqual(rec["output"], "Male_Body.blend")
        self.assertEqual(rec["output_sha256"], sha(self.out))
        self.assertEqual(sorted(os.listdir(self.tmp)), ["Male_Body.blend", "Male_Body.refinement.json"])


# ------------------------------------------------------- the real refinement

@unittest.skipUnless(os.path.exists(BLENDER), "Blender not found (set BLENDER)")
class RefineEndToEndTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="refine-e2e-")
        cls.real_record = guard.record_path(REAL)
        cls.before = (sha(REAL), sha(cls.real_record))
        cls.real_digest = cls.digest(REAL)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def tearDown(self):
        # The real asset is only ever read.
        self.assertEqual((sha(REAL), sha(self.real_record)), self.before,
                         "assets/anatomy/Male_Body.blend or its record changed")

    @classmethod
    def digest(cls, blend):
        out = run_py(blend, DIGEST, cls.tmp)
        return next(line.split()[1] for line in out.splitlines() if line.startswith("DIGEST "))

    def copy_real(self, name, record=True):
        d = os.path.join(self.tmp, name)
        os.makedirs(d)
        out = os.path.join(d, "Male_Body.blend")
        shutil.copy2(REAL, out)
        if record:
            shutil.copy2(self.real_record, guard.record_path(out))
        return out

    def assertRebuilt(self, r, out):
        self.assertEqual(r.returncode, 0, r.stdout[-3000:] + r.stderr[-3000:])
        self.assertIn("wrote " + out, r.stdout)
        self.assertEqual(guard.check_target(out), sha(out), "the record must match the new file")

    def assertRefusedUntouched(self, r, out, before):
        self.assertNotEqual(r.returncode, 0, "the script should have refused:\n" + r.stdout[-3000:])
        self.assertNotIn("wrote ", r.stdout)
        self.assertNotIn("original:", r.stdout, "it must refuse before doing any work")
        self.assertEqual((sha(out), os.path.getmtime(out)), before, "the protected file was touched")

    def test_real_asset_is_the_recorded_refinement_output(self):
        self.assertEqual(guard.check_target(REAL), self.before[0])

    def test_a_untouched_target_is_rebuilt_to_the_same_content(self):
        out = self.copy_real("a")
        r = refine(out)
        self.assertRebuilt(r, out)
        self.assertEqual(self.digest(out), self.real_digest)

    def test_b_edited_targets_are_refused(self):
        for name, code in EDITS.items():
            with self.subTest(edit=name):
                out = self.copy_real("b-" + name)
                run_py(out, code, self.tmp)
                self.assertNotEqual(sha(out), self.before[0], "the edit should change the file")
                if name != "resave":
                    self.assertNotEqual(self.digest(out), self.real_digest, "the edit should change the content")
                record = read_bytes(guard.record_path(out))
                before = (sha(out), os.path.getmtime(out))
                r = refine(out)
                self.assertRefusedUntouched(r, out, before)
                self.assertIn("REFUSING to overwrite", r.stdout + r.stderr)
                self.assertIn("changed since the script wrote it", r.stdout + r.stderr)
                self.assertEqual(read_bytes(guard.record_path(out)), record, "the record was touched")

    def test_b_target_without_record_is_refused(self):
        out = self.copy_real("b-norecord", record=False)
        before = (sha(out), os.path.getmtime(out))
        r = refine(out)
        self.assertRefusedUntouched(r, out, before)
        self.assertIn("No refinement record", r.stdout + r.stderr)
        self.assertFalse(os.path.exists(guard.record_path(out)))

    def test_b_force_is_not_an_override(self):
        out = self.copy_real("b-force")
        run_py(out, EDITS["region"], self.tmp)
        before = (sha(out), os.path.getmtime(out))
        for extra in (["--force"], ["--source", REAL, "--force"]):
            with self.subTest(args=extra):
                r = refine(out, *extra)
                self.assertRefusedUntouched(r, out, before)
                self.assertIn("there is no --force", r.stdout + r.stderr)

    def test_c_d_fresh_output_is_accepted_and_repeat_runs_match(self):
        out = os.path.join(self.tmp, "cd", "Male_Body.blend")
        os.makedirs(os.path.dirname(out))
        first = refine(out)                                   # no target yet
        self.assertRebuilt(first, out)
        first_digest, first_record = self.digest(out), read_json(guard.record_path(out))
        second = refine(out)                                  # C: its own exact output is not refused
        self.assertRebuilt(second, out)
        second_record = read_json(guard.record_path(out))
        # D: the same sculpture again, with nothing piled up on the first run's output.
        self.assertEqual(self.digest(out), first_digest)
        self.assertEqual(first_digest, self.real_digest)
        self.assertEqual(second_record["geometry"], first_record["geometry"])
        self.assertEqual(sorted(os.listdir(os.path.dirname(out))), ["Male_Body.blend", "Male_Body.refinement.json"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
