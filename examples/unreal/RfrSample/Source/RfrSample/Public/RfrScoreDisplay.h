// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#pragma once

#include "GameFramework/Actor.h"
#include "RfrScoreDisplay.generated.h"

class UTextRenderComponent;

/** Shows a score as text in the level. Place it, set Preview Score, and call Show Score at runtime. */
UCLASS(meta = (DisplayName = "RFR Score Display"))
class RFRSAMPLE_API ARfrScoreDisplay : public AActor
{
	GENERATED_BODY()

public:
	ARfrScoreDisplay();

	/** Shows Score as "Score: <n>". */
	UFUNCTION(BlueprintCallable, Category = "RFR Sample", meta = (DisplayName = "Show Score"))
	void ShowScore(int32 Score);

	/** The text the display shows now. */
	UFUNCTION(BlueprintPure, Category = "RFR Sample")
	FText GetDisplayedText() const;

	/** The score shown in the editor and when play starts, before any call to Show Score. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "RFR Sample", meta = (ClampMin = "0"))
	int32 PreviewScore = 0;

	virtual void OnConstruction(const FTransform& Transform) override;

private:
	UPROPERTY(VisibleAnywhere, Category = "RFR Sample")
	TObjectPtr<UTextRenderComponent> Text;
};
