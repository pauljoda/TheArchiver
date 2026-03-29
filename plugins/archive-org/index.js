"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
function loadStoredCredentials(settings) {
    const access_key = settings.get("access_key") || "";
    const access_secret = settings.get("access_secret") || "";
    const logged_in_sig = settings.get("logged_in_sig") || "";
    const logged_in_user = settings.get("logged_in_user") || "";
    if (!access_key && !access_secret && !logged_in_sig && !logged_in_user) {
        return null;
    }
    return { access_key, access_secret, logged_in_sig, logged_in_user };
}
function authCookies(credentials) {
    return `logged-in-sig=${credentials.logged_in_sig}; logged-in-user=${credentials.logged_in_user}`;
}
function authHeaders(credentials) {
    if (!credentials.access_key || !credentials.access_secret)
        return {};
    return {
        Authorization: `LOW ${credentials.access_key}:${credentials.access_secret}`,
    };
}
async function downloadFileWithAuth(url, outputPath, credentials, logger) {
    const fs = await Promise.resolve().then(() => __importStar(require("fs/promises")));
    const dir = path_1.default.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    };
    if (credentials) {
        Object.assign(headers, authHeaders(credentials));
    }
    let res = await fetch(url, { headers, redirect: "manual" });
    // Handle S3 redirects manually (archive.org redirects to S3 for file content)
    if (res.status >= 300 && res.status < 400) {
        const redirectUrl = res.headers.get("location");
        if (redirectUrl) {
            logger.info(`Redirecting to: ${redirectUrl}`);
            res = await fetch(redirectUrl, { headers });
        }
    }
    if (!res.ok || !res.body) {
        throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
    }
    const { Readable } = await Promise.resolve().then(() => __importStar(require("stream")));
    const { pipeline } = await Promise.resolve().then(() => __importStar(require("stream/promises")));
    const { createWriteStream } = await Promise.resolve().then(() => __importStar(require("fs")));
    const nodeStream = Readable.fromWeb(res.body);
    const fileStream = createWriteStream(outputPath);
    await pipeline(nodeStream, fileStream);
}
async function downloadDirectory(url, outputDir, maxThreads, credentials, context) {
    const { helpers, logger } = context;
    try {
        logger.info(`Fetching directory listing: ${url}`);
        const cookies = credentials ? authCookies(credentials) : undefined;
        const html = await helpers.html.fetchPage(url, { cookies });
        logger.info(`Received ${html.length} bytes of HTML`);
        const $ = helpers.html.parse(html);
        const titleEl = $("div.download-directory-listing h1").first();
        if (!titleEl.length) {
            logger.error(`No directory listing found on page - may not be a valid /download/ page`);
            return { success: false, message: `Could not find directory listing title on ${url}` };
        }
        let title = titleEl.text().replace("Files for ", "");
        title = decodeURIComponent(helpers.string.sanitizeFilename(title));
        logger.info(`Item title: ${title}`);
        const downloadDir = path_1.default.join(outputDir, title);
        await helpers.io.ensureDir(downloadDir);
        // Extract links from the directory listing table
        const links = [];
        $("table.directory-listing-table tbody tr td a").each((_, el) => {
            const href = $(el).attr("href") || "";
            const text = $(el).text();
            links.push({ href, text });
        });
        logger.info(`Found ${links.length} total links on page`);
        const filtered = links.filter((l) => !l.text.includes("Go to parent directory") &&
            !l.text.includes("View Contents"));
        const baseUrl = url.replace(/\/+$/, "");
        const allLinks = filtered.map((l) => `${baseUrl}/${l.href}`);
        const directories = allLinks.filter((l) => l.endsWith("/"));
        const files = allLinks.filter((l) => !l.endsWith("/") && !l.includes(".ia."));
        logger.info(`Found ${files.length} files and ${directories.length} subdirectories`);
        if (files.length === 0 && directories.length === 0) {
            logger.warn(`No downloadable content found on ${url}`);
            return { success: false, message: `No downloadable files found on ${url}` };
        }
        // Download files with concurrency control
        const totalBatches = Math.ceil(files.length / maxThreads);
        for (let i = 0; i < files.length; i += maxThreads) {
            const batchNum = Math.floor(i / maxThreads) + 1;
            const chunk = files.slice(i, i + maxThreads);
            logger.info(`Downloading batch ${batchNum}/${totalBatches} (${chunk.length} files)`);
            await Promise.all(chunk.map(async (fileUrl) => {
                try {
                    const fileName = decodeURIComponent(path_1.default.basename(new URL(fileUrl).pathname));
                    const localPath = path_1.default.join(downloadDir, fileName);
                    if (await helpers.io.fileExists(localPath)) {
                        logger.info(`Skipping existing: ${fileName}`);
                        return;
                    }
                    logger.info(`Downloading: ${fileName}`);
                    await downloadFileWithAuth(fileUrl, localPath, credentials, logger);
                    logger.info(`Completed: ${fileName}`);
                }
                catch (e) {
                    logger.error(`Failed: ${fileUrl} - ${e.message}`);
                }
            }));
        }
        // Recurse into subdirectories
        for (const subDir of directories) {
            logger.info(`Entering subdirectory: ${subDir}`);
            const result = await downloadDirectory(subDir, downloadDir, maxThreads, credentials, context);
            if (!result.success)
                return result;
        }
    }
    catch (e) {
        logger.error(`Error downloading ${url}: ${e.message}`);
        return {
            success: false,
            message: `Error downloading ${url}: ${e.message}`,
        };
    }
    logger.info(`Finished downloading from ${url}`);
    return { success: true, message: `Downloaded from ${url}` };
}
const plugin = {
    name: "Archive.org",
    version: "2.0.0",
    description: "Download content from Archive.org with optional authentication",
    urlPatterns: ["https://archive.org"],
    settings: [
        {
            key: "email",
            type: "string",
            label: "Email",
            description: "Your Archive.org account email address",
            required: false,
            sortOrder: 0,
        },
        {
            key: "password",
            type: "password",
            label: "Password",
            description: "Your Archive.org account password",
            required: false,
            sortOrder: 1,
        },
        {
            key: "authenticate",
            type: "action",
            label: "Authenticate",
            description: "Login to Archive.org and fetch session cookies",
            required: false,
            sortOrder: 2,
        },
    ],
    actions: {
        async authenticate({ settings, logger }) {
            const email = settings.get("email") || "";
            const password = settings.get("password") || "";
            if (!email || !password) {
                return {
                    success: false,
                    message: "Email and password are required",
                };
            }
            try {
                const body = new URLSearchParams({ email, password });
                const res = await fetch("https://archive.org/services/xauthn/?op=login", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body,
                });
                if (!res.ok) {
                    return {
                        success: false,
                        message: `Authentication request failed: ${res.status} ${res.statusText}`,
                    };
                }
                const json = (await res.json());
                if (!json.success) {
                    const reason = json.values?.reason || "unknown error";
                    return { success: false, message: `Authentication failed: ${reason}` };
                }
                logger.info("Archive.org authentication successful");
                return {
                    success: true,
                    message: `Authenticated as ${json.values.cookies?.["logged-in-user"] || email}`,
                    settingsUpdates: [
                        { key: "access_key", value: json.values.s3?.access || "" },
                        { key: "access_secret", value: json.values.s3?.secret || "" },
                        { key: "logged_in_sig", value: json.values.cookies?.["logged-in-sig"] || "" },
                        { key: "logged_in_user", value: json.values.cookies?.["logged-in-user"] || "" },
                    ],
                };
            }
            catch (e) {
                return {
                    success: false,
                    message: `Authentication error: ${e.message}`,
                };
            }
        },
    },
    async download(context) {
        const { url, rootDirectory, maxDownloadThreads, helpers, logger, settings } = context;
        logger.info(`Starting download for: ${url}`);
        const credentials = loadStoredCredentials(settings);
        if (credentials) {
            logger.info("Using Archive.org credentials");
        }
        else {
            logger.warn("No credentials stored - downloading without authentication. Use the Authenticate button in settings to login.");
        }
        const outputDir = path_1.default.join(rootDirectory, "ArchiveOrg");
        // If already on a /download/ page, go directly to directory download
        if (url.includes("/download/")) {
            logger.info(`URL is already a download page, proceeding directly`);
            return downloadDirectory(url, outputDir, maxDownloadThreads, credentials, context);
        }
        // Extract the item identifier from the URL path and construct the /download/ URL
        // Handles: /details/{identifier}, /details/{identifier}/, and other archive.org paths
        const urlPath = new URL(url).pathname;
        const pathSegments = urlPath.split("/").filter(Boolean);
        const detailsIndex = pathSegments.indexOf("details");
        if (detailsIndex === -1 || detailsIndex + 1 >= pathSegments.length) {
            logger.error(`Could not extract item identifier from URL: ${url}`);
            return {
                success: false,
                message: `Could not extract item identifier from URL: ${url}. Expected a /details/{identifier} URL.`,
            };
        }
        const identifier = pathSegments[detailsIndex + 1];
        const downloadUrl = `https://archive.org/download/${identifier}`;
        logger.info(`Extracted identifier: ${identifier}`);
        logger.info(`Constructed download page: ${downloadUrl}`);
        return downloadDirectory(downloadUrl, outputDir, maxDownloadThreads, credentials, context);
    },
};
exports.default = plugin;
