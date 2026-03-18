import { NextRequest, NextResponse } from 'next/server';
import { firecrawlClone } from '@/lib/scrapers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { url, formats, onlyMainContent, waitFor, timeout, fullPage } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      );
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { success: false, error: 'URL must use HTTP or HTTPS protocol' },
        { status: 400 }
      );
    }

    console.log(`[scrape-opencode] Scraping URL: ${url}`);

    const result = await firecrawlClone.scrapeWithFallback(url, {
      formats: formats || ['markdown', 'html', 'screenshot'],
      onlyMainContent: onlyMainContent !== false,
      waitFor: waitFor || 2000,
      timeout: timeout || 30000,
      fullPage: fullPage || false,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to scrape URL',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    });

  } catch (error) {
    console.error('[scrape-opencode] Unexpected error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'OpenCode Scraper',
    version: '1.0.0',
    description: 'A Firecrawl-like web scraper powered by Playwright',
    endpoints: {
      POST: {
        description: 'Scrape a URL and extract content',
        body: {
          url: 'string (required) - URL to scrape',
          formats: 'array (optional) - ["markdown", "html", "screenshot", "links"]',
          onlyMainContent: 'boolean (optional) - Extract only main content',
          waitFor: 'number (optional) - Wait time for JS rendering (ms)',
          timeout: 'number (optional) - Request timeout (ms)',
          fullPage: 'boolean (optional) - Capture full page screenshot',
        },
      },
    },
    examples: {
      basic: {
        url: 'https://example.com',
      },
      withScreenshot: {
        url: 'https://example.com',
        formats: ['markdown', 'html', 'screenshot'],
      },
      fullPage: {
        url: 'https://example.com',
        formats: ['markdown', 'screenshot'],
        fullPage: true,
        waitFor: 3000,
      },
    },
  });
}
