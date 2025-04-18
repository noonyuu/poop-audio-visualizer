import { useState, useEffect, useRef } from "react";

export default function VoiceWaveVisualizer() {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  const [pitch, setPitch] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 音声の取得と解析を開始する
  const startListening = async () => {
    try {
      // AudioContextの初期化
      audioContextRef.current = new (window.AudioContext ||
        (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

      // マイクからの音声取得
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // 音声の解析設定
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsListening(true);

      // 波形の更新を開始
      updateWaveform();
    } catch (err) {
      console.error("マイクへのアクセスに失敗しました:", err);
    }
  };

  // 音声の取得と解析を停止する
  const stopListening = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setIsListening(false);
    setVolume(0);
    setPitch(0);
  };

  // 音声波形とデータを更新する
  const updateWaveform = () => {
    if (!analyserRef.current || !canvasRef.current) {
      animationFrameRef.current = requestAnimationFrame(updateWaveform);
      return;
    }

    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext("2d");

    if (!canvasCtx) return;

    // キャンバスのサイズをウィンドウに合わせる
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;

    // 音声データの処理
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // 時間領域のデータを取得（波形用）
    analyser.getByteTimeDomainData(dataArray);

    // 周波数領域のデータを取得（ピッチ検出用）
    const frequencyData = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(frequencyData);

    // 音量の計算（波形データの平均偏差）
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += Math.abs(dataArray[i] - 128);
    }
    const newVolume = Math.min((sum / bufferLength) * 4, 100);
    setVolume(newVolume);

    // 主要周波数（ピッチ）の検出
    let maxValue = 0;
    let maxIndex = 0;
    for (let i = 0; i < frequencyData.length; i++) {
      if (frequencyData[i] > maxValue) {
        maxValue = frequencyData[i];
        maxIndex = i;
      }
    }
    // 0-100の範囲に正規化
    const normalizedPitch = Math.min(maxIndex / 20, 100);
    setPitch(normalizedPitch);

    // 描画処理
    canvasCtx.fillStyle = "rgb(20, 20, 30)";
    canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

    canvasCtx.lineWidth = 3;
    canvasCtx.strokeStyle = `hsl(${normalizedPitch * 2}, 100%, 50%)`;
    canvasCtx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    // 音量に基づいて波形の表示範囲を調整
    const amplitudeFactor = (newVolume / 50) * (normalizedPitch / 50 + 0.5);

    for (let i = 0; i < bufferLength; i++) {
      const v = (dataArray[i] / 128.0 - 1.0) * amplitudeFactor;
      const y = canvas.height / 2 + (v * canvas.height) / 2;

      if (i === 0) {
        canvasCtx.moveTo(x, y);
      } else {
        canvasCtx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    canvasCtx.lineTo(canvas.width, canvas.height / 2);
    canvasCtx.stroke();

    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  };

  // コンポーネント解除時のクリーンアップ
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-900 p-4 text-white">
      <h1 className="mb-6 text-3xl font-bold">声の波形ビジュアライザー</h1>

      <div className="relative mb-6 h-64 w-full max-w-3xl overflow-hidden rounded-lg bg-gray-800">
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      <div className="mb-6 w-full max-w-3xl">
        <div className="mb-2 flex justify-between">
          <span>音量:</span>
          <span>{Math.round(volume)}%</span>
        </div>
        <div className="h-4 w-full rounded-full bg-gray-700">
          <div
            className="h-4 rounded-full bg-blue-500"
            style={{ width: `${volume}%` }}
          />
        </div>
      </div>

      <div className="mb-8 w-full max-w-3xl">
        <div className="mb-2 flex justify-between">
          <span>音程:</span>
          <span>{Math.round(pitch)}%</span>
        </div>
        <div className="h-4 w-full rounded-full bg-gray-700">
          <div
            className="h-4 rounded-full bg-green-500"
            style={{ width: `${pitch}%` }}
          />
        </div>
      </div>

      <button
        onClick={isListening ? stopListening : startListening}
        className={`rounded-lg px-6 py-3 text-lg font-bold transition-colors ${
          isListening
            ? "bg-red-600 hover:bg-red-700"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        {isListening ? "停止" : "叫ぶ!"}
      </button>

      <div className="mt-8 text-center text-gray-400">
        <p>大きい声を出すと波が大きくなります</p>
        <p>高い音程を出すと波の振幅が変化します</p>
      </div>
    </div>
  );
}
