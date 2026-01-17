[Setup]
AppName=RealTimeAudio
AppVersion=1.0
DefaultDirName={pf}\RealTimeAudio
DefaultGroupName=RealTimeAudio
OutputDir=installer
OutputBaseFilename=RealTimeAudio_Installer
Compression=lzma
SolidCompression=yes

[Files]
Source: "build-win\RealTimeAudio.vst3\*"; DestDir: "{commoncf}\VST3\RealTimeAudio.vst3"; Flags: ignoreversion recursesubdirs

[Icons]
Name: "{group}\Uninstall RealTimeAudio"; Filename: "{uninstallexe}"