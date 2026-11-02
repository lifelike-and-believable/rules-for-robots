# Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.
"""Builds the demo content for tutorial-rfrsample-score-display in a host project.

Run by the Tier 2 workflow (docs/specs/project-process.md, AC-25) with
UnrealEditor-Cmd.exe Host.uproject -ExecutePythonScript=make_demo.py. The sample plugin has no
content, so this script makes it: a level with an RFR Score Display showing Score: 3 (tutorial
step 3), lights, a screenshot functional test framed on the display, and a three-second level
sequence with a camera move for the Movie Render Queue demo. It quits the editor when done and
writes make_demo.ok next to itself on success, so the workflow can tell a crash from success.
"""
import os
import traceback

import unreal

ROOT = "/Game/RfrDemo"
MAP = f"{ROOT}/ScoreDisplayMap"
SEQUENCE = f"{ROOT}/ScoreDemo"
FPS = 24
FRAMES = 72
# The score the display shows. The workflow's plant-change input sets 4, so the screenshot test
# can be seen to fail when the product no longer matches tutorial step 3.
SCORE = int(os.environ.get("RFR_DEMO_SCORE", "3"))


def actors():
    return unreal.get_editor_subsystem(unreal.EditorActorSubsystem)


def spawn(cls, location, rotation=unreal.Rotator(0, 0, 0), label=None):
    actor = actors().spawn_actor_from_class(cls, location, rotation)
    if label:
        actor.set_actor_label(label)
    return actor


def build_level():
    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if unreal.EditorAssetLibrary.does_asset_exist(MAP):
        unreal.EditorAssetLibrary.delete_asset(MAP)
    if not levels.new_level(MAP):
        raise RuntimeError(f"could not create {MAP}")
    # Tutorial step 2 and 3: the display, with Preview Score set to 3, facing the camera (-X).
    display = spawn(unreal.RfrScoreDisplay, unreal.Vector(0, 0, 100), unreal.Rotator(0, 0, 180), "ScoreDisplay")
    # set_editor_property notifies the actor, which reruns its construction script.
    display.set_editor_property("preview_score", SCORE)
    spawn(unreal.DirectionalLight, unreal.Vector(0, 0, 400), unreal.Rotator(0, -45, 200), "Sun")
    spawn(unreal.SkyLight, unreal.Vector(0, 0, 500), label="Sky")
    spawn(unreal.SkyAtmosphere, unreal.Vector(0, 0, 0), label="Atmosphere")
    # The screenshot functional test looks at the display from 400 units away.
    shot = spawn(unreal.ScreenshotFunctionalTest, unreal.Vector(-400, 0, 100), unreal.Rotator(0, 0, 0), "ScoreDisplayScreenshot")
    shot.set_actor_label("ScoreDisplayScreenshot")
    # Unreal's default error limits (0.02 global, 0.1 local) let "Score: 4" pass against a reference
    # of "Score: 3": one digit is a small part of a 1920x1080 image. Measured on the Tier 2 runner
    # with the Low per-pixel tolerance: the unchanged scene differs by 0.000000, the planted change
    # by 0.0008 global and 0.042 local. With zero per-pixel tolerance even the unchanged scene
    # differs by 0.31, from render noise. So: Low tolerance, and limits between the two results.
    options = shot.get_editor_property("screenshot_options")
    options.set_editor_property("tolerance", unreal.ComparisonTolerance.LOW)
    options.set_editor_property("maximum_local_error", 0.01)
    options.set_editor_property("maximum_global_error", 0.0002)
    shot.set_editor_property("screenshot_options", options)
    if not levels.save_current_level():
        raise RuntimeError(f"could not save {MAP}")
    return display


def build_sequence():
    tools = unreal.AssetToolsHelpers.get_asset_tools()
    if unreal.EditorAssetLibrary.does_asset_exist(SEQUENCE):
        unreal.EditorAssetLibrary.delete_asset(SEQUENCE)
    sequence = tools.create_asset("ScoreDemo", ROOT, unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    sequence.set_display_rate(unreal.FrameRate(FPS, 1))
    sequence.set_playback_start(0)
    sequence.set_playback_end(FRAMES)

    camera = spawn(unreal.CineCameraActor, unreal.Vector(-500, -150, 120), unreal.Rotator(0, -2, 15), "DemoCamera")
    binding = sequence.add_possessable(camera)
    transform = binding.add_track(unreal.MovieScene3DTransformTrack)
    section = transform.add_section()
    section.set_range(0, FRAMES)
    channels = section.get_all_channels()  # location x, y, z, rotation x, y, z, scale x, y, z
    for channel, start, end in ((channels[0], -500.0, -350.0), (channels[1], -150.0, 150.0), (channels[5], 15.0, -15.0)):
        channel.add_key(unreal.FrameNumber(0), start)
        channel.add_key(unreal.FrameNumber(FRAMES), end)

    cuts = sequence.add_track(unreal.MovieSceneCameraCutTrack)
    cut = cuts.add_section()
    cut.set_range(0, FRAMES)
    try:
        binding_id = unreal.MovieSceneSequenceExtensions.get_portable_binding_id(sequence, sequence, binding)
    except AttributeError:
        binding_id = sequence.make_binding_id(binding, unreal.MovieSceneObjectBindingSpace.LOCAL)
    cut.set_camera_binding_id(binding_id)

    unreal.EditorAssetLibrary.save_loaded_asset(sequence)
    unreal.get_editor_subsystem(unreal.LevelEditorSubsystem).save_current_level()


def main():
    marker = os.path.join(os.path.dirname(os.path.abspath(__file__)), "make_demo.ok")
    if os.path.exists(marker):
        os.remove(marker)
    try:
        build_level()
        build_sequence()
        with open(marker, "w", encoding="utf-8") as f:
            f.write("ok\n")
        unreal.log("make_demo: built " + MAP + " and " + SEQUENCE)
    except Exception:
        unreal.log_error("make_demo failed:\n" + traceback.format_exc())
    finally:
        unreal.SystemLibrary.quit_editor()


main()
