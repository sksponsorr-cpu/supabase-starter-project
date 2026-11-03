import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/**
 * Découpe une vidéo dans le navigateur : garde les `seconds` premières secondes, en MP4.
 * Le moteur (FFmpeg WebAssembly) est chargé une seule fois, à la première découpe.
 */
const CORE_VERSION = "0.12.6";
const CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core-st@${CORE_VERSION}/dist/esm`;

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

async function getFfmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (!loading) {
    loading = (async () => {
      const ff = new FFmpeg();
      await ff.load({
        coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
      });
      instance = ff;
      return ff;
    })();
  }
  return loading;
}

export async function trimVideoTo(
  file: File,
  seconds: number,
  onProgress?: (percent: number) => void,
): Promise<File> {
  const ff = await getFfmpeg();
  const handler = ({ progress }: { progress: number }) => onProgress?.(Math.min(99, Math.round(progress * 100)));
  ff.on("progress", handler);
  try {
    await ff.writeFile("input.mp4", await fetchFile(file));
    await ff.exec([
      "-i", "input.mp4",
      "-t", String(seconds),
      "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
      "-c:a", "aac",
      "-movflags", "+faststart",
      "output.mp4",
    ]);
    const data = await ff.readFile("output.mp4");
    await ff.deleteFile("input.mp4");
    await ff.deleteFile("output.mp4");
    onProgress?.(100);
    const bytes = data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return new File([copy], "source.mp4", { type: "video/mp4" });
  } finally {
    ff.off("progress", handler);
  }
}
