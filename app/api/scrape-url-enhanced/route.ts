import { NextRequest, NextResponse } from 'next/server';
import { scrape } from '@/lib/scrapers';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    
    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL is required'
      }, { status: 400 });
    }
    
    console.log('[scrape-url-enhanced] Scraping URL:', url);
    
    const result = await scrape(url, {
      formats: ['markdown', 'html', 'screenshot'],
      waitFor: 2000,
      timeout: 30000,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to scrape URL',
        provider: result.provider,
      }, { status: 500 });
    }

    const formattedContent = `
Title: ${result.data?.title || ''}
Description: ${result.data?.description || ''}
URL: ${url}

Main Content:
${result.data?.markdown || ''}
    `.trim();
    
    return NextResponse.json({
      success: true,
      url,
      provider: result.provider,
      content: formattedContent,
      screenshot: result.data?.screenshot,
      structured: {
        title: result.data?.title,
        description: result.data?.description,
        content: result.data?.markdown,
        url,
        screenshot: result.data?.screenshot
      },
      metadata: {
        scraper: result.provider,
        timestamp: new Date().toISOString(),
        contentLength: formattedContent.length,
        ...result.data?.metadata
      },
      message: `URL scraped successfully with ${result.provider}`
    });

  } catch (error) {
    console.error('[scrape-url-enhanced] Error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
