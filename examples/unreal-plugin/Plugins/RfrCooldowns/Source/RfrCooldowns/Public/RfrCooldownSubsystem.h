// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#pragma once

#include "RfrCooldownTracker.h"
#include "Subsystems/GameInstanceSubsystem.h"

#include "RfrCooldownSubsystem.generated.h"

/**
 * Named ability cooldowns that last for the game instance, so they survive map travel.
 * Cooldowns use real time: they keep running while the game is paused and ignore time dilation.
 */
UCLASS()
class RFRCOOLDOWNS_API URfrCooldownSubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

  public:
	/** Starts the named cooldown, restarting it if it is already running. A duration of zero or less clears it. */
	UFUNCTION(BlueprintCallable, Category = "Cooldowns")
	void StartCooldown(FName Name, float DurationSeconds);

	/** True while the named cooldown has time left. */
	UFUNCTION(BlueprintPure, Category = "Cooldowns")
	bool IsCooldownRunning(FName Name) const;

	/** Seconds left on the named cooldown, or 0 when it is not running. */
	UFUNCTION(BlueprintPure, Category = "Cooldowns")
	float GetCooldownRemaining(FName Name) const;

	/** Stops the named cooldown. */
	UFUNCTION(BlueprintCallable, Category = "Cooldowns")
	void ClearCooldown(FName Name);

	/** Stops every cooldown. */
	UFUNCTION(BlueprintCallable, Category = "Cooldowns")
	void ClearAllCooldowns();

  private:
	FRfrCooldownTracker Tracker;
};
