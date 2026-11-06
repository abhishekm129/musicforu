import { NextRequest, NextResponse } from "next/server";
import { extractVideoId } from "@/lib/library";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("url") ?? "";
  const videoId = input.length <= 2048 ? extractVideoId(input) : null;
  if (!videoId) return NextResponse.json({ error: "Paste a valid YouTube video link or 11-character video ID." }, { status: 400 });
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`, {
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 3600 },
    });
    if (!response.ok) return NextResponse.json({ error: "YouTube could not find this video. Check that it is public and available." }, { status: 422 });
    const data = await response.json();
    if (typeof data.title !== "string" || typeof data.author_name !== "string") throw new Error("Invalid video metadata");
    return NextResponse.json({ videoId, title: data.title.slice(0, 300), artist: data.author_name.slice(0, 200) });
  } catch {
    return NextResponse.json({ error: "YouTube is taking too long to respond. Try again, or enter the title and artist manually." }, { status: 502 });
  }
}
