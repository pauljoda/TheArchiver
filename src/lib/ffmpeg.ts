import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execFileAsync = promisify(execFile);

export async function mergeAudioVideo(
  videoPath: string,
  audioPath: string,
  outputPath: string
): Promise<void> {
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  await execFileAsync("ffmpeg", [
    "-i",
    videoPath,
    "-i",
    audioPath,
    "-c",
    "copy",
    "-y",
    outputPath,
  ]);

  // Remove source files after successful merge
  await fs.unlink(videoPath);
  await fs.unlink(audioPath);
}

export async function findMediaPairs(
  directory: string
): Promise<Array<{ video: string; audio: string; output: string }>> {
  const entries = await fs.readdir(directory);
  const pairs: Array<{ video: string; audio: string; output: string }> = [];

  const videoFiles = entries.filter((e) => e.includes("-video"));
  for (const videoFile of videoFiles) {
    const baseName = videoFile.replace(/-video/, "");
    const audioFile = entries.find(
      (e) => e.includes("-audio") && e.replace(/-audio/, "") === baseName
    );

    if (audioFile) {
      pairs.push({
        video: path.join(directory, videoFile),
        audio: path.join(directory, audioFile),
        output: path.join(directory, baseName),
      });
    }
  }

  return pairs;
}
