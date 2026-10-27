---
id: UE-009
title: Give each custom asset type its own entry in the Add menu
level: SHOULD
scope: pack:unreal-plugin
paths: ["**/*.h"]
verified-by: [test, review]
targets-failure: convention-drift
observed-on: [claude-opus-5-5]
rationale: Agents default to UDataAsset subclasses that users can only create as a generic Data Asset and then pick the class, which hides the type.
sources: ["practices/unreal-plugin-development.md"]
---
When a plugin adds a type users create as an asset, give it its own entry in the Content Browser's Add menu, because creating a generic Data Asset and then picking the class hides the type from the people who need it. In an editor module, add a `UFactory` subclass (`SupportedClass`, `bCreateNew`, `bEditAfterNew`, `FactoryCreateNew`) and a `UAssetDefinitionDefault` subclass (display name, colour, and an `FAssetCategoryPath` for the plugin's category). The class may still derive from `UDataAsset`. Add an automation test that finds the plugin's asset classes and checks that each has a factory and its own asset definition, and name the menu path in the docs.
