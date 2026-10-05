// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#pragma once

#include "Subsystems/GameInstanceSubsystem.h"
#include "RfrSampleSubsystem.generated.h"

/** Keeps a running score for the current game instance. */
UCLASS()
class RFRSAMPLE_API URfrSampleSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	/** Adds Delta to the score and returns the new total. The score never drops below zero. */
	UFUNCTION(BlueprintCallable, Category = "RFR Sample", meta = (DisplayName = "Add Score"))
	int32 AddScore(int32 Delta);

	/** Returns the current score. */
	UFUNCTION(BlueprintPure, Category = "RFR Sample")
	int32 GetScore() const { return Score; }

private:
	int32 Score = 0;
};
