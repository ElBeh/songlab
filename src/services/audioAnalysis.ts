// Analyze audio file and return RMS-based normalization gain
const TARGET_RMS = 0.2; // target loudness level

export async function analyzeRmsGain(file: File): Promise<number> {
  const audioContext = new AudioContext();
  const arrayBuffer = await file.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

  // Calculate RMS across all channels
  let sumSquares = 0;
  let totalSamples = 0;

  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    const channelData = audioBuffer.getChannelData(c);
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i];
    }
    totalSamples += channelData.length;
  }

  const rms = Math.sqrt(sumSquares / totalSamples);
  await audioContext.close();

  if (rms === 0) return 1.0;

  // Clamp gain to reasonable range (0.1 – 5.0)
  const gain = TARGET_RMS / rms;
  return Math.min(5.0, Math.max(0.1, gain));
}