import { NextRequest, NextResponse } from 'next/server';
import { scrape } from '@/lib/scrapers';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    console.log('[scrape-screenshot] Capturing screenshot for:', url);

    const result = await scrape(url, {
      formats: ['screenshot'],
      waitFor: 2000,
      timeout: 30000,
    });

    if (!result.success) {
      return NextResponse.json({
        error: result.error || 'Failed to capture screenshot',
        provider: result.provider,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
      screenshot: result.data?.screenshot,
      metadata: result.data?.metadata || {},
      url: result.data?.url,
    });

  } catch (error: any) {
    console.error('[scrape-screenshot] Screenshot capture error:', error);
    
    return NextResponse.json({
      error: error.message || 'Failed to capture screenshot'
    }, { status: 500 });
  }
}
