// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#include "Engine/GameInstance.h"
#include "Misc/AutomationTest.h"
#include "RfrSampleSubsystem.h"
#include "UObject/Package.h"

#if WITH_DEV_AUTOMATION_TESTS

namespace RfrSampleTests
{
	// A game-instance subsystem must be outered to a UGameInstance (its ClassWithin);
	// creating it in the transient package raises an ensure that fails the test.
	URfrSampleSubsystem* NewTestSubsystem()
	{
		UGameInstance* GameInstance = NewObject<UGameInstance>(GetTransientPackage());
		return NewObject<URfrSampleSubsystem>(GameInstance);
	}
}

BEGIN_DEFINE_SPEC(FRfrSampleSubsystemSpec, "RfrSample.Subsystem", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
END_DEFINE_SPEC(FRfrSampleSubsystemSpec)

void FRfrSampleSubsystemSpec::Define()
{
	Describe("AddScore", [this]()
	{
		It("adds positive deltas", [this]()
		{
			URfrSampleSubsystem* Subsystem = RfrSampleTests::NewTestSubsystem();
			TestEqual(TEXT("score after +3"), Subsystem->AddScore(3), 3);
		});

		It("never goes below zero", [this]()
		{
			URfrSampleSubsystem* Subsystem = RfrSampleTests::NewTestSubsystem();
			TestEqual(TEXT("score after -5"), Subsystem->AddScore(-5), 0);
		});
	});
}

// Deliberately failing test, run only by the runner probe workflow to learn how the
// editor reports failures (process exit code versus index.json). Not part of normal CI.
BEGIN_DEFINE_SPEC(FRfrSampleProbeSpec, "RfrSampleProbe.IntentionallyFails", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
END_DEFINE_SPEC(FRfrSampleProbeSpec)

void FRfrSampleProbeSpec::Define()
{
	It("fails on purpose", [this]()
	{
		TestEqual(TEXT("probe"), 1, 2);
	});
}

#endif
