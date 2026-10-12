#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "ThumbnailLibrary.generated.h"

class UTexture2D;

UCLASS()
class THUMBNAILTOOLS_API UThumbnailLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	UFUNCTION(BlueprintCallable)
	static bool Proc2(UTexture2D* T, bool bFlag, int32 N);

	UFUNCTION(BlueprintCallable)
	static void DoThing(const TArray<UObject*>& Assets);

	UFUNCTION(BlueprintCallable, Category = "Thumbnails")
	static void RegenerateAll();
};
