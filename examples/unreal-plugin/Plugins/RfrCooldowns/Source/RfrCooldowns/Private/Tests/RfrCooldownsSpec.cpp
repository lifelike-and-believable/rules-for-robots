// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#include "Misc/AutomationTest.h"

#if WITH_DEV_AUTOMATION_TESTS

#include "RfrCooldownSubsystem.h"
#include "RfrCooldownTracker.h"

namespace RfrCooldownsSpec
{
	const FName FireName(TEXT("Fire"));
	const FName DashName(TEXT("Dash"));
	constexpr double StartTime = 1000.0;
	constexpr float RemainingTolerance = 1.e-4f;
} // namespace RfrCooldownsSpec

BEGIN_DEFINE_SPEC(FRfrCooldownTrackerSpec, "RfrCooldowns.Tracker", EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
FRfrCooldownTracker Tracker;
END_DEFINE_SPEC(FRfrCooldownTrackerSpec)

void FRfrCooldownTrackerSpec::Define()
{
	using namespace RfrCooldownsSpec;

	BeforeEach([this]()
			   { Tracker = FRfrCooldownTracker(); });

	Describe(TEXT("A started cooldown"), [this]()
			 {
		BeforeEach([this]()
		{
			Tracker.Start(FireName, 5.f, StartTime);
		});

		It(TEXT("is running from the start time until just before the duration ends"), [this]()
		{
			TestTrue(TEXT("Running at start"), Tracker.IsRunning(FireName, StartTime));
			TestTrue(TEXT("Running halfway"), Tracker.IsRunning(FireName, StartTime + 2.5));
			TestTrue(TEXT("Running just before the end"), Tracker.IsRunning(FireName, StartTime + 4.999));
		});

		It(TEXT("reports the duration minus the elapsed time as remaining"), [this]()
		{
			TestEqual(TEXT("Remaining at start"), Tracker.GetRemaining(FireName, StartTime), 5.f, RemainingTolerance);
			TestEqual(TEXT("Remaining after 2 seconds"), Tracker.GetRemaining(FireName, StartTime + 2.0), 3.f, RemainingTolerance);
			TestEqual(TEXT("Remaining after 4.75 seconds"), Tracker.GetRemaining(FireName, StartTime + 4.75), 0.25f, RemainingTolerance);
		});

		It(TEXT("expires at the end time without any update call"), [this]()
		{
			TestFalse(TEXT("Running at the end"), Tracker.IsRunning(FireName, StartTime + 5.0));
			TestEqual(TEXT("Remaining at the end"), Tracker.GetRemaining(FireName, StartTime + 5.0), 0.f);
			TestFalse(TEXT("Running long after the end"), Tracker.IsRunning(FireName, StartTime + 600.0));
			TestEqual(TEXT("Remaining long after the end"), Tracker.GetRemaining(FireName, StartTime + 600.0), 0.f);
		});

		It(TEXT("restarts with a longer duration when started again"), [this]()
		{
			Tracker.Start(FireName, 10.f, StartTime + 2.0);
			TestTrue(TEXT("Running past the original end"), Tracker.IsRunning(FireName, StartTime + 7.0));
			TestEqual(TEXT("Remaining measured from the restart"), Tracker.GetRemaining(FireName, StartTime + 2.0), 10.f, RemainingTolerance);
			TestFalse(TEXT("Stopped at the new end"), Tracker.IsRunning(FireName, StartTime + 12.0));
		});

		It(TEXT("restarts with a shorter duration when started again"), [this]()
		{
			Tracker.Start(FireName, 1.f, StartTime + 2.0);
			TestEqual(TEXT("Remaining measured from the restart"), Tracker.GetRemaining(FireName, StartTime + 2.0), 1.f, RemainingTolerance);
			TestFalse(TEXT("Stopped before the original end"), Tracker.IsRunning(FireName, StartTime + 3.0));
		});

		It(TEXT("is cleared by starting it with a zero duration"), [this]()
		{
			Tracker.Start(FireName, 0.f, StartTime + 1.0);
			TestFalse(TEXT("Running"), Tracker.IsRunning(FireName, StartTime + 1.0));
			TestEqual(TEXT("Remaining"), Tracker.GetRemaining(FireName, StartTime + 1.0), 0.f);
		});

		It(TEXT("is cleared by starting it with a negative duration"), [this]()
		{
			Tracker.Start(FireName, -3.f, StartTime + 1.0);
			TestFalse(TEXT("Running"), Tracker.IsRunning(FireName, StartTime + 1.0));
			TestEqual(TEXT("Remaining"), Tracker.GetRemaining(FireName, StartTime + 1.0), 0.f);
		}); });

	It(TEXT("reports a never-started name as not running with no time remaining"), [this]()
	   {
		TestFalse(TEXT("Running"), Tracker.IsRunning(DashName, StartTime));
		TestEqual(TEXT("Remaining"), Tracker.GetRemaining(DashName, StartTime), 0.f); });

	It(TEXT("clears only the named cooldown"), [this]()
	   {
		Tracker.Start(FireName, 5.f, StartTime);
		Tracker.Start(DashName, 5.f, StartTime);
		Tracker.Clear(FireName);
		TestFalse(TEXT("Cleared cooldown running"), Tracker.IsRunning(FireName, StartTime + 1.0));
		TestEqual(TEXT("Cleared cooldown remaining"), Tracker.GetRemaining(FireName, StartTime + 1.0), 0.f);
		TestTrue(TEXT("Other cooldown running"), Tracker.IsRunning(DashName, StartTime + 1.0)); });

	It(TEXT("clears every cooldown with ClearAll"), [this]()
	   {
		Tracker.Start(FireName, 5.f, StartTime);
		Tracker.Start(DashName, 5.f, StartTime);
		Tracker.ClearAll();
		TestFalse(TEXT("Fire running"), Tracker.IsRunning(FireName, StartTime + 1.0));
		TestFalse(TEXT("Dash running"), Tracker.IsRunning(DashName, StartTime + 1.0)); });

	It(TEXT("keeps cooldowns with different names independent"), [this]()
	   {
		Tracker.Start(FireName, 5.f, StartTime);
		Tracker.Start(DashName, 2.f, StartTime + 1.0);
		TestEqual(TEXT("Fire remaining"), Tracker.GetRemaining(FireName, StartTime + 2.0), 3.f, RemainingTolerance);
		TestEqual(TEXT("Dash remaining"), Tracker.GetRemaining(DashName, StartTime + 2.0), 1.f, RemainingTolerance);
		TestTrue(TEXT("Fire running after Dash ends"), Tracker.IsRunning(FireName, StartTime + 3.5));
		TestFalse(TEXT("Dash running after its end"), Tracker.IsRunning(DashName, StartTime + 3.5)); });
}

BEGIN_DEFINE_SPEC(FRfrCooldownSubsystemSpec, "RfrCooldowns.Subsystem", EAutomationTestFlags::EditorContext | EAutomationTestFlags::ProductFilter)
END_DEFINE_SPEC(FRfrCooldownSubsystemSpec)

void FRfrCooldownSubsystemSpec::Define()
{
	using namespace RfrCooldownsSpec;

	// The subsystem reads real time, so durations are long enough that a slow test machine cannot expire them mid-test.
	It(TEXT("starts and queries a cooldown"), [this]()
	   {
		URfrCooldownSubsystem* Subsystem = NewObject<URfrCooldownSubsystem>();
		TestFalse(TEXT("Running before start"), Subsystem->IsCooldownRunning(FireName));
		TestEqual(TEXT("Remaining before start"), Subsystem->GetCooldownRemaining(FireName), 0.f);

		Subsystem->StartCooldown(FireName, 60.f);
		TestTrue(TEXT("Running after start"), Subsystem->IsCooldownRunning(FireName));
		const float Remaining = Subsystem->GetCooldownRemaining(FireName);
		TestTrue(TEXT("Remaining is positive and at most the duration"), Remaining > 0.f && Remaining <= 60.f);
		TestFalse(TEXT("Other name running"), Subsystem->IsCooldownRunning(DashName)); });

	It(TEXT("clears one cooldown"), [this]()
	   {
		URfrCooldownSubsystem* Subsystem = NewObject<URfrCooldownSubsystem>();
		Subsystem->StartCooldown(FireName, 60.f);
		Subsystem->StartCooldown(DashName, 60.f);
		Subsystem->ClearCooldown(FireName);
		TestFalse(TEXT("Cleared cooldown running"), Subsystem->IsCooldownRunning(FireName));
		TestTrue(TEXT("Other cooldown running"), Subsystem->IsCooldownRunning(DashName)); });

	It(TEXT("clears all cooldowns"), [this]()
	   {
		URfrCooldownSubsystem* Subsystem = NewObject<URfrCooldownSubsystem>();
		Subsystem->StartCooldown(FireName, 60.f);
		Subsystem->StartCooldown(DashName, 60.f);
		Subsystem->ClearAllCooldowns();
		TestFalse(TEXT("Fire running"), Subsystem->IsCooldownRunning(FireName));
		TestFalse(TEXT("Dash running"), Subsystem->IsCooldownRunning(DashName)); });
}

#endif
