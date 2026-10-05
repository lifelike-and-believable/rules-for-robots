// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#include "RfrSampleSubsystem.h"

#include "Math/UnrealMathUtility.h"

int32 URfrSampleSubsystem::AddScore(int32 Delta)
{
	Score = FMath::Max(0, Score + Delta);
	return Score;
}
