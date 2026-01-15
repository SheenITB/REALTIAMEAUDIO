#!/usr/bin/python3

# this script will create/update info plist files based on config.h and copy resources to the ~/Music/PLUG_NAME folder or the bundle depending on PLUG_SHARED_RESOURCES

kAudioUnitType_MusicDevice      = "aumu"
kAudioUnitType_MusicEffect      = "aumf"
kAudioUnitType_Effect           = "aufx"
kAudioUnitType_MIDIProcessor    = "aumi"

DONT_COPY = ("")

import plistlib, os, datetime, fileinput, glob, sys, string, shutil

scriptpath = os.path.dirname(os.path.realpath(__file__))
projectpath = os.path.abspath(os.path.join(scriptpath, os.pardir))

# Always resolve IPLUG2_ROOT to an absolute path so the helper scripts are found
# Allow IPLUG2_ROOT with escaped spaces (as set in xcconfig) or plain paths
IPLUG2_ROOT = os.environ.get("IPLUG2_ROOT", "/Users/endrinhysa/Documents/iPlug2")
iplug_root = os.path.abspath(IPLUG2_ROOT.replace('\\ ', ' '))

sys.path.insert(0, os.path.join(iplug_root, 'Scripts'))

from parse_config import parse_config, parse_xcconfig

def main():
  config = parse_config(projectpath)
  xcconfig = parse_xcconfig(os.path.join(iplug_root, 'common-mac.xcconfig'))

  CFBundleGetInfoString = config['BUNDLE_NAME'] + " v" + config['FULL_VER_STR'] + " " + config['PLUG_COPYRIGHT_STR']
  CFBundleVersion = config['FULL_VER_STR']
  CFBundlePackageType = "BNDL"
  CSResourcesFileMapped = True
  LSMinimumSystemVersion = xcconfig['DEPLOYMENT_TARGET']

  print("Copying resources ...")

  if config['PLUG_SHARED_RESOURCES']:
    dst = os.path.expanduser("~") + "/Music/" + config['BUNDLE_NAME'] + "/Resources"
  else:
    dst = os.path.join(os.environ["TARGET_BUILD_DIR"], os.environ["UNLOCALIZED_RESOURCES_FOLDER_PATH"].lstrip('/'))

  if os.path.exists(dst) == False:
    os.makedirs(dst + "/", 0o0755 )

  if os.path.exists(projectpath + "/resources/img/"):
    imgs = os.listdir(projectpath + "/resources/img/")
    for img in imgs:
      print("copying " + img + " to " + dst)
      shutil.copy(projectpath + "/resources/img/" + img, dst)

  if os.path.exists(projectpath + "/resources/fonts/"):
    fonts = os.listdir(projectpath + "/resources/fonts/")
    for font in fonts:
      print("copying " + font + " to " + dst)
      shutil.copy(projectpath + "/resources/fonts/" + font, dst)

  react_src_env = os.environ.get("REACT_WEB_BUILD_DIR")
  react_src_candidates = [react_src_env] if react_src_env else []
  react_src_candidates.append(os.path.expanduser("~/Downloads/Real-Time Audio Plugin/dist"))
  react_src_candidates.append(os.path.join(projectpath, "resources", "web"))
  react_src_candidates.append(os.path.expanduser("~/Desktop/LOFI TAPE/build"))

  react_src = next((path for path in react_src_candidates if path and os.path.isdir(path)), None)

  if not react_src:
    print("Error: React build directory not found. Set REACT_WEB_BUILD_DIR or build the web UI bundle.")
    return

  if react_src_env and react_src != react_src_env:
    print(f"Warning: REACT_WEB_BUILD_DIR missing, using fallback at {react_src}")

  if os.path.exists(react_src) and os.path.isdir(react_src):
    web_resource_dir = os.path.join(projectpath, "resources", "web")
    try:
      if os.path.exists(web_resource_dir):
        shutil.rmtree(web_resource_dir)
      shutil.copytree(react_src, web_resource_dir)
      print(f"Copied React build assets into {web_resource_dir}")
    except Exception as err:
      print(f"Warning: failed to refresh web resources at {web_resource_dir}: {err}")

    web_dest_dir = os.path.join(dst, "web")
    try:
      if os.path.exists(web_dest_dir):
        shutil.rmtree(web_dest_dir)
      shutil.copytree(react_src, web_dest_dir)
      print(f"Copied React build assets into bundle resources at {web_dest_dir}")
    except Exception as err:
      print(f"Warning: failed to copy React assets into bundle resources: {err}")
  else:
    print(f"Warning: React build directory not found, skipping web asset copy ({react_src})")

  print("Processing Info.plist files...")

# VST3

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-VST3-Info.plist"
  with open(plistpath, 'rb') as fp:
    vst3 = plistlib.load(fp)
  vst3['CFBundleExecutable'] = config['BUNDLE_NAME']
  vst3['CFBundleGetInfoString'] = CFBundleGetInfoString
  vst3['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".vst3." + config['BUNDLE_NAME'] + ""
  vst3['CFBundleName'] = config['BUNDLE_NAME']
  vst3['CFBundleVersion'] = CFBundleVersion
  vst3['CFBundleShortVersionString'] = CFBundleVersion
  vst3['LSMinimumSystemVersion'] = LSMinimumSystemVersion
  vst3['CFBundlePackageType'] = CFBundlePackageType
  vst3['CFBundleSignature'] = config['PLUG_UNIQUE_ID']
  vst3['CSResourcesFileMapped'] = CSResourcesFileMapped

  with open(plistpath, 'wb') as fp:
    plistlib.dump(vst3, fp)
# VST2

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-VST2-Info.plist"
  with open(plistpath, 'rb') as fp:
    vst2 = plistlib.load(fp)
  vst2['CFBundleExecutable'] = config['BUNDLE_NAME']
  vst2['CFBundleGetInfoString'] = CFBundleGetInfoString
  vst2['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".vst." + config['BUNDLE_NAME'] + ""
  vst2['CFBundleName'] = config['BUNDLE_NAME']
  vst2['CFBundleVersion'] = CFBundleVersion
  vst2['CFBundleShortVersionString'] = CFBundleVersion
  vst2['LSMinimumSystemVersion'] = LSMinimumSystemVersion
  vst2['CFBundlePackageType'] = CFBundlePackageType
  vst2['CFBundleSignature'] = config['PLUG_UNIQUE_ID']
  vst2['CSResourcesFileMapped'] = CSResourcesFileMapped

  with open(plistpath, 'wb') as fp:
    plistlib.dump(vst2, fp)
# AUDIOUNIT v2

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-AU-Info.plist"
  with open(plistpath, 'rb') as fp:
    auv2 = plistlib.load(fp)
  auv2['CFBundleExecutable'] = config['BUNDLE_NAME']
  auv2['CFBundleGetInfoString'] = CFBundleGetInfoString
  auv2['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".audiounit." + config['BUNDLE_NAME'] + ""
  auv2['CFBundleName'] = config['BUNDLE_NAME']
  auv2['CFBundleVersion'] = CFBundleVersion
  auv2['CFBundleShortVersionString'] = CFBundleVersion
  auv2['LSMinimumSystemVersion'] = LSMinimumSystemVersion
  auv2['CFBundlePackageType'] = CFBundlePackageType
  auv2['CFBundleSignature'] = config['PLUG_UNIQUE_ID']
  auv2['CSResourcesFileMapped'] = CSResourcesFileMapped

  if config['PLUG_TYPE'] == 0:
    if config['PLUG_DOES_MIDI_IN']:
      COMPONENT_TYPE = kAudioUnitType_MusicEffect
    else:
      COMPONENT_TYPE = kAudioUnitType_Effect
  elif config['PLUG_TYPE'] == 1:
    COMPONENT_TYPE = kAudioUnitType_MusicDevice
  elif config['PLUG_TYPE'] == 2:
    COMPONENT_TYPE = kAudioUnitType_MIDIProcessor

  auv2['AudioUnit Version'] = config['PLUG_VERSION_HEX']
  auv2['AudioComponents'] = [{}]
  auv2['AudioComponents'][0]['description'] = config['PLUG_NAME']
  auv2['AudioComponents'][0]['factoryFunction'] = config['AUV2_FACTORY']
  auv2['AudioComponents'][0]['manufacturer'] = config['PLUG_MFR_ID']
  auv2['AudioComponents'][0]['name'] = config['PLUG_MFR'] + ": " + config['PLUG_NAME']
  auv2['AudioComponents'][0]['subtype'] = config['PLUG_UNIQUE_ID']
  auv2['AudioComponents'][0]['type'] = COMPONENT_TYPE
  auv2['AudioComponents'][0]['version'] = config['PLUG_VERSION_INT']
  auv2['AudioComponents'][0]['sandboxSafe'] = True

  with open(plistpath, 'wb') as fp:
    plistlib.dump(auv2, fp)
# AUDIOUNIT v3

  if config['PLUG_HAS_UI']:
    NSEXTENSIONPOINTIDENTIFIER  = "com.apple.AudioUnit-UI"
  else:
    NSEXTENSIONPOINTIDENTIFIER  = "com.apple.AudioUnit"

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-macOS-AUv3-Info.plist"
  with open(plistpath, 'rb') as fp:
    auv3 = plistlib.load(fp)
  auv3['CFBundleExecutable'] = config['BUNDLE_NAME']
  auv3['CFBundleGetInfoString'] = CFBundleGetInfoString
  auv3['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".app." + config['BUNDLE_NAME'] + ".AUv3"
  auv3['CFBundleName'] = config['BUNDLE_NAME']
  auv3['CFBundleVersion'] = CFBundleVersion
  auv3['CFBundleShortVersionString'] = CFBundleVersion
  auv3['LSMinimumSystemVersion'] = "10.12.0"
  auv3['CFBundlePackageType'] = "XPC!"
  auv3['NSExtension'] = dict(
  NSExtensionAttributes = dict(
                               AudioComponentBundle = "com.ITB.app." + config['BUNDLE_NAME'] + ".AUv3Framework",
                               AudioComponents = [{}]),
#                               NSExtensionServiceRoleType = "NSExtensionServiceRoleTypeEditor",
  NSExtensionPointIdentifier = NSEXTENSIONPOINTIDENTIFIER,
  NSExtensionPrincipalClass = "IPlugAUViewController_vRealTimeAudio"
                             )
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'] = [{}]
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['description'] = config['PLUG_NAME']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['manufacturer'] = config['PLUG_MFR_ID']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['name'] = config['PLUG_MFR'] + ": " + config['PLUG_NAME']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['subtype'] = config['PLUG_UNIQUE_ID']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['type'] = COMPONENT_TYPE
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['version'] = config['PLUG_VERSION_INT']
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['sandboxSafe'] = True
  auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['tags'] = [{}]

  if config['PLUG_TYPE'] == 1:
    auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['tags'][0] = "Synth"
  else:
    auv3['NSExtension']['NSExtensionAttributes']['AudioComponents'][0]['tags'][0] = "Effects"

  with open(plistpath, 'wb') as fp:
    plistlib.dump(auv3, fp)
# AAX

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-AAX-Info.plist"
  with open(plistpath, 'rb') as fp:
    aax = plistlib.load(fp)
  aax['CFBundleExecutable'] = config['BUNDLE_NAME']
  aax['CFBundleGetInfoString'] = CFBundleGetInfoString
  aax['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".aax." + config['BUNDLE_NAME'] + ""
  aax['CFBundleName'] = config['BUNDLE_NAME']
  aax['CFBundleVersion'] = CFBundleVersion
  aax['CFBundleShortVersionString'] = CFBundleVersion
  aax['LSMinimumSystemVersion'] = LSMinimumSystemVersion
  aax['CSResourcesFileMapped'] = CSResourcesFileMapped

  with open(plistpath, 'wb') as fp:
    plistlib.dump(aax, fp)
# APP

  plistpath = projectpath + "/resources/" + config['BUNDLE_NAME'] + "-macOS-Info.plist"
  with open(plistpath, 'rb') as fp:
    macOSapp = plistlib.load(fp)
  macOSapp['CFBundleExecutable'] = config['BUNDLE_NAME']
  macOSapp['CFBundleGetInfoString'] = CFBundleGetInfoString
  macOSapp['CFBundleIdentifier'] = config['BUNDLE_DOMAIN'] + "." + config['BUNDLE_MFR'] + ".app." + config['BUNDLE_NAME'] + ""
  macOSapp['CFBundleName'] = config['BUNDLE_NAME']
  macOSapp['CFBundleVersion'] = CFBundleVersion
  macOSapp['CFBundleShortVersionString'] = CFBundleVersion
  macOSapp['LSMinimumSystemVersion'] = LSMinimumSystemVersion
  macOSapp['CFBundlePackageType'] = CFBundlePackageType
  macOSapp['CFBundleSignature'] = config['PLUG_UNIQUE_ID']
  macOSapp['CSResourcesFileMapped'] = CSResourcesFileMapped
  macOSapp['NSPrincipalClass'] = "SWELLApplication"
  macOSapp['NSMainNibFile'] = config['BUNDLE_NAME'] + "-macOS-MainMenu"
  macOSapp['LSApplicationCategoryType'] = "public.app-category.music"
  macOSapp['CFBundleIconFile'] = config['BUNDLE_NAME'] + ".icns"
  macOSapp['NSMicrophoneUsageDescription'] = 	"This app needs mic access to process audio."

  with open(plistpath, 'wb') as fp:
    plistlib.dump(macOSapp, fp)
if __name__ == '__main__':
  main()
