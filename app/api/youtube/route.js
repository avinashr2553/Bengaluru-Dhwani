import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const { ids } = await request.json();

    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const response = await fetch(
            `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
            {
              next: { revalidate: 3600 },
            }
          );

          if (!response.ok) {
            return {
              id,
              title: "Unknown track",
              author: "YouTube Music",
            };
          }

          const data = await response.json();

          return {
            id,
            title: data.title,
            author: data.author_name,
          };
        } catch {
          return {
            id,
            title: "Unknown track",
            author: "YouTube Music",
          };
        }
      })
    );

    return NextResponse.json(results);
  } catch {
    return NextResponse.json(
      { error: "Failed to load playlist information" },
      { status: 500 }
    );
  }
}