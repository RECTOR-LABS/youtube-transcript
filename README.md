# ytranscript

Fetch YouTube video transcripts via Innertube API with AI-powered features. **Zero YouTube API key required.**

## Quick Start

```bash
# Get transcript (no install needed!)
npx ytranscript VIDEO_ID

# Summarize a video
npx ytranscript VIDEO_ID --summarize

# Ask questions about video content
npx ytranscript VIDEO_ID --ask "What are the main points?"

# Translate transcript
npx ytranscript VIDEO_ID --translate Spanish
```

## Installation

```bash
npm install -g ytranscript
```

## CLI Usage

### Basic Transcript

```bash
# Text with timestamps (default)
ytranscript VIDEO_ID

# JSON format
ytranscript VIDEO_ID --format json

# SRT subtitles
ytranscript VIDEO_ID --format srt -o subtitles.srt

# Plain text without timestamps
ytranscript VIDEO_ID --no-timestamps

# List available languages
ytranscript VIDEO_ID --list-languages

# Fetch specific language
ytranscript VIDEO_ID --lang es
```

### AI Features

AI features require an OpenRouter API key.

**Setup (one-time):**

1. Get your free API key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. Set the environment variable:

```bash
# Linux/macOS - add to ~/.bashrc or ~/.zshrc
export OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Or pass directly via CLI
ytranscript VIDEO_ID --summarize --api-key sk-or-v1-your-key-here
```

**Usage:**

```bash
# Summarize the video
ytranscript VIDEO_ID --summarize

# Ask a question about the video
ytranscript VIDEO_ID --ask "What is the main argument?"

# Translate to another language
ytranscript VIDEO_ID --translate Japanese

# Use a specific model
ytranscript VIDEO_ID --summarize --model sonnet
ytranscript VIDEO_ID --ask "Explain the key concepts" --model gpt-4o
```

### Available Models

| Shortcut | Model | Best For |
|----------|-------|----------|
| `haiku` | Claude 3 Haiku | Fast, cheap (default) |
| `sonnet` | Claude 3.5 Sonnet | Balanced |
| `opus` | Claude 3 Opus | Best quality |
| `gpt-3.5` | GPT-3.5 Turbo | Fast, cheap |
| `gpt-4o-mini` | GPT-4o Mini | Balanced |
| `gpt-4o` | GPT-4o | Best quality |
| `gemini-flash` | Gemini Flash 1.5 | Fast |
| `gemini-pro` | Gemini Pro 1.5 | Best quality |

Or use any [OpenRouter model ID](https://openrouter.ai/models) directly.

### Output Formats

| Format | Description |
|--------|-------------|
| `text` | Plain text with timestamps (default) |
| `json` | Structured JSON with start, duration, text |
| `srt`  | SubRip subtitle format |

## Programmatic Usage

```typescript
import { getTranscript, listLanguages, formatText } from "ytranscript";
import { summarize, askQuestion, translate } from "ytranscript/ai";

// Get transcript
const transcript = await getTranscript("VIDEO_ID");
for (const segment of transcript) {
  console.log(`[${segment.start.toFixed(1)}s] ${segment.text}`);
}

// AI features (requires OPENROUTER_API_KEY)
const text = formatText(transcript, false);
const summary = await summarize(text, { model: "anthropic/claude-3-haiku" });
const answer = await askQuestion(text, "What is this about?");
const japanese = await translate(text, "Japanese");
```

### Types

```typescript
interface TranscriptSegment {
  start: number;    // Start time in seconds
  duration: number; // Duration in seconds
  text: string;     // Transcript text
}

interface LanguageInfo {
  code: string;     // Language code (e.g., "en", "es")
  name: string;     // Language name
  isAuto: boolean;  // Whether auto-generated
}
```

## How It Works

1. **Transcript**: POST to YouTube Innertube API with Android client impersonation
2. **AI Features**: Send transcript to OpenRouter API for processing

No YouTube API key needed. AI features require OpenRouter API key.

## Requirements

- Node.js 18+ (uses native `fetch`)
- OpenRouter API key (for AI features only)

## Limitations

- May be blocked on datacenter IPs (works fine on residential)
- Age-restricted videos may not work
- YouTube may change their internal API

## License

MIT
