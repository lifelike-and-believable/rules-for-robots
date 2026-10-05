// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#include "RfrCooldownSubsystem.h"

#include "HAL/PlatformTime.h"

#include UE_INLINE_GENERATED_CPP_BY_NAME(RfrCooldownSubsystem)

void URfrCooldownSubsystem::StartCooldown(FName Name, float DurationSeconds)
{
	Tracker.Start(Name, DurationSeconds, FPlatformTime::Seconds());
}

bool URfrCooldownSubsystem::IsCooldownRunning(FName Name) const
{
	return Tracker.IsRunning(Name, FPlatformTime::Seconds());
}

float URfrCooldownSubsystem::GetCooldownRemaining(FName Name) const
{
	return Tracker.GetRemaining(Name, FPlatformTime::Seconds());
}

void URfrCooldownSubsystem::ClearCooldown(FName Name)
{
	Tracker.Clear(Name);
}

void URfrCooldownSubsystem::ClearAllCooldowns()
{
	Tracker.ClearAll();
}
