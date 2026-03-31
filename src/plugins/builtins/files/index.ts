import path from "path";
import type {
  ArchiverPlugin,
  PluginSettingDefinition,
} from "../../types";

// ── Default extension-to-folder mappings (seeded on first boot) ──

const DEFAULT_EXTENSION_MAP: Record<string, string> = {
  // Images
  ".jpg": "Images", ".jpeg": "Images", ".png": "Images", ".gif": "Images",
  ".webp": "Images", ".bmp": "Images", ".svg": "Images", ".tiff": "Images",
  ".tif": "Images", ".avif": "Images", ".ico": "Images", ".heic": "Images",
  ".heif": "Images", ".raw": "Images", ".cr2": "Images", ".nef": "Images",
  ".arw": "Images", ".dng": "Images", ".jxl": "Images",
  // Videos
  ".mp4": "Videos", ".mkv": "Videos", ".avi": "Videos", ".mov": "Videos",
  ".wmv": "Videos", ".flv": "Videos", ".webm": "Videos", ".m4v": "Videos",
  ".mpg": "Videos", ".mpeg": "Videos", ".3gp": "Videos", ".ts": "Videos",
  ".vob": "Videos", ".ogv": "Videos", ".m2ts": "Videos",
  // Audio
  ".mp3": "Audio", ".flac": "Audio", ".wav": "Audio", ".aac": "Audio",
  ".ogg": "Audio", ".oga": "Audio", ".wma": "Audio", ".m4a": "Audio",
  ".opus": "Audio", ".aiff": "Audio", ".aif": "Audio", ".alac": "Audio",
  ".mid": "Audio", ".midi": "Audio", ".ape": "Audio", ".wv": "Audio",
  // Documents
  ".pdf": "Documents", ".doc": "Documents", ".docx": "Documents",
  ".xls": "Documents", ".xlsx": "Documents", ".ppt": "Documents",
  ".pptx": "Documents", ".odt": "Documents", ".ods": "Documents",
  ".odp": "Documents", ".txt": "Documents", ".rtf": "Documents",
  ".csv": "Documents", ".tsv": "Documents", ".pages": "Documents",
  ".numbers": "Documents", ".key": "Documents", ".tex": "Documents",
  ".md": "Documents",
  // Archives
  ".zip": "Archives", ".rar": "Archives", ".7z": "Archives",
  ".tar": "Archives", ".gz": "Archives", ".bz2": "Archives",
  ".xz": "Archives", ".zst": "Archives", ".lz4": "Archives",
  ".cab": "Archives", ".lzma": "Archives", ".z": "Archives",
  // Ebooks
  ".epub": "Ebooks", ".mobi": "Ebooks", ".azw": "Ebooks",
  ".azw3": "Ebooks", ".fb2": "Ebooks", ".cbz": "Ebooks",
  ".cbr": "Ebooks", ".djvu": "Ebooks", ".lit": "Ebooks",
  // Code
  ".js": "Code", ".py": "Code", ".java": "Code",
  ".cpp": "Code", ".c": "Code", ".h": "Code", ".hpp": "Code",
  ".go": "Code", ".rs": "Code", ".rb": "Code", ".php": "Code",
  ".html": "Code", ".css": "Code", ".json": "Code", ".xml": "Code",
  ".yaml": "Code", ".yml": "Code", ".sh": "Code", ".sql": "Code",
  ".swift": "Code", ".kt": "Code", ".scala": "Code", ".r": "Code",
  ".lua": "Code", ".pl": "Code", ".toml": "Code", ".ini": "Code",
  ".cfg": "Code", ".conf": "Code",
  // Fonts
  ".ttf": "Fonts", ".otf": "Fonts", ".woff": "Fonts",
  ".woff2": "Fonts", ".eot": "Fonts",
  // 3D Models
  ".stl": "3D Models", ".obj": "3D Models", ".fbx": "3D Models",
  ".blend": "3D Models", ".step": "3D Models", ".stp": "3D Models",
  ".iges": "3D Models", ".igs": "3D Models", ".3mf": "3D Models",
  ".dae": "3D Models", ".gltf": "3D Models", ".glb": "3D Models",
  // Installers
  ".exe": "Installers", ".msi": "Installers", ".dmg": "Installers",
  ".deb": "Installers", ".rpm": "Installers", ".appimage": "Installers",
  ".pkg": "Installers", ".apk": "Installers", ".snap": "Installers",
  ".flatpak": "Installers",
  // Disk Images
  ".iso": "Disk Images", ".img": "Disk Images", ".vmdk": "Disk Images",
  ".vdi": "Disk Images", ".vhd": "Disk Images", ".vhdx": "Disk Images",
  ".qcow2": "Disk Images",
  // Torrents
  ".torrent": "Torrents",
  // Subtitles
  ".srt": "Subtitles", ".ass": "Subtitles", ".ssa": "Subtitles",
  ".vtt": "Subtitles", ".sub": "Subtitles", ".idx": "Subtitles",
  // Data
  ".db": "Data", ".sqlite": "Data", ".sqlite3": "Data",
  ".bak": "Data", ".dump": "Data",
};

// Build options list for the extension-directory-map UI
const ALL_KNOWN_EXTENSIONS: Array<{ label: string; value: string }> =
  [...new Set(Object.keys(DEFAULT_EXTENSION_MAP))]
    .sort()
    .map((ext) => ({ label: ext, value: ext }));

// ── Plugin settings ──

const pluginSettings: PluginSettingDefinition[] = [
  {
    key: "default_folder",
    type: "string",
    label: "Default Folder",
    description:
      "Folder for files with unrecognized or unmapped extensions",
    defaultValue: "Downloads",
    sortOrder: 0,
  },
  {
    key: "organize_by_hostname",
    type: "boolean",
    label: "Organize by Hostname",
    description:
      "Create subfolders per source website (e.g. Images/example.com/photo.jpg instead of Images/photo.jpg)",
    defaultValue: false,
    sortOrder: 1,
  },
  {
    key: "extension_folders",
    type: "extension-directory-map",
    label: "Extension Folder Map",
    description:
      "Map file extensions to download folders. Files matching an extension are saved to the specified folder.",
    defaultValue: JSON.stringify(DEFAULT_EXTENSION_MAP),
    sortOrder: 2,
    validation: {
      options: ALL_KNOWN_EXTENSIONS,
    },
  },
];

// ── Plugin definition ──

const filesPlugin: ArchiverPlugin = {
  name: "Files",
  version: "1.0.0",
  description: "Download any file and organize by extension into folders",
  author: "TheArchiver",
  urlPatterns: [],
  settings: pluginSettings,

  async download(context) {
    const { url, rootDirectory, helpers, logger, settings } = context;

    logger.info(`Starting file download: ${url}`);

    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { success: false, message: `Invalid URL: ${url}` };
    }

    // Extract extension from pathname (naturally strips query params)
    const ext = path.extname(parsed.pathname).toLowerCase();

    // Resolve target folder from extension map
    const defaultFolder = settings.get<string>("default_folder") || "Downloads";
    const organizeByHostname = settings.get<boolean>("organize_by_hostname");
    let targetFolder = defaultFolder;

    const mapJson = settings.get<string>("extension_folders");
    if (mapJson) {
      try {
        const extMap: Record<string, string> = JSON.parse(mapJson);
        if (ext && extMap[ext]) {
          targetFolder = extMap[ext];
        }
      } catch {
        logger.warn("extension_folders setting is not valid JSON, using default folder");
      }
    }

    // Derive filename from URL pathname
    let rawFilename = path.basename(parsed.pathname);
    if (!rawFilename || rawFilename === "/" || rawFilename === "") {
      // No filename in URL — generate one from hostname + timestamp
      const timestamp = Date.now();
      const suffix = ext || "";
      rawFilename = `${parsed.hostname}-${timestamp}${suffix}`;
    }

    const filename = helpers.string.sanitizeFilename(
      decodeURIComponent(rawFilename)
    );
    if (!filename) {
      return { success: false, message: "Could not derive a valid filename from URL" };
    }

    // Build output path
    let outputDir: string;
    if (organizeByHostname) {
      outputDir = path.join(rootDirectory, targetFolder, parsed.hostname);
    } else {
      outputDir = path.join(rootDirectory, targetFolder);
    }

    await helpers.io.ensureDir(outputDir);
    const outputPath = path.join(outputDir, filename);

    // Skip if already downloaded
    if (await helpers.io.fileExists(outputPath)) {
      logger.info(`File already exists, skipping: ${filename}`);
      return { success: true, message: `Already downloaded: ${filename}` };
    }

    // Attempt download — try original URL first
    try {
      logger.info(`Downloading to: ${outputPath}`);
      await helpers.io.downloadFile(url, outputPath);
      logger.info(`Download complete: ${filename}`);
      return { success: true, message: `Downloaded: ${filename}` };
    } catch (firstError) {
      // If URL has query params, retry without them
      if (parsed.search) {
        const strippedUrl = parsed.origin + parsed.pathname;
        logger.warn(
          `Download failed with query params, retrying without: ${strippedUrl}`
        );
        try {
          await helpers.io.downloadFile(strippedUrl, outputPath);
          logger.info(`Download complete (stripped query params): ${filename}`);
          return { success: true, message: `Downloaded: ${filename}` };
        } catch {
          // Both attempts failed — report the original error
        }
      }

      const errorMsg =
        firstError instanceof Error ? firstError.message : "Download failed";
      logger.error(`Failed to download: ${errorMsg}`);
      return { success: false, message: errorMsg };
    }
  },
};

export default filesPlugin;
