import { NextRequest, NextResponse } from "next/server";
import { scrape } from '@/lib/scrapers';

export async function POST(request: NextRequest) {
  try {
    const { url, formats = ['markdown', 'html'], options = {} } = await request.json();
    
    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    console.log(`[scrape-website] Scraping URL: ${url}`);

    const result = await scrape(url, {
      formats,
      onlyMainContent: options.onlyMainContent !== false,
      waitFor: options.waitFor || 2000,
      timeout: options.timeout || 30000,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to scrape URL',
        provider: result.provider,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      provider: result.provider,
      data: {
        title: result.data?.title || "Untitled",
        content: result.data?.markdown || result.data?.html || "",
        description: result.data?.description || "",
        markdown: result.data?.markdown || "",
        html: result.data?.html || "",
        metadata: result.data?.metadata || {},
        screenshot: result.data?.screenshot || null,
        links: result.data?.links || [],
      }
    });

  } catch (error) {
    console.error("Error scraping website:", error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape website",
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
