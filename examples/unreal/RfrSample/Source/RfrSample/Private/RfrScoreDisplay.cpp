// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

#include "RfrScoreDisplay.h"

#include "Components/TextRenderComponent.h"

#define LOCTEXT_NAMESPACE "RfrScoreDisplay"

ARfrScoreDisplay::ARfrScoreDisplay()
{
	PrimaryActorTick.bCanEverTick = false;
	Text = CreateDefaultSubobject<UTextRenderComponent>(TEXT("Text"));
	Text->SetHorizontalAlignment(EHTA_Center);
	Text->SetVerticalAlignment(EVRTA_TextCenter);
	Text->SetWorldSize(48.f);
	Text->SetTextRenderColor(FColor::White);
	RootComponent = Text;
	ShowScore(PreviewScore);
}

void ARfrScoreDisplay::ShowScore(int32 Score)
{
	Text->SetText(FText::Format(LOCTEXT("ScoreFormat", "Score: {0}"), FText::AsNumber(Score)));
}

FText ARfrScoreDisplay::GetDisplayedText() const
{
	return Text->Text;
}

void ARfrScoreDisplay::OnConstruction(const FTransform& Transform)
{
	Super::OnConstruction(Transform);
	ShowScore(PreviewScore);
}

#undef LOCTEXT_NAMESPACE
