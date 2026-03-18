import { NextRequest, NextResponse } from 'next/server';
import { scrape, getScraperProvider } from '@/lib/scrapers';

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

    const result = await scrape(url, {
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
      provider: result.provider,
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
  const provider = getScraperProvider();

  return NextResponse.json({
    name: 'Scraper API',
    version: '1.0.0',
    description: 'Web scraping API with configurable provider',
    currentProvider: provider,
    providers: {
      opencode: 'Playwright-based scraper (default, free)',
      firecrawl: 'Firecrawl API (requires FIRECRAWL_API_KEY)'
    },
    configuration: {
      SCRAPER_PROVIDER: `Environment variable to switch provider (current: ${process.env.SCRAPER_PROVIDER || 'not set (defaults to opencode)'})`
    },
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
  });
}
