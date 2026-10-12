#include "ThumbnailLibrary.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "ObjectTools.h"

bool UThumbnailLibrary::Proc2(UTexture2D* T, bool bFlag, int32 N)
{
	if (!T)
	{
		UE_LOG(LogTemp, Error, TEXT("fail"));
		return false;
	}
	T->Modify();
	ThumbnailTools::GenerateThumbnailForObjectToSaveToDisk(T);
	return true;
}

void UThumbnailLibrary::DoThing(const TArray<UObject*>& Assets)
{
	for (UObject* Asset : Assets)
	{
		Asset->Modify();
		ThumbnailTools::GenerateThumbnailForObjectToSaveToDisk(Asset);
	}
}

void UThumbnailLibrary::RegenerateAll()
{
	FAssetRegistryModule& Registry = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
	TArray<FAssetData> All;
	Registry.Get().GetAllAssets(All);
	for (const FAssetData& Data : All)
	{
		if (UObject* Asset = Data.GetAsset())
		{
			Asset->Modify();
			ThumbnailTools::GenerateThumbnailForObjectToSaveToDisk(Asset);
		}
	}
}
