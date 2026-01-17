#include "RealTimeAudio.h"
#include "IPlug_include_in_plug_src.h"

#include <algorithm>
#include <cstring>

using namespace iplug;
using namespace igraphics;

RealTimeAudio::RealTimeAudio(const InstanceInfo& info)
: Plugin(info, MakeConfig(kNumParams, 1))
{
  GetParam(kParamGain)->InitDouble("Gain", 0., -70., 12.0, 0.01, "dB");

#ifdef DEBUG
  mEnableDevTools = true;
#endif

  mMakeGraphicsFunc = [&]() {
    return MakeGraphics(*this, PLUG_WIDTH, PLUG_HEIGHT, PLUG_FPS, GetScaleForScreen(PLUG_WIDTH, PLUG_HEIGHT));
  };

  mLayoutFunc = [&](IGraphics* g) {
    g->AttachPanelBackground(COLOR_BLACK);

    auto onReady = [this, g](IWebViewControl* webview) {
      // Load from the bundled web folder so relative asset URLs resolve inside the VST3
      webview->LoadFile("index.html", GetBundleID());
      // Mark VST3 mode right after load so React disables demo piano
      webview->EvaluateJavaScript("window.__VST3_MODE = true; if (window.__setVST3Mode) { window.__setVST3Mode(); }");
    };

    mWebView = dynamic_cast<IWebViewControl*>(g->AttachControl(new IWebViewControl(IRECT(0, 0, PLUG_WIDTH, PLUG_HEIGHT), true, onReady, nullptr, mEnableDevTools)));
  };
}

void RealTimeAudio::ProcessBlock(sample** inputs, sample** outputs, int nFrames)
{
  const int nIn = NInChansConnected();
  const int nOut = NOutChansConnected();
  const int channels = std::min(nIn, nOut);

  for (int c = 0; c < channels; ++c)
  {
    std::memcpy(outputs[c], inputs[c], sizeof(sample) * nFrames);
  }

  for (int c = channels; c < nOut; ++c)
  {
    std::fill(outputs[c], outputs[c] + nFrames, 0.0f);
  }

  SendAudioToWebView(inputs, nFrames);
}

void RealTimeAudio::SendAudioToWebView(sample** inputs, int nFrames)
{
  if (!mWebView || nFrames <= 0)
    return;

  const bool hasLeft = NInChansConnected() > 0 && inputs && inputs[0];
  const bool hasRight = NInChansConnected() > 1 && inputs && inputs[1];

  WDL_String js;
  js.Append("if (window.processDAWAudioBuffer && window.__pitchDetectorReady) {");

  js.Append("const left = new Float32Array([");
  for (int i = 0; i < nFrames; ++i)
  {
    const float sampleValue = hasLeft ? static_cast<float>(inputs[0][i]) : 0.f;
    js.AppendFormatted(32, "%f%s", sampleValue, i < nFrames - 1 ? "," : "");
  }
  js.Append("]);\n");

  js.Append("const right = new Float32Array([");
  for (int i = 0; i < nFrames; ++i)
  {
    const float sampleValue = hasRight ? static_cast<float>(inputs[1][i]) : (hasLeft ? static_cast<float>(inputs[0][i]) : 0.f);
    js.AppendFormatted(32, "%f%s", sampleValue, i < nFrames - 1 ? "," : "");
  }
  js.Append("]);\n");

  js.AppendFormatted(128, "window.processDAWAudioBuffer(left, right, %f);", GetSampleRate());
  js.Append("}");

  mWebView->EvaluateJavaScript(js.Get());
}

void RealTimeAudio::OnReset()
{
}

void RealTimeAudio::OnParamChange(int paramIdx)
{
  switch (paramIdx)
  {
    case kParamGain:
    default:
      break;
  }
}
