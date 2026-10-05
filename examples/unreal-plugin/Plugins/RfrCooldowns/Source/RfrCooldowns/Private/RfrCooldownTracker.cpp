// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#include "RfrCooldownTracker.h"

void FRfrCooldownTracker::Start(FName Name, float DurationSeconds, double Now)
{
	if (DurationSeconds <= 0.f)
	{
		Clear(Name);
		return;
	}
	EndTimes.Add(Name, Now + DurationSeconds);
}

bool FRfrCooldownTracker::IsRunning(FName Name, double Now) const
{
	const double* EndTime = EndTimes.Find(Name);
	return EndTime != nullptr && Now < *EndTime;
}

float FRfrCooldownTracker::GetRemaining(FName Name, double Now) const
{
	const double* EndTime = EndTimes.Find(Name);
	if (EndTime == nullptr || Now >= *EndTime)
	{
		return 0.f;
	}
	return static_cast<float>(*EndTime - Now);
}

void FRfrCooldownTracker::Clear(FName Name)
{
	EndTimes.Remove(Name);
}

void FRfrCooldownTracker::ClearAll()
{
	EndTimes.Reset();
}
