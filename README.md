# YouTube Transcript

Fetch YouTube video transcripts using YouTube's internal Innertube API (Android client impersonation). No API key required.

## Features

- Fetches transcripts via Innertube API (no authentication needed)
- Multiple output formats: text, JSON, SRT
- Works as CLI tool and Python module
- Multi-language support
- No Selenium/browser automation required

## Installation

```bash
# Clone the repo
git clone https://github.com/RECTOR-LABS/youtube-transcript.git
cd youtube-transcript

# Install dependencies
pip install requests

# Make executable (optional)
chmod +x youtube_transcript.py
```

## CLI Usage

```bash
# Basic usage (text with timestamps)
./youtube_transcript.py https://www.youtube.com/watch?v=VIDEO_ID

# Using video ID directly
./youtube_transcript.py VIDEO_ID

# JSON format
./youtube_transcript.py VIDEO_ID --format json

# SRT subtitles (save to file)
./youtube_transcript.py VIDEO_ID --format srt -o subtitles.srt

# Plain text without timestamps
./youtube_transcript.py VIDEO_ID --no-timestamps

# List available languages
./youtube_transcript.py VIDEO_ID --list-languages

# Fetch specific language
./youtube_transcript.py VIDEO_ID --lang es
```

### Output Formats

| Format | Description |
|--------|-------------|
| `text` | Plain text with timestamps (default) |
| `json` | Structured JSON with start, duration, text |
| `srt`  | SubRip subtitle format |

## Python Module Usage

```python
from youtube_transcript import get_transcript, list_languages

# Get transcript
transcript = get_transcript("VIDEO_ID")
for segment in transcript:
    print(f"[{segment.start:.1f}s] {segment.text}")

# List available languages
languages = list_languages("VIDEO_ID")
for lang in languages:
    print(f"{lang['code']}: {lang['name']} (auto: {lang['is_auto']})")

# Get transcript in specific language
transcript = get_transcript("VIDEO_ID", language="es")
```

### TranscriptSegment Properties

| Property | Type | Description |
|----------|------|-------------|
| `start` | float | Start time in seconds |
| `duration` | float | Duration in seconds |
| `text` | str | Transcript text |

## How It Works

1. **POST to Innertube API** (`/youtubei/v1/player`) with Android client impersonation
2. **Extract caption track URL** from response
3. **Fetch timedtext XML** from caption URL
4. **Parse XML** into structured segments

This approach uses YouTube's internal API that serves the web/mobile clients, bypassing the need for official API keys.

## Limitations

- May be blocked on datacenter IPs (AWS, GCP, etc.) - works fine on residential IPs
- Age-restricted videos may not work without authentication
- YouTube may change their internal API at any time

## License

MIT

## Credits

Inspired by [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api) Python library.
