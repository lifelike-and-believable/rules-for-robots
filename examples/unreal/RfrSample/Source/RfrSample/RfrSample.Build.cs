// Copyright (c) 2026 Lifelike & Believable Animation Design. All rights reserved.

using UnrealBuildTool;

public class RfrSample : ModuleRules
{
	public RfrSample(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });
	}
}
