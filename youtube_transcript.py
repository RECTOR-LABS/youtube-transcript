#!/usr/bin/env python3
"""
YouTube Transcript Fetcher
Fetches transcripts using YouTube's Innertube API (Android client impersonation).

Usage:
    # As CLI
    ./youtube_transcript.py https://www.youtube.com/watch?v=VIDEO_ID
    ./youtube_transcript.py VIDEO_ID --format json
    ./youtube_transcript.py VIDEO_ID --format srt --output transcript.srt

    # As module
    from youtube_transcript import get_transcript
    transcript = get_transcript("VIDEO_ID")
"""

import argparse
import html
import json
import re
import sys
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from typing import Optional

try:
    import requests
except ImportError:
    print("Error: requests library required. Install with: pip install requests")
    sys.exit(1)


@dataclass
class TranscriptSegment:
    start: float  # seconds
    duration: float  # seconds
    text: str

    def to_dict(self) -> dict:
        return {"start": self.start, "duration": self.duration, "text": self.text}


class YouTubeTranscriptError(Exception):
    """Base exception for transcript errors."""
    pass


class NoTranscriptError(YouTubeTranscriptError):
    """No transcript available for this video."""
    pass


class FetchError(YouTubeTranscriptError):
    """Failed to fetch transcript."""
    pass


def extract_video_id(url_or_id: str) -> str:
    """Extract video ID from URL or return as-is if already an ID."""
    patterns = [
        r"(?:youtube\.com/watch\?v=|youtu\.be/|youtube\.com/embed/)([a-zA-Z0-9_-]{11})",
        r"^([a-zA-Z0-9_-]{11})$",
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    raise ValueError(f"Invalid YouTube URL or video ID: {url_or_id}")


def get_caption_tracks(video_id: str) -> list[dict]:
    """Fetch available caption tracks via Innertube API."""
    innertube_url = "https://www.youtube.com/youtubei/v1/player"
    payload = {
        "context": {
            "client": {
                "clientName": "ANDROID",
                "clientVersion": "19.09.37",
                "androidSdkVersion": 30,
                "hl": "en",
                "gl": "US",
            }
        },
        "videoId": video_id,
    }
    headers = {
        "User-Agent": "com.google.android.youtube/19.09.37",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(innertube_url, json=payload, headers=headers, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise FetchError(f"Failed to fetch video info: {e}")

    data = resp.json()

    # Check for playability errors
    playability = data.get("playabilityStatus", {})
    if playability.get("status") != "OK":
        reason = playability.get("reason", "Unknown error")
        raise FetchError(f"Video not playable: {reason}")

    # Extract caption tracks
    captions = data.get("captions", {})
    renderer = captions.get("playerCaptionsTracklistRenderer", {})
    tracks = renderer.get("captionTracks", [])

    if not tracks:
        raise NoTranscriptError(f"No captions available for video: {video_id}")

    return tracks


def fetch_transcript_xml(caption_url: str) -> str:
    """Fetch raw transcript XML from caption URL."""
    headers = {"User-Agent": "com.google.android.youtube/19.09.37"}

    try:
        resp = requests.get(caption_url, headers=headers, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as e:
        raise FetchError(f"Failed to fetch transcript: {e}")

    if not resp.text:
        raise FetchError("Empty transcript response")

    return resp.text


def parse_timedtext_xml(xml_content: str) -> list[TranscriptSegment]:
    """Parse YouTube timedtext format 3 XML."""
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        raise FetchError(f"Failed to parse transcript XML: {e}")

    segments = []

    # Format 3: <p t="ms" d="ms">text or <s>word</s>...</p>
    for p_elem in root.findall(".//p"):
        start_ms = int(p_elem.get("t", 0))
        dur_ms = int(p_elem.get("d", 0))

        # Try to collect text from <s> children first
        s_elements = p_elem.findall("s")
        if s_elements:
            words = [s_elem.text or "" for s_elem in s_elements]
            line_text = "".join(words).strip()
        else:
            # No <s> elements - get direct text content
            line_text = "".join(p_elem.itertext()).strip()

        if line_text:
            segments.append(
                TranscriptSegment(
                    start=start_ms / 1000,
                    duration=dur_ms / 1000,
                    text=html.unescape(line_text),
                )
            )

    # Fallback: Format 1 with <text> elements
    if not segments:
        for text_elem in root.findall(".//text"):
            start = float(text_elem.get("start", 0))
            dur = float(text_elem.get("dur", 0))
            content = text_elem.text or ""
            if content.strip():
                segments.append(
                    TranscriptSegment(
                        start=start,
                        duration=dur,
                        text=html.unescape(content.strip()),
                    )
                )

    return segments


def get_transcript(
    video_id_or_url: str,
    language: str = "en",
) -> list[TranscriptSegment]:
    """
    Fetch transcript for a YouTube video.

    Args:
        video_id_or_url: YouTube video ID or URL
        language: Preferred language code (default: "en")

    Returns:
        List of TranscriptSegment objects

    Raises:
        NoTranscriptError: No captions available
        FetchError: Failed to fetch or parse transcript
        ValueError: Invalid video ID/URL
    """
    video_id = extract_video_id(video_id_or_url)
    tracks = get_caption_tracks(video_id)

    # Find matching language or use first available
    caption_url = None
    for track in tracks:
        if track.get("languageCode", "").startswith(language):
            caption_url = track["baseUrl"]
            break

    if not caption_url:
        # Use first available track
        caption_url = tracks[0]["baseUrl"]

    xml_content = fetch_transcript_xml(caption_url)
    return parse_timedtext_xml(xml_content)


def list_languages(video_id_or_url: str) -> list[dict]:
    """List available transcript languages for a video."""
    video_id = extract_video_id(video_id_or_url)
    tracks = get_caption_tracks(video_id)
    return [
        {
            "code": t.get("languageCode", ""),
            "name": t.get("name", {}).get("simpleText", ""),
            "is_auto": t.get("kind", "") == "asr",
        }
        for t in tracks
    ]


# Output formatters
def format_text(segments: list[TranscriptSegment], timestamps: bool = True) -> str:
    """Format as plain text."""
    lines = []
    for seg in segments:
        if timestamps:
            lines.append(f"[{seg.start:7.2f}s] {seg.text}")
        else:
            lines.append(seg.text)
    return "\n".join(lines)


def format_json(segments: list[TranscriptSegment]) -> str:
    """Format as JSON."""
    return json.dumps([s.to_dict() for s in segments], indent=2, ensure_ascii=False)


def format_srt(segments: list[TranscriptSegment]) -> str:
    """Format as SRT subtitles."""

    def to_srt_time(seconds: float) -> str:
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    lines = []
    for i, seg in enumerate(segments, 1):
        start_time = to_srt_time(seg.start)
        end_time = to_srt_time(seg.start + seg.duration)
        lines.append(f"{i}")
        lines.append(f"{start_time} --> {end_time}")
        lines.append(seg.text)
        lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Fetch YouTube video transcripts via Innertube API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s https://www.youtube.com/watch?v=dQw4w9WgXcQ
  %(prog)s dQw4w9WgXcQ --format json
  %(prog)s dQw4w9WgXcQ --format srt -o subtitles.srt
  %(prog)s dQw4w9WgXcQ --list-languages
  %(prog)s dQw4w9WgXcQ --lang es
        """,
    )
    parser.add_argument("video", help="YouTube video URL or ID")
    parser.add_argument(
        "-f",
        "--format",
        choices=["text", "json", "srt"],
        default="text",
        help="Output format (default: text)",
    )
    parser.add_argument(
        "-o", "--output", help="Output file (default: stdout)"
    )
    parser.add_argument(
        "-l", "--lang", default="en", help="Language code (default: en)"
    )
    parser.add_argument(
        "--no-timestamps",
        action="store_true",
        help="Omit timestamps in text format",
    )
    parser.add_argument(
        "--list-languages",
        action="store_true",
        help="List available transcript languages",
    )

    args = parser.parse_args()

    try:
        if args.list_languages:
            languages = list_languages(args.video)
            print("Available transcripts:")
            for lang in languages:
                auto = " (auto-generated)" if lang["is_auto"] else ""
                print(f"  {lang['code']}: {lang['name']}{auto}")
            return

        segments = get_transcript(args.video, language=args.lang)

        if args.format == "json":
            output = format_json(segments)
        elif args.format == "srt":
            output = format_srt(segments)
        else:
            output = format_text(segments, timestamps=not args.no_timestamps)

        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(output)
            print(f"Saved to {args.output} ({len(segments)} segments)", file=sys.stderr)
        else:
            print(output)

    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
    except YouTubeTranscriptError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    import signal
    signal.signal(signal.SIGPIPE, signal.SIG_DFL)  # Handle broken pipe gracefully
    main()
