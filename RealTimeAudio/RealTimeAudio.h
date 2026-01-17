#pragma once

#include "IPlug_include_in_plug_hdr.h"
#include "IWebViewControl.h"

using namespace iplug;
using namespace igraphics;

enum EParams
{
  kParamGain = 0,
  kNumParams
};

class RealTimeAudio final : public Plugin
{
public:
  RealTimeAudio(const InstanceInfo& info);

  void ProcessBlock(sample** inputs, sample** outputs, int nFrames) override;
  void OnReset() override;
  void OnParamChange(int paramIdx) override;

private:
  void SendAudioToWebView(sample** inputs, int nFrames);

  IWebViewControl* mWebView = nullptr;
  bool mEnableDevTools = false;
};
