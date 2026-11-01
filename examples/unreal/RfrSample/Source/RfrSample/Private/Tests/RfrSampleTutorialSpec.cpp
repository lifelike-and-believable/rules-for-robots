// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Misc/AutomationTest.h"
#include "RfrSampleSubsystem.h"
#include "RfrScoreDisplay.h"
#include "UObject/Package.h"

#if WITH_DEV_AUTOMATION_TESTS

// Follows the tutorial tutorial-rfrsample-score-display (examples/unreal/docs/tutorials/score-display.md)
// step by step, so a change that breaks what the tutorial promises fails here. The screenshot
// functional test and the demo render in the Tier 2 workflow cover its editor step visually.
BEGIN_DEFINE_SPEC(FRfrSampleTutorialSpec, "RfrSample.Tutorial.ScoreDisplay", EAutomationTestFlags::EditorContext | EAutomationTestFlags::EngineFilter)
	UWorld* World = nullptr;
	ARfrScoreDisplay* Display = nullptr;
	URfrSampleSubsystem* Subsystem = nullptr;
END_DEFINE_SPEC(FRfrSampleTutorialSpec)

void FRfrSampleTutorialSpec::Define()
{
	BeforeEach([this]()
	{
		World = UWorld::CreateWorld(EWorldType::Game, false);
		FWorldContext& Context = GEngine->CreateNewWorldContext(EWorldType::Game);
		Context.SetCurrentWorld(World);
		// Step 2: place an RFR Score Display in the level.
		Display = World->SpawnActor<ARfrScoreDisplay>();
		UGameInstance* GameInstance = NewObject<UGameInstance>(GetTransientPackage());
		Subsystem = NewObject<URfrSampleSubsystem>(GameInstance);
	});

	AfterEach([this]()
	{
		GEngine->DestroyWorldContext(World);
		World->DestroyWorld(false);
		World = nullptr;
		Display = nullptr;
		Subsystem = nullptr;
	});

	It("step 2: a new display reads Score: 0", [this]()
	{
		TestEqual(TEXT("text"), Display->GetDisplayedText().ToString(), FString(TEXT("Score: 0")));
	});

	It("step 3: setting Preview Score to 3 shows Score: 3", [this]()
	{
		Display->PreviewScore = 3;
		Display->OnConstruction(Display->GetActorTransform());
		TestEqual(TEXT("text"), Display->GetDisplayedText().ToString(), FString(TEXT("Score: 3")));
	});

	It("step 4: Add Score then Show Score shows the new total", [this]()
	{
		Display->ShowScore(Subsystem->AddScore(3));
		TestEqual(TEXT("text"), Display->GetDisplayedText().ToString(), FString(TEXT("Score: 3")));
	});

	It("step 5: a penalty larger than the score shows Score: 0", [this]()
	{
		Subsystem->AddScore(3);
		Display->ShowScore(Subsystem->AddScore(-5));
		TestEqual(TEXT("text"), Display->GetDisplayedText().ToString(), FString(TEXT("Score: 0")));
	});
}

#endif
