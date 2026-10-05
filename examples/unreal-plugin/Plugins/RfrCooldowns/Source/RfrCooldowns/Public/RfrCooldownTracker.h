// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#pragma once

#include "Containers/Map.h"
#include "UObject/NameTypes.h"

/**
 * Named cooldowns stored as end times. Callers pass the current time to every query, so the tracker never ticks
 * and tests can control time directly. A cooldown is running while Now is before its end time.
 */
class RFRCOOLDOWNS_API FRfrCooldownTracker
{
  public:
	/** Starts or restarts the named cooldown. A duration of zero or less clears it. */
	void Start(FName Name, float DurationSeconds, double Now);

	bool IsRunning(FName Name, double Now) const;

	/** Seconds left on the named cooldown, or 0 when it is not running. */
	float GetRemaining(FName Name, double Now) const;

	void Clear(FName Name);

	void ClearAll();

  private:
	TMap<FName, double> EndTimes;
};
