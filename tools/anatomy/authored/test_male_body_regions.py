"""
Tests that the Male_Body regions are reproducible, deterministic and safe.

    python3 tools/anatomy/authored/test_male_body_regions.py

Needs Blender (BLENDER, or /Applications/Blender.app); skipped without it.
About two minutes. Everything that writes works on temporary copies:
assets/anatomy/Male_Body.blend and its records are only read, and checked
unchanged at the end.

  committed   Male_Body.blend is exactly what the regions record says, and its
              face regions are exactly what male_body_regions.py authors
  first run   authoring the refined sculpture (from git, checked against the
              refinement record) paints the regions, leaves the geometry as it
              was, records the file, and the refinement script then refuses it
  re-run      authoring its own output again is allowed and paints the same
  hand edit   one face repainted by hand is refused, and nothing is written
  export      male_body.py exports the same GLB, byte for byte, every run: the
              committed one
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

SCRIPT = os.path.join(HERE, "male_body_regions.py")
IMPORTER = os.path.join(HERE, "male_body.py")
REAL = os.path.join(ROOT, "assets", "anatomy", "Male_Body.blend")
RECORD = os.path.splitext(REAL)[0] + ".regions.json"
GLB = os.path.join(ROOT, "assets", "anatomy", "male-body.glb")
BLENDER = os.environ.get("BLENDER", "/Applications/Blender.app/Contents/MacOS/Blender")

# A .blend's face regions (each face's material, "" for the sculpture's own)
# against what the script authors (its preview), and its geometry's hash
# against the refinement's. Run in Blender, which has numpy.
FACES = r"""
import bpy, hashlib, numpy as np, sys
blend, preview = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.open_mainfile(filepath=blend)
me = bpy.data.meshes["Mesh_0"]
idx = np.empty(len(me.polygons), np.int64); me.polygons.foreach_get("material_index", idx)
names = np.array(["" if m.name == "atlas-stone" else m.name for m in me.materials])
print("MATCH", bool(np.array_equal(names[idx], np.load(preview))))
co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co)
print("GEOMETRY", hashlib.sha256(co.tobytes() + str(len(me.polygons)).encode()).hexdigest()[:16],
      me["atlas_refinement_geometry"])
"""

REPAINT = r"""
import bpy
bpy.data.meshes["Mesh_0"].polygons[0].material_index = 1
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_mainfile()
"""


def sha(path):
    return guard.sha256_file(path)


def blender(*args, env=None):
    return subprocess.run([BLENDER, "-b", "--factory-startup", *args], capture_output=True, text=True,
                          env={**os.environ, **(env or {})})


def refined_from_git(out):
    """The refined sculpture before any region, from git: the version whose bytes
    the refinement record names."""
    with open(os.path.splitext(REAL)[0] + guard.RECORD_SUFFIX, encoding="utf-8") as f:
        want = json.load(f)["output_sha256"]
    revs = subprocess.run(["git", "-C", ROOT, "log", "--format=%H", "--", "assets/anatomy/Male_Body.blend"],
                          check=True, capture_output=True, text=True).stdout.split()
    for rev in revs:
        data = subprocess.run(["git", "-C", ROOT, "show", rev + ":assets/anatomy/Male_Body.blend"],
                              check=True, capture_output=True).stdout
        if hashlib.sha256(data).hexdigest() == want:
            with open(out, "wb") as f:
                f.write(data)
            return rev
    raise unittest.SkipTest("the refined sculpture is not in this checkout's history")


@unittest.skipUnless(os.path.exists(BLENDER), "Blender not found (set BLENDER)")
class MaleBodyRegionsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="male-body-regions-")
        cls.before = (sha(REAL), sha(RECORD), sha(GLB))
        # What the script authors, computed on the committed file (preview: nothing saved).
        r = blender("--python", SCRIPT, "--", "--preview", os.path.join(cls.tmp, "preview"))
        if r.returncode:
            raise AssertionError("preview failed:\n" + r.stdout[-3000:] + r.stderr[-3000:])
        cls.authored = os.path.join(cls.tmp, "preview", "region.npy")

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def tearDown(self):
        self.assertEqual((sha(REAL), sha(RECORD), sha(GLB)), self.before, "a committed file changed")

    def faces(self, blend):
        """(its regions are what the script authors, (its geometry hash, the refined one's))."""
        script = os.path.join(self.tmp, "faces.py")
        with open(script, "w") as f:
            f.write(FACES)
        r = blender("--python-exit-code", "1", "--python", script, "--", blend, self.authored)
        if r.returncode:
            raise AssertionError("reading %s failed:\n%s%s" % (blend, r.stdout[-2000:], r.stderr[-2000:]))
        lines = {line.split()[0]: line.split()[1:] for line in r.stdout.splitlines()
                 if line.startswith(("MATCH", "GEOMETRY"))}
        return lines["MATCH"] == ["True"], tuple(lines["GEOMETRY"])

    def author(self, blend):
        return blender("--python", SCRIPT, "--", "--out", blend)

    def test_committed_file_is_the_recorded_authoring(self):
        with open(RECORD, encoding="utf-8") as f:
            record = json.load(f)
        self.assertEqual(record["output"], "Male_Body.blend")
        self.assertEqual(record["output_sha256"], self.before[0], "Male_Body.blend is not what the record says")
        same, (now, recorded) = self.faces(REAL)
        self.assertEqual(now, recorded, "the committed sculpture's geometry is not the refined one")
        self.assertTrue(same, "Male_Body.blend's regions are not what male_body_regions.py authors")

    def test_first_run_paints_the_refined_sculpture_and_locks_out_the_refinement(self):
        d = os.path.join(self.tmp, "first"); os.makedirs(d)
        out = os.path.join(d, "Male_Body.blend")
        refined_from_git(out)
        shutil.copy2(os.path.splitext(REAL)[0] + guard.RECORD_SUFFIX, guard.record_path(out))
        r = self.author(out)
        self.assertEqual(r.returncode, 0, r.stdout[-3000:] + r.stderr[-3000:])
        same, (now, recorded) = self.faces(out)
        self.assertEqual(now, recorded, "authoring moved the sculpture's vertices")
        self.assertTrue(same, "the first run painted differently from the committed regions")
        with open(os.path.splitext(out)[0] + ".regions.json", encoding="utf-8") as f:
            self.assertEqual(json.load(f)["output_sha256"], sha(out))
        with self.assertRaises(guard.Refusal):          # the refinement can no longer overwrite it
            guard.check_target(out)

    def test_rerun_on_its_own_output_paints_the_same(self):
        d = os.path.join(self.tmp, "rerun"); os.makedirs(d)
        out = os.path.join(d, "Male_Body.blend")
        shutil.copy2(REAL, out); shutil.copy2(RECORD, os.path.splitext(out)[0] + ".regions.json")
        r = self.author(out)
        self.assertEqual(r.returncode, 0, r.stdout[-3000:] + r.stderr[-3000:])
        same, (now, recorded) = self.faces(out)
        self.assertEqual(now, recorded)
        self.assertTrue(same, "a second run painted differently")

    def test_hand_edit_is_refused(self):
        d = os.path.join(self.tmp, "edited"); os.makedirs(d)
        out = os.path.join(d, "Male_Body.blend")
        shutil.copy2(REAL, out); shutil.copy2(RECORD, os.path.splitext(out)[0] + ".regions.json")
        script = os.path.join(self.tmp, "repaint.py")
        with open(script, "w") as f:
            f.write(REPAINT)
        r = blender(out, "--python-exit-code", "1", "--python", script)
        self.assertEqual(r.returncode, 0, r.stdout[-2000:] + r.stderr[-2000:])
        edited = (sha(out), os.path.getmtime(out))
        r = self.author(out)
        self.assertNotEqual(r.returncode, 0, "a hand-edited file was overwritten")
        self.assertIn("REFUSING to overwrite", r.stdout + r.stderr)
        self.assertNotIn("surface:", r.stdout, "it should refuse before doing any work")
        self.assertEqual((sha(out), os.path.getmtime(out)), edited)

    def test_export_is_byte_for_byte_the_committed_glb(self):
        outs = []
        for k in range(2):
            out = os.path.join(self.tmp, "export%d.glb" % k)
            r = blender("--python", IMPORTER, "--", out)
            self.assertEqual(r.returncode, 0, r.stdout[-3000:] + r.stderr[-3000:])
            outs.append(sha(out))
        self.assertEqual(outs[0], outs[1], "two exports differ")
        self.assertEqual(outs[0], self.before[2], "the export is not the committed male-body.glb")


if __name__ == "__main__":
    unittest.main(verbosity=2)
