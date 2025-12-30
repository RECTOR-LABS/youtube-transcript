#!/usr/bin/env node

import { writeFileSync } from "node:fs";
import {
  getTranscript,
  listLanguages,
  formatText,
  formatJson,
  formatSrt,
  YouTubeTranscriptError,
} from "./index.js";

const VERSION = "1.0.0";

interface Args {
  video: string;
  format: "text" | "json" | "srt";
  output?: string;
  lang: string;
  noTimestamps: boolean;
  listLanguages: boolean;
  help: boolean;
  version: boolean;
}

function printHelp(): void {
  console.log(`
ytranscript - Fetch YouTube video transcripts

Usage: ytranscript <video> [options]

Arguments:
  video                 YouTube video URL or ID

Options:
  -f, --format <type>   Output format: text, json, srt (default: text)
  -o, --output <file>   Output file (default: stdout)
  -l, --lang <code>     Language code (default: en)
  --no-timestamps       Omit timestamps in text format
  --list-languages      List available transcript languages
  -h, --help            Show this help
  -v, --version         Show version

Examples:
  ytranscript dQw4w9WgXcQ
  ytranscript https://www.youtube.com/watch?v=dQw4w9WgXcQ
  ytranscript dQw4w9WgXcQ --format json
  ytranscript dQw4w9WgXcQ --format srt -o subtitles.srt
  ytranscript dQw4w9WgXcQ --list-languages
  ytranscript dQw4w9WgXcQ --lang es
`);
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    video: "",
    format: "text",
    lang: "en",
    noTimestamps: false,
    listLanguages: false,
    help: false,
    version: false,
  };

  const positional: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else if (arg === "-v" || arg === "--version") {
      args.version = true;
    } else if (arg === "--list-languages") {
      args.listLanguages = true;
    } else if (arg === "--no-timestamps") {
      args.noTimestamps = true;
    } else if (arg === "-f" || arg === "--format") {
      const val = argv[++i];
      if (val === "text" || val === "json" || val === "srt") {
        args.format = val;
      } else {
        console.error(`Error: Invalid format '${val}'. Use: text, json, srt`);
        process.exit(1);
      }
    } else if (arg === "-o" || arg === "--output") {
      args.output = argv[++i];
    } else if (arg === "-l" || arg === "--lang") {
      args.lang = argv[++i];
    } else if (!arg.startsWith("-")) {
      positional.push(arg);
    } else {
      console.error(`Error: Unknown option '${arg}'`);
      process.exit(1);
    }
  }

  if (positional.length > 0) {
    args.video = positional[0];
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(VERSION);
    return;
  }

  if (args.help) {
    printHelp();
    return;
  }

  if (!args.video) {
    console.error("Error: Video URL or ID required");
    console.error("Usage: yt-transcript <video> [options]");
    console.error("Try 'yt-transcript --help' for more information.");
    process.exit(1);
  }

  try {
    if (args.listLanguages) {
      const languages = await listLanguages(args.video);
      console.log("Available transcripts:");
      for (const lang of languages) {
        const auto = lang.isAuto ? " (auto-generated)" : "";
        console.log(`  ${lang.code}: ${lang.name}${auto}`);
      }
      return;
    }

    const segments = await getTranscript(args.video, args.lang);

    let output: string;
    if (args.format === "json") {
      output = formatJson(segments);
    } else if (args.format === "srt") {
      output = formatSrt(segments);
    } else {
      output = formatText(segments, !args.noTimestamps);
    }

    if (args.output) {
      writeFileSync(args.output, output, "utf-8");
      console.error(`Saved to ${args.output} (${segments.length} segments)`);
    } else {
      console.log(output);
    }
  } catch (err) {
    if (err instanceof YouTubeTranscriptError) {
      console.error(`Error: ${err.message}`);
    } else {
      console.error(`Error: ${err}`);
    }
    process.exit(1);
  }
}

main();
