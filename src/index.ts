/**
 * YouTube Transcript Fetcher
 * Fetches transcripts using YouTube's Innertube API (Android client impersonation).
 */

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface LanguageInfo {
  code: string;
  name: string;
  isAuto: boolean;
}

export class YouTubeTranscriptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "YouTubeTranscriptError";
  }
}

export class NoTranscriptError extends YouTubeTranscriptError {
  constructor(message: string) {
    super(message);
    this.name = "NoTranscriptError";
  }
}

export class FetchError extends YouTubeTranscriptError {
  constructor(message: string) {
    super(message);
    this.name = "FetchError";
  }
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  name?: { simpleText?: string };
  kind?: string;
}

interface InnertubeResponse {
  playabilityStatus?: {
    status?: string;
    reason?: string;
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: CaptionTrack[];
    };
  };
}

const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player";
const USER_AGENT = "com.google.android.youtube/19.09.37";

export function extractVideoId(urlOrId: string): string {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = urlOrId.match(pattern);
    if (match) {
      return match[1];
    }
  }

  throw new YouTubeTranscriptError(`Invalid YouTube URL or video ID: ${urlOrId}`);
}

async function getCaptionTracks(videoId: string): Promise<CaptionTrack[]> {
  const payload = {
    context: {
      client: {
        clientName: "ANDROID",
        clientVersion: "19.09.37",
        androidSdkVersion: 30,
        hl: "en",
        gl: "US",
      },
    },
    videoId,
  };

  let response: Response;
  try {
    response = await fetch(INNERTUBE_URL, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new FetchError(`Failed to fetch video info: ${err}`);
  }

  if (!response.ok) {
    throw new FetchError(`Failed to fetch video info: HTTP ${response.status}`);
  }

  const data: InnertubeResponse = await response.json();

  const playability = data.playabilityStatus;
  if (playability?.status !== "OK") {
    const reason = playability?.reason ?? "Unknown error";
    throw new FetchError(`Video not playable: ${reason}`);
  }

  const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    throw new NoTranscriptError(`No captions available for video: ${videoId}`);
  }

  return tracks;
}

async function fetchTranscriptXml(captionUrl: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(captionUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (err) {
    throw new FetchError(`Failed to fetch transcript: ${err}`);
  }

  if (!response.ok) {
    throw new FetchError(`Failed to fetch transcript: HTTP ${response.status}`);
  }

  const text = await response.text();
  if (!text) {
    throw new FetchError("Empty transcript response");
  }

  return text;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseTimedTextXml(xmlContent: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  // Format 3: <p t="ms" d="ms">text or <s>word</s>...</p>
  const pRegex = /<p\s+t="(\d+)"(?:\s+d="(\d+)")?[^>]*>([\s\S]*?)<\/p>/g;
  const sRegex = /<s[^>]*>([^<]*)<\/s>/g;

  let pMatch;
  while ((pMatch = pRegex.exec(xmlContent)) !== null) {
    const startMs = parseInt(pMatch[1], 10);
    const durMs = parseInt(pMatch[2] || "0", 10);
    const innerContent = pMatch[3];

    // Try to extract from <s> elements first
    const words: string[] = [];
    let sMatch;
    while ((sMatch = sRegex.exec(innerContent)) !== null) {
      words.push(sMatch[1]);
    }
    sRegex.lastIndex = 0;

    let lineText: string;
    if (words.length > 0) {
      lineText = words.join("").trim();
    } else {
      // No <s> elements - get direct text content, strip any remaining tags
      lineText = innerContent.replace(/<[^>]+>/g, "").trim();
    }

    if (lineText) {
      segments.push({
        start: startMs / 1000,
        duration: durMs / 1000,
        text: decodeHtmlEntities(lineText),
      });
    }
  }

  // Fallback: Format 1 with <text> elements
  if (segments.length === 0) {
    const textRegex = /<text\s+start="([^"]+)"(?:\s+dur="([^"]+)")?[^>]*>([^<]*)<\/text>/g;
    let textMatch;
    while ((textMatch = textRegex.exec(xmlContent)) !== null) {
      const start = parseFloat(textMatch[1]);
      const dur = parseFloat(textMatch[2] || "0");
      const content = textMatch[3].trim();

      if (content) {
        segments.push({
          start,
          duration: dur,
          text: decodeHtmlEntities(content),
        });
      }
    }
  }

  return segments;
}

export async function getTranscript(
  videoIdOrUrl: string,
  language = "en"
): Promise<TranscriptSegment[]> {
  const videoId = extractVideoId(videoIdOrUrl);
  const tracks = await getCaptionTracks(videoId);

  let captionUrl: string | undefined;
  for (const track of tracks) {
    if (track.languageCode.startsWith(language)) {
      captionUrl = track.baseUrl;
      break;
    }
  }

  if (!captionUrl) {
    captionUrl = tracks[0].baseUrl;
  }

  const xmlContent = await fetchTranscriptXml(captionUrl);
  return parseTimedTextXml(xmlContent);
}

export async function listLanguages(videoIdOrUrl: string): Promise<LanguageInfo[]> {
  const videoId = extractVideoId(videoIdOrUrl);
  const tracks = await getCaptionTracks(videoId);

  return tracks.map((track) => ({
    code: track.languageCode,
    name: track.name?.simpleText ?? "",
    isAuto: track.kind === "asr",
  }));
}

export function formatText(segments: TranscriptSegment[], timestamps = true): string {
  return segments
    .map((seg) =>
      timestamps ? `[${seg.start.toFixed(2).padStart(7)}s] ${seg.text}` : seg.text
    )
    .join("\n");
}

export function formatJson(segments: TranscriptSegment[]): string {
  return JSON.stringify(segments, null, 2);
}

export function formatSrt(segments: TranscriptSegment[]): string {
  const toSrtTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")},${millis.toString().padStart(3, "0")}`;
  };

  return segments
    .map((seg, i) => {
      const startTime = toSrtTime(seg.start);
      const endTime = toSrtTime(seg.start + seg.duration);
      return `${i + 1}\n${startTime} --> ${endTime}\n${seg.text}\n`;
    })
    .join("\n");
}
