import { NextRequest, NextResponse } from 'next/server';

/**
 * API Route to expand short URLs (like goo.gl, maps.app.goo.gl)
 * This runs server-side to avoid CORS issues
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate it's a short URL we want to expand
    if (!/^https?:\/\/(goo\.gl|maps\.app\.goo\.gl)/i.test(url)) {
      return NextResponse.json(
        { error: 'Only Google Maps short URLs are supported' },
        { status: 400 }
      );
    }

    // Follow redirects to get the final URL
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
    });

    // The final URL after all redirects
    const expandedUrl = response.url;

    if (expandedUrl && expandedUrl !== url) {
      return NextResponse.json({ expandedUrl });
    }

    // If HEAD didn't work, try GET
    const getResponse = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
    });

    if (getResponse.url && getResponse.url !== url) {
      return NextResponse.json({ expandedUrl: getResponse.url });
    }

    return NextResponse.json(
      { error: 'Could not expand URL' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error expanding URL:', error);
    return NextResponse.json(
      { error: 'Failed to expand URL' },
      { status: 500 }
    );
  }
}
