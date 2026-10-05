# Fab code plugin requirements (retrieved 2026-10-05)

Quoted lines (prefixed with `>`) are Fab's wording. Clause numbers in bold are Fab's own numbering. Each quote ends with a tag that maps to a page in Sources.

## Sources

Pages used:

- [TR] Fab Technical Requirements — https://www.fab.com/o/technical-requirements — last updated September 21, 2026
- [AF] Asset File Format and Structure Requirements in Fab — https://dev.epicgames.com/documentation/fab/asset-file-format-and-structure-requirements-in-fab — last updated not shown
- [PUB] Publishing Assets for Sale or Free Download in Fab — https://dev.epicgames.com/documentation/fab/publishing-assets-for-sale-or-free-download-in-fab — last updated not shown
- [COMP] (Fab) Plugin Compilation Environment — https://support.fab.com/s/article/Fab-Plugin-Compilation-Environment — article date Jan 24, 2025
- [DECL] (Fab) Why was my submission declined? — https://support.fab.com/s/article/Why-was-the-submission-declined — article date Sep 11, 2025
- [LINUX] (Fab) How to Install a 3rd Party Fab Plugin in Unreal Engine on Linux — https://support.fab.com/s/article/How-to-Install-a-3rd-Party-Fab-Plugin-in-Unreal-Engine-on-Linux — article date Jun 5, 2026

Pointer pages (they only link to the pages above):

- (Fab) Technical Requirements — https://support.fab.com/s/article/FAB-TECHNICAL-REQUIREMENTS — article date Jul 15, 2026
- (Fab) Listing Guidelines — https://support.fab.com/s/article/Listing-Guidelines — article date Jul 15, 2026
- (Fab) Publishing Assets Workflow — https://support.fab.com/s/article/Publishing-Assets-Workflow — article date Sep 21, 2026
- (Fab) Product Details — https://support.fab.com/s/article/Product-Details — article date Jan 24, 2025
- FAB FAQs (article index) — https://support.fab.com/s/topic/0TOQP0000001YsV4AU/fab-faqs — last updated not shown

Consulted, nothing specific to code plugins:

- Publisher Get Started in Fab — https://dev.epicgames.com/documentation/fab/publisher-get-started-in-fab — last updated not shown
- Plugins in Unreal Engine (Unreal Engine 5.8 documentation, linked from TR 4.3.6.1.c) — https://dev.epicgames.com/documentation/en-us/unreal-engine/plugins-in-unreal-engine — last updated not shown

## Requirements

### 1. Engine versions

Which versions must or may be supported:

> **4.2.2.a** Publishers are responsible for ensuring products function as advertised in Supported Engine Versions. [TR]

> **4.2.2.b** Upon initial submission and approval, every product must contain a Project Version that has the latest version of Unreal Engine as a Supported Engine Version. [TR]

> **4.2.2.c** Publishers must ensure all their published products support at least one of the three latest engine versions. [TR]

"Latest three versions" policy. It appears in two forms: the publisher obligation in 4.2.2.c above (at least one of the three latest), and Epic's build policy:

> **4.3.6.2.d** Epic will only build publishers’ plugins against the three latest major engine versions by default. Builds for older engine versions can be accommodated per request. [TR]

The support article repeats this: 

> Epic will only build publishers’ plugins against the three latest major engine versions per the Guidelines. Builds for older engine versions can be accommodated per request. [COMP]

How new engine versions are handled (separate uploads):

> **4.2.2.d** Code Plugin products must have a Project Version for every different Supported Engine Version, each with different Project File Links that host different overarching plugin folders, even if they are duplicates with just different values in the “EngineVersion” key of their .uplugin descriptors. [TR]

> Code Plugins: Always require an updated project to be submitted, even if the plugin works as expected in the latest engine release. You must upload a new .uplugin project to your listing per engine version. Depending on engine compatibility, it can range from adding the latest engine version key to the .uplugin file to submitting a complete update that includes numerous code changes. [PUB]

> Creating a new project version, changing the project file link of a pre-existing project version, or changing the distribution method requires you to generate a new build for the product's downloadable files. [PUB]

The option in 4.2.2.e to "simply add that engine version to the product’s latest Project Version" is stated for a "content-only project". [TR]

Deadlines for supporting a new engine version: no fixed deadline is stated. The only timing language is:

> However, you are expected to provide an update to your UE files shortly after each new engine release for the following: [PUB]

followed by "Incompatibility issues", "A bug is found in your product", "Additional features", "Optimization updates". That sentence sits in a paragraph that begins with content-only files; the code plugin rule is the separate quote above.

Related:

> **4.3.1.c** Upon initial submission and approval, Epic will review products to ensure they function in the latest major engine version as advertised. [TR]

> **4.3.1.d** Products that include Unreal Engine features and plugins that are experimental or in beta must clearly state this dependency in the product’s description. If an Experimental Plugin is discontinued, products cannot support newer engine versions unless the dependency is removed. [TR]

Preview builds: 

> Trying out your product in early preview builds of a new engine version can be beneficial. [PUB]

> However, any product that uses Blueprints or code in any way may need to be updated to function as intended in a new engine version. Consider testing these projects in preview builds to understand what you must update for the official engine release. [PUB]

Sources: https://www.fab.com/o/technical-requirements, https://dev.epicgames.com/documentation/fab/publishing-assets-for-sale-or-free-download-in-fab, https://support.fab.com/s/article/Fab-Plugin-Compilation-Environment

### 2. Folder structure and files

> **4.3.7.3.a** Plugin folders must not contain unused folders or local folders (such as Binaries, Build, Intermediate, or Saved), so for a plugin that might be called "MyPlugin", this leaves the following files and folders to be zipped up for submission: [TR]

```
MyPlugin
|----- Config
|----- Content
|----- Resources
|----- Source
|      ├── MyModule
|      |     ├── Private
|      |     ├── Public
|      |     └── MyModule.build.cs
|      └── ThirdParty
|----- MyPlugin.uplugin
```

> **4.3.7.3.b** For folders in the overarching plugin folder meant for distribution besides the Content, Resources, or Source folders (like Docs folders), there must exist a Config folder in which there is a "FilterPlugin.ini" that contains something similar to: [TR]

```
[FilterPlugin]
/Docs/...
/MyOtherFolder/...
```

> **4.3.7.3.c** Starting with the overarching plugin folder (the one containing the Source folder and .uplugin file), all file paths must be 170 characters or less. [TR]

> **4.3.7.3.d** Third-party dependencies may only be used with proof of permission and must be placed in a ThirdParty folder located inside the Source folder. [TR]

The documentation page lists what a code plugin must contain:

> All Code Plugin products must contain the following: [AF]

followed by ".uplugin file", "Source directory", "Content directory", "Config directory", and the same tree as above (including Resources and ThirdParty).

Source: 

> **4.3.6.1.c** Plugins must contain at least one module of C++ code but can contain content as well. [TR]

> Code Plugins must contain at least one code module. [AF]

Binaries and Intermediate: must not be in the submitted folder (4.3.7.3.a). Binaries are produced by Epic:

> **4.3.6.2.b** Plugins will be distributed with the binaries built by Epic’s compilation toolchain, so publishers must ensure that final debugging has been completed by clicking "Package..." on their plugin in the Plugins windows of the editor to test compilation before sending in a new plugin version. [TR]

Externally compiled libraries are addressed in 4.3.6.1.a (see section 5).

Packaging and upload:

> The Project File Link must host the download of a zip archive that includes only one Unreal Engine project or plugin. These files need to be available until the product has gone live. [AF]

> To upload your Unreal Engine files, you must provide a Project File Link to a hosting website (such as Google Drive, Dropbox, or OneDrive). These files must be available for download and not require login information. [AF]

Python files, if any: third-party Python code goes in `Content/Python/Lib/site-packages/`, plugin Python code in `Content/Python`, and:

> Do not place Python files outside of directories listed above. [AF]

Resources folder contents: not covered (the folder appears in the tree, with no stated requirement for what it holds).

Plugin icon (for example Icon128.png): not covered.

Sources: https://www.fab.com/o/technical-requirements, https://dev.epicgames.com/documentation/fab/asset-file-format-and-structure-requirements-in-fab

### 3. .uplugin fields and values

Required:

> **4.3.6.a** .uplugin descriptors must have an “EngineVersion” key present whose value dictates the major engine version (e.g. 5.x.0) the plugin is intended to be installed to. For instance, if the plugin is meant for Unreal Engine version 5.3: [TR]

```
"EngineVersion" : "5.3.0",
```

> **4.3.6.b** .uplugin descriptors must have a “PlatformAllowList” or “PlatformDenyList” key in each module to specify compilation for the appropriate platforms that the module is intended to be built for with something similar to: [TR]

```
"PlatformAllowList": [ "Win64", "Win32", "Mac", "IOS", "Android" ]
```

> Note: For Unreal Engine 4 plugins, you will need to use the “WhitelistPlatforms” or “BlacklistPlatforms” keys instead. [TR]

> **4.3.6.c** .uplugin descriptors must have a “FabURL” key present whose value dictates the Epic Games Launcher address at which the engine will download missing plugins if customers try to open projects that depend on them. After the product has been submitted for approval, the “FabURL” value should contain the ID at the end of the product’s Publisher Portal URL. [TR]

Fab's example value format is `"FabURL" : "com.epicgames.launcher://ue/Fab/product/<product ID>",` where the ID is the one at the end of the product's Publisher Portal URL. [TR]

Dependencies on other plugins:

> **4.3.6.d** Plugins can depend on Unreal Engine plugins distributed with the engine, but must not depend on other user-made Unreal Engine plugins. [TR]

Not covered by the pages read:

- MarketplaceURL: not covered (only FabURL is named).
- Installed: not covered.
- Module Type (Runtime, Editor, and so on): not covered.
- LoadingPhase: not covered.
- SupportedTargetPlatforms as a .uplugin key: not covered. "Supported Target Platforms" appears only as a listing field (see section 4).
- Any explicitly forbidden .uplugin field or value: not covered.

Sources: https://www.fab.com/o/technical-requirements, https://support.fab.com/s/article/Fab-Plugin-Compilation-Environment

### 4. Platforms

What must be declared:

- In the .uplugin: a “PlatformAllowList” or “PlatformDenyList” key in each module (4.3.6.b, quoted in section 3).
- On the listing:

> **4.2.3.a** Publishers are responsible for ensuring products function as advertised in Supported Target Platforms. [TR]

In the table of listing update types, "Supported target platforms" is marked as not requiring review. [PUB]

How platform support is tested or built:

- Epic compiles the plugin with its own toolchain and distributes those binaries (4.3.6.2.b, quoted in section 2).
- Publishers are told to test compilation themselves before submitting. Besides "Package..." in the editor:

> Publishers can also run this command from installed binary builds of each Unreal Engine version they’d like to compile their plugin for: Engine\Build\BatchFiles\RunUAT.bat BuildPlugin -Plugin=[Path to .uplugin file, must be outside engine directory] -Package=[Output directory] -Rocket [TR]

- Compilation environment listed by the support article [COMP] (article date Jan 24, 2025; it lists engine versions 5.1 to 5.3 only):

| Platform and engine | Minimum required OS | Minimum required compiler |
|---|---|---|
| Mac 5.3 | macOS 12.5 Monterey | Xcode 14.1 |
| Mac 5.2 | macOS 12.5 Monterey | Xcode 14.1 |
| Mac 5.1 | macOS latest Monterey | Xcode 13.4.1 |
| Windows 5.3 | Windows 10 64-bit version | Visual Studio 2022 |
| Windows 5.2 | Windows 10 64-bit version | Visual Studio 2022 |
| Windows 5.1 | Windows 10 64-bit version | Visual Studio 2019 v16.11.5 or later |
| Linux 5.3 | Ubuntu 22.04, CentOS 7 | clang 16.0.6 |
| Linux 5.2 | Ubuntu 22.04, CentOS 7 | clang 15.0.1 |
| Linux 5.1 | Ubuntu 22.04 | clang 13.0.1 |

- Linux:

> NOTE: Although cross-compilation for Linux is not yet supported on the Marketplace, Plugins may still include “Linux” as a value in the “WhitelistPlatforms” key of their .uplugin. [COMP]

- The buyer-facing Linux article says:

> Every plugin ships prebuilt files for the platforms it supports, so what you find here tells you exactly how much work is ahead: [LINUX]

- Binary engine builds:

> **4.3.1.i** Content must function in binary builds of the Unreal Engine. While products may provide extra functionality to customers using source-built versions of the Unreal Engine, they must not fully depend on the customer building the Unreal Engine from source to use them. [TR]

Functional testing per target platform (for example on-device testing for iOS, Android or consoles): not covered.

Compilation environment for engine versions later than 5.3: not covered.

Sources: https://www.fab.com/o/technical-requirements, https://support.fab.com/s/article/Fab-Plugin-Compilation-Environment, https://support.fab.com/s/article/How-to-Install-a-3rd-Party-Fab-Plugin-in-Unreal-Engine-on-Linux, https://dev.epicgames.com/documentation/fab/publishing-assets-for-sale-or-free-download-in-fab

### 5. Code

Compile warnings and errors:

> **4.3.6.2.a** Code plugins must generate no errors or consequential warnings. [TR]

Includes:

> **4.3.6.2.c** Plugins being built against engine versions 4.18 onward will be ensured to be IWYU compatible. Publishers can add the following to the plugin’s .build.cs files to enable IWYU: PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs; [TR]

> **4.3.6.2.e** Plugins being built against engine versions 4.20 onward that need to include files from their own plugin directory must add those include paths using the ModuleDirectory property in their .build.cs. If using System.IO; exists at the top of the .build.cs, Publishers can use the following syntax where "MyFolder" is the name of the directory under the current module they'd like to include: PublicIncludePaths.Add(Path.Combine(ModuleDirectory, "MyFolder")); [TR]

Copyright notices:

> **4.3.6.1.b** All source and header files must contain a commented copyright notice (not the auto-generated Epic Games text) notating the publisher's name or company name as well as year of intended publishing. [TR]

Source availability and precompiled libraries:

> **4.3.6.1.a** Code plugins must not be ‘closed-source’ with regard to any code the publisher created which requires Unreal Engine source code to compile; that code must be included in the zipped up plugin folder. The only externally compiled static libraries or DLLs that would be acceptable for inclusion in a submission would be code which does not include or reference any Unreal Engine source code. Customers should have the plugin source code that's dependent on Unreal Engine source code so that they may attempt to compile it against source-built versions of the engine. [TR]

Third-party libraries and licences:

> **4.2.5.a** Publishers must declare whether or not their product includes, uses, depends on, or distributes Third-Party Software of any kind. Third-Party Software means any and all files, including, but not limited to, fonts, graphics, sounds, APIs, content, source code, or compiled libraries, from sources other than the publisher or Epic Games. [TR]

> **4.2.5.b** Code Plugins that have a Third-Party Software Usage declaration of “This Product Uses Third-Party Software”, must also have an accompanying declaration in more detail in this form. [TR]

Plus 4.3.7.3.d (proof of permission, `Source/ThirdParty` folder), quoted in section 2. For Python:

> Ensure that all third-party Python code complies with licensing requirements and is clearly documented within your submission. [AF]

Use of engine code, modules and plugins:

- 4.3.6.d (may depend on plugins distributed with the engine, not on other user-made plugins), quoted in section 3.
- 4.3.1.d (experimental or beta engine features and plugins must be stated in the description), quoted in section 1.

> **4.3.1.g** Substantial portions of source code, Blueprints, and/or Material Blueprints from Epic Games must be used for example purposes only. [TR]

What a plugin must be, and what it must not ship:

> **4.3.6.1.d** Plugins must introduce new editor functionality, integrate UE with third-party systems, or expose complex gameplay logic to blueprints. Although extra scripts and assets may be distributed with a plugin to be used in supplementary tools (such as 3D modeling software, database management systems etc.), the majority of the submission must provide additions or modifications to be used in the Unreal Editor directly. [TR]

> **4.3.6.1.e** Plugins must not distribute .exe or .msi files. [TR]

Python scripts in plugins:

> Make sure scripts are properly commented and organized. This is so that other developers and Fab reviewers can understand and maintain the scripts as needed. [AF]

> Don't include hardcoded paths or dependencies that could break outside of your local environment. [AF]

Not covered by the pages read:

- A C++ coding standard (naming, style): not covered.
- Separation of editor-only and runtime code into different modules: not covered.
- Which engine modules may or may not be listed as dependencies in .build.cs: not covered.

Sources: https://www.fab.com/o/technical-requirements, https://dev.epicgames.com/documentation/fab/asset-file-format-and-structure-requirements-in-fab

### 6. Documentation, example project, demo content

Documentation:

> **4.3.8.a** Products that require particular knowledge of how to set up or use must contain, distribute, or direct customers to free documentation that covers implementation, application, and/or modification of the associated products. This includes instructing users on how to download, install, and/or integrate any required third-party software that can't be redistributed directly via a product's files. [TR]

> **4.3.8.b** Documentation should take the form of web-based guides, txt/pdf files, code/Blueprint comments, videos, or in-editor tutorial Blueprint assets. [TR]

> **4.3.8.c** Documentation must be in English, but publishers may include translated versions of their documentation as well. [TR]

> **4.3.8.d** Provided download links must not initiate the download automatically. [TR]

For the "Tools & Plugins" product type, the documentation page says "Minimum Content: evaluated per product based on functionality.", "You must include thorough documentation.", "Overview Map: Not required." and "Demo Map: Not required, unless the product has elements that can be demonstrated." [AF]

Example projects:

> **4.3.6.3.a** All plugins purchased and imported will be installed as an engine plugin (to "\Epic Games\EngineVersion\Engine\Plugins\Fab"), not a project plugin, so publishers are strongly encouraged to create an Example Project to be used in conjunction with the plugin to display its functionality to new customers. [TR]

> **4.3.6.3.b** Publishers opting to distribute example projects for their Code Plugins should add a link to their Technical Information, beside the specification “Example Project:“, that navigates to a hosting site (such as Google Drive/Dropbox/OneDrive/etc.) at which the example project can be downloaded. [TR]

> **4.3.6.3.c** Example projects should have .uproject descriptors that depend on products’ plugins, but should not contain the actual plugins, as customers should only be installing those from Fab. [TR]

Maps, where the plugin includes content shown in the viewport:

> **4.3.2.a** Each project that has assets or functionality to be displayed in the 3d viewport of the Unreal Engine must have a map that demonstrates them. [TR]

Product page media for Blueprint functionality:

> **4.1.1.c** For Blueprint based projects, Publishers are required to include a downloadable demo project or a video URL in the Long Description that showcases the products functionality. [TR]

Whether 4.1.1.c applies to code plugins that expose Blueprint nodes: not covered.

Sources: https://www.fab.com/o/technical-requirements, https://dev.epicgames.com/documentation/fab/asset-file-format-and-structure-requirements-in-fab

### 7. Testing and review process

What Fab says it checks:

> After you submit your product for review, the Fab team checks your listing to ensure that it meets the content and technical requirements. When the review is complete, you receive an email message notifying you of the team's decision. [PUB]

> Fab has a different set of content guidelines than Unreal Engine Marketplace. Your assets might not pass review in Fab even though they passed review in Unreal Engine Marketplace. [PUB]

- Function in the latest major engine version on initial submission (4.3.1.c, quoted in section 1).
- Compilation by Epic's toolchain, with "no errors or consequential warnings" (4.3.6.2.a and 4.3.6.2.b).

How builds are verified: Epic builds the plugin and distributes the resulting binaries (4.3.6.2.b). Epic builds against the three latest major engine versions by default (4.3.6.2.d). A new build is generated when a project version is created, a project file link changes, or the distribution method changes (quoted in section 1). A detailed description of Epic's build pipeline beyond this: not covered.

Listing statuses named by Fab: Draft, Pending approval, Changes needed, Approved, Pending Publication, Live, Declined. [PUB]

> Declined: The listing or the product has significant problems. You must create a new listing and go through the review process again. [PUB]

If review fails:

> Carefully review the Fab content and policy guidelines, edit your listing to make the necessary changes, and submit it for review again. [PUB]

> Please do not resubmit your product without making the requested changes. [DECL]

Updates after publication:

> After you submit for review, two statuses will appear on your product. Live, and Update - Pending approval. The current version of your product stays live while your changes are reviewed. [PUB]

> Most updates are processed within 24 hours. However, in rare cases, changes may be needed. If so, the Fab team will contact you with additional instructions to complete your update. [PUB]

Update types that require review: Title; Description; Thumbnail; Images, Video, and 3D media; Open text engine technical details; Format files and engine packages. Update types that do not: Product type, Category, License selection, Prices, Tags, Linked forum thread, AI usage selections, Promotional content declaration, 3D technical detail fields, Supported target platforms. [PUB]

Review time for an initial submission: not covered.

A plugin-specific review checklist: not covered.

Sources: https://dev.epicgames.com/documentation/fab/publishing-assets-for-sale-or-free-download-in-fab, https://www.fab.com/o/technical-requirements, https://support.fab.com/s/article/Why-was-the-submission-declined

### 8. Content and asset rules that apply to plugins

Naming (section 4.3.7.1, under Unreal Engine, not limited to a product type):

> **4.3.7.1.a** Folders and files must be accurate and consistent in naming convention within the context of their own project. [TR]

> **4.3.7.1.b** Folders and files must not be vaguely-named such as “Assets”, "NewFolder", etc. [TR]

> **4.3.7.1.c** Folder and file names must contain only English alphanumeric characters and underscores. [TR]

Redirectors:

> **4.3.1.h** Projects must have their redirectors cleaned up. [TR]

Unused folders and assets: 4.3.7.3.a (no unused folders in plugin folders), and from the documentation page's "Unreal Engine Project Technical Requirements" list:

> The project must not contain any unused directories or assets. [AF]

File size and path length:

> Unreal Engine file format: If possible, keep the file size to 15GB or less. If your file is larger than 15GB, the Fab team reviews the file to determine if the larger size is necessary. [AF]

> Overall project size (with Saved and Intermediate folders removed) cannot exceed 15 GB before you zip the project. If the project exceeds this limit, contact Fab Support to discuss options. [AF]

File paths in a plugin must be 170 characters or less (4.3.7.3.c, quoted in section 2).

Blueprints included in a plugin:

> **4.3.5.a** Blueprints must be neatly laid out and make reasonable use of functions to organize the logic structure. [TR]

> **4.3.5.b** Functions, variables, and events should all use names that reflect their intended purpose or use in the Blueprint. [TR]

> **4.3.5.c** Blueprints must have no loose nodes unless they’re commented for example/tutorial purposes. [TR]

> **4.3.5.d** Blueprints must generate no errors or consequential warnings. [TR]

Maps included in a plugin:

> **4.3.2.b** Maps must have their lighting built. [TR]

> **4.3.2.c** Maps must have no errors or consequential warnings upon load or at the start of Play-In-Editor. [TR]

Textures: "Textures must have a maximum size in either dimension of 16384." (4.3.3.1.c) [TR]. The other art, audio and visual effects rules in TR 4.3.3 and 4.3.4 are written for Unreal Engine products in general.

Rules stated for content-only projects (single top-level folder under Content, asset paths of 140 characters or less, TR 4.3.7.2): whether these also apply to a plugin's Content folder is not covered.

Sources: https://www.fab.com/o/technical-requirements, https://dev.epicgames.com/documentation/fab/asset-file-format-and-structure-requirements-in-fab

### 9. Anything else required to pass review

Standalone value and licence or subscription models:

> Make sure that your Code Plugins offer base functionality so that the product has inherent value for buyers. You can include additional functionality through a license or subscription model if your product meets the following requirements: [AF]

followed by "The Fab minimum content standards.", "The Fab quality standards.", "Includes enough functionality to stand on its own."

Upload and download link:

> You must compress the project into a .zip file before you upload it to Fab. [AF]

> You can password protect your .zip file, but you must provide the password in the Version Notes section of the Fab listing. [AF]

> The download link that you provide must not require permissions to download. [AF]

Product page information (TR section 1.8, applies to all file types):

> **1.8.1.a** All text must be in English with correct spelling and proper grammar. [TR]

> **1.8.2.a** Products must exist in the category that is the most relevant to their functionality and style. [TR]

> **1.8.4.a** All relevant Technical Information fields must be filled out. [TR]

> **1.8.4.b** Technical Information text must identify any dependencies, prerequisites, or other requirements for use of the asset. [TR]

> **1.8.6.a** Images, videos, and models must accurately display the contents of the product. [TR]

> **1.8.8.a** Products must reflect if generative AI tools were used during creation. [TR]

Support obligations:

> **1.1.a** Publishers must ensure all their published products function as advertised, as well as assist customers who report issues when using their products as intended. [TR]

> **1.1.b** Publishers must provide and actively monitor appropriate support channels (configurable in the Publish Settings of the Fab Publisher Profile page). [TR]

Listing media: "You must add a thumbnail image for your product, and at least one of the following to your media gallery: an image, a 3D preview, or a video." (Publisher Get Started in Fab, https://dev.epicgames.com/documentation/fab/publisher-get-started-in-fab)

Other documents Fab says publishers must respect (not summarized here): Epic Games Terms of Service, Fab Terms of Service, Fab Distribution Agreement, Fab End User License Agreement, Epic Games Content Guidelines, and "Our Rules". [TR]

Sources: https://www.fab.com/o/technical-requirements, https://dev.epicgames.com/documentation/fab/asset-file-format-and-structure-requirements-in-fab, https://dev.epicgames.com/documentation/fab/publisher-get-started-in-fab

## Common rejection reasons

From "(Fab) Why was my submission declined?" (https://support.fab.com/s/article/Why-was-the-submission-declined):

> The most common reasons that products are declined on Fab are: [DECL]

- "Not enough content"
- "Not high enough quality"
- "Incorrect file format"
- "Download link either requires permissions or does not work"
- "Product has unlicensed IP content"

> A product can be declined for a number of reasons. If you have a product declined at any point, you will receive an email message that explains the reason(s) it was declined. [DECL]

General statement from the Technical Requirements:

> Although we’ll always do our best to work with publishers to resolve any issues, products may be declined at any time for failure to meet the criteria outlined in these requirements. [TR]

Rejection reasons specific to code plugins: not covered.

## Notes and ambiguities

- The home page at https://support.fab.com redirected to an Epic Games sign-in page, so it was not read. The individual support articles and the FAB FAQs index were readable without signing in. The index may list more articles than the ones seen.
- Support articles show a date next to the title without a "last updated" label. The dev.epicgames.com documentation pages show no date.
- [COMP] is dated Jan 24, 2025. It lists compilers only for engine versions 5.1 to 5.3 and refers to "the Marketplace". It says "per the Guidelines" without a link.
- Both [TR] and [COMP] use "Win32" in the example PlatformAllowList value. Neither page says which platform names are valid for which engine versions.
- Install location differs between pages: [TR] 4.3.6.3.a says "\Epic Games\EngineVersion\Engine\Plugins\Fab"; [LINUX] gives "C:\Program Files\Epic Games\UE_5.6\Engine\Plugins\Marketplace\".
- Content and Config folders: [AF] says all Code Plugin products "must contain" a Content directory and a Config directory. [TR] says plugins "can contain content as well", forbids "unused folders", and requires a Config folder with FilterPlugin.ini only when extra folders are distributed. The pages do not reconcile this.
- [TR] 4.2.2.c requires support for "at least one of the three latest engine versions", while 4.2.2.b requires the latest engine version "Upon initial submission and approval". No page states a deadline for adding a newly released engine version to an existing code plugin.
- "Consequential warnings" is not defined on any page read.
- [AF] refers to "The Fab minimum content standards" and "The Fab quality standards" for code plugins without linking to a definition; for Tools & Plugins it says minimum content is "evaluated per product based on functionality."
- [AF] states "For all other file types, the size limit is 6B." The unit appears to be a typo on the page.
- The third-party software declaration form linked from [TR] 4.2.5.b is a Google Form. It was not opened.
- "Plugins in Unreal Engine" (Unreal Engine documentation linked from [TR] 4.3.6.1.c) was checked only for Fab-specific requirements, and none were found. It is engine documentation, not a Fab requirements page.
- The Epic Games Content Guidelines, Fab Terms of Service, Fab Distribution Agreement and Fab EULA were not read for this summary.
