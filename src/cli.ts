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
import {
  summarize,
  askQuestion,
  translate,
  resolveModel,
  AI_MODELS,
} from "./ai.js";

const VERSION = "1.1.1";

interface Args {
  video: string;
  format: "text" | "json" | "srt";
  output?: string;
  lang: string;
  noTimestamps: boolean;
  listLanguages: boolean;
  help: boolean;
  version: boolean;
  // AI features
  summarize: boolean;
  ask?: string;
  translateTo?: string;
  model: string;
  apiKey?: string;
}

function printHelp(): void {
  console.log(`
ytranscript - Fetch YouTube video transcripts with AI features

Usage: ytranscript <video> [options]

Arguments:
  video                   YouTube video URL or ID

Transcript Options:
  -f, --format <type>     Output format: text, json, srt (default: text)
  -o, --output <file>     Output file (default: stdout)
  -l, --lang <code>       Language code (default: en)
  --no-timestamps         Omit timestamps in text format
  --list-languages        List available transcript languages

AI Features (requires OPENROUTER_API_KEY):
  --summarize             Summarize the transcript
  --ask <question>        Ask a question about the video
  --translate <lang>      Translate transcript to language (e.g., "Spanish")
  --model <model>         AI model to use (default: haiku)
  --api-key <key>         OpenRouter API key (or set OPENROUTER_API_KEY)

Available Models:
  haiku, sonnet, opus     Anthropic Claude models
  gpt-3.5, gpt-4o-mini    OpenAI models
  gpt-4o                  OpenAI GPT-4o
  gemini-flash, gemini-pro  Google Gemini models
  (or any OpenRouter model ID like "anthropic/claude-3-haiku")

General:
  -h, --help              Show this help
  -v, --version           Show version

Examples:
  ytranscript dQw4w9WgXcQ
  ytranscript dQw4w9WgXcQ --format json
  ytranscript dQw4w9WgXcQ --summarize
  ytranscript dQw4w9WgXcQ --ask "What is the main message?"
  ytranscript dQw4w9WgXcQ --translate Spanish
  ytranscript dQw4w9WgXcQ --summarize --model sonnet
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
    summarize: false,
    model: "haiku",
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
    } else if (arg === "--summarize") {
      args.summarize = true;
    } else if (arg === "--ask") {
      args.ask = argv[++i];
    } else if (arg === "--translate") {
      args.translateTo = argv[++i];
    } else if (arg === "--model") {
      args.model = argv[++i];
    } else if (arg === "--api-key") {
      args.apiKey = argv[++i];
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
    console.error("Usage: ytranscript <video> [options]");
    console.error("Try 'ytranscript --help' for more information.");
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
    const plainText = formatText(segments, false);

    const aiOptions = {
      model: resolveModel(args.model),
      apiKey: args.apiKey,
    };

    // AI Features
    if (args.summarize) {
      console.error(`Summarizing with ${aiOptions.model}...`);
      const summary = await summarize(plainText, aiOptions);
      console.log(summary);
      return;
    }

    if (args.ask) {
      console.error(`Asking "${args.ask}" with ${aiOptions.model}...`);
      const answer = await askQuestion(plainText, args.ask, aiOptions);
      console.log(answer);
      return;
    }

    if (args.translateTo) {
      console.error(`Translating to ${args.translateTo} with ${aiOptions.model}...`);
      const translated = await translate(plainText, args.translateTo, aiOptions);
      console.log(translated);
      return;
    }

    // Standard output
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
    } else if (err instanceof Error) {
      console.error(`Error: ${err.message}`);
    } else {
      console.error(`Error: ${err}`);
    }
    process.exit(1);
  }
}

main();
