# Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.
"""Renders the tutorial's demo sequence with Movie Render Queue (docs/specs/project-process.md, AC-25).

Run by the Tier 2 workflow with UnrealEditor.exe Host.uproject -ExecutePythonScript=render_demo.py
-RenderOffscreen, after make_demo.py has built the level and sequence. It renders PNG frames at
1280x720 to the folder in RFR_DEMO_OUT, writes render_demo.ok next to itself when the render
succeeds, and quits the editor either way.
"""
import os
import traceback

import unreal

MAP = "/Game/RfrDemo/ScoreDisplayMap"
SEQUENCE = "/Game/RfrDemo/ScoreDemo"
HERE = os.path.dirname(os.path.abspath(__file__))
MARKER = os.path.join(HERE, "render_demo.ok")
executor = None  # kept alive at module level so the render is not garbage collected


def finished(_executor, success):
    try:
        if success:
            with open(MARKER, "w", encoding="utf-8") as f:
                f.write("ok\n")
            unreal.log("render_demo: render finished")
        else:
            unreal.log_error("render_demo: Movie Render Queue reported a failure")
    finally:
        unreal.SystemLibrary.quit_editor()


def main():
    global executor
    if os.path.exists(MARKER):
        os.remove(MARKER)
    out = os.environ.get("RFR_DEMO_OUT") or os.path.join(HERE, "demo")
    queue_subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
    queue = queue_subsystem.get_queue()
    queue.delete_all_jobs()
    job = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
    job.job_name = "tutorial-rfrsample-score-display"
    job.map = unreal.SoftObjectPath(MAP)
    job.sequence = unreal.SoftObjectPath(SEQUENCE)
    config = job.get_configuration()
    config.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
    config.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)
    output = config.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
    output.output_directory = unreal.DirectoryPath(out)
    output.output_resolution = unreal.IntPoint(1280, 720)
    output.file_name_format = "{sequence_name}.{frame_number}"
    executor = unreal.MoviePipelinePIEExecutor()
    executor.on_executor_finished_delegate.add_callable_unique(finished)
    queue_subsystem.render_queue_with_executor_instance(executor)
    unreal.log(f"render_demo: rendering {SEQUENCE} to {out}")


try:
    main()
except Exception:
    unreal.log_error("render_demo failed:\n" + traceback.format_exc())
    unreal.SystemLibrary.quit_editor()
