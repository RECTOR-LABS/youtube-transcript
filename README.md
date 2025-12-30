# ytranscript

Fetch YouTube video transcripts via Innertube API. **Zero API key required.**

## Quick Start (npx)

```bash
# No install needed!
npx ytranscript VIDEO_ID

# Or with full URL
npx ytranscript https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

## Installation

```bash
# Global install
npm install -g ytranscript

# Then use directly
ytranscript VIDEO_ID
```

## CLI Usage

```bash
# Basic usage (text with timestamps)
ytranscript VIDEO_ID

# JSON format
ytranscript VIDEO_ID --format json

# SRT subtitles (save to file)
ytranscript VIDEO_ID --format srt -o subtitles.srt

# Plain text without timestamps
ytranscript VIDEO_ID --no-timestamps

# List available languages
ytranscript VIDEO_ID --list-languages

# Fetch specific language
ytranscript VIDEO_ID --lang es
```

### Output Formats

| Format | Description |
|--------|-------------|
| `text` | Plain text with timestamps (default) |
| `json` | Structured JSON with start, duration, text |
| `srt`  | SubRip subtitle format |

## Programmatic Usage

```typescript
import { getTranscript, listLanguages } from "ytranscript";

// Get transcript
const transcript = await getTranscript("VIDEO_ID");
for (const segment of transcript) {
  console.log(`[${segment.start.toFixed(1)}s] ${segment.text}`);
}

// List available languages
const languages = await listLanguages("VIDEO_ID");
for (const lang of languages) {
  console.log(`${lang.code}: ${lang.name} (auto: ${lang.isAuto})`);
}

// Get transcript in specific language
const spanishTranscript = await getTranscript("VIDEO_ID", "es");
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

1. **POST to Innertube API** (`/youtubei/v1/player`) with Android client impersonation
2. **Extract caption track URL** from response
3. **Fetch timedtext XML** from caption URL
4. **Parse XML** into structured segments

Uses YouTube's internal API - no authentication required.

## Requirements

- Node.js 18+ (uses native `fetch`)

## Limitations

- May be blocked on datacenter IPs (AWS, GCP, etc.) - works fine on residential IPs
- Age-restricted videos may not work without authentication
- YouTube may change their internal API at any time

## Python Version

A Python version is also available in `youtube_transcript.py`:

```bash
pip install requests
./youtube_transcript.py VIDEO_ID
```

## License

MIT
