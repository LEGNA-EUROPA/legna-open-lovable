import { appConfig } from '@/config/app.config';
import { firecrawlClone } from './firecrawl-clone';

export interface ScrapeOptions {
  formats?: ('markdown' | 'html' | 'screenshot' | 'links')[];
  onlyMainContent?: boolean;
  waitFor?: number;
  timeout?: number;
  fullPage?: boolean;
  includeMetadata?: boolean;
  includeRawHtml?: boolean;
}

export interface ScrapeResult {
  success: boolean;
  data?: {
    title: string;
    description: string;
    markdown: string;
    html: string;
    screenshot?: string;
    links: string[];
    metadata: Record<string, any>;
    rawHtml?: string;
    url: string;
    statusCode: number;
  };
  error?: string;
  provider: 'opencode' | 'firecrawl';
}

function sanitizeQuotes(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2026]/g, '...')
    .replace(/[\u00A0]/g, ' ')
    .trim();
}

async function scrapeWithFirecrawl(url: string, options: ScrapeOptions): Promise<ScrapeResult> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY not configured');
  }

  const formats = options.formats || appConfig.scraper.firecrawl.defaultFormats;

  const response = await fetch(appConfig.scraper.firecrawl.apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url,
      formats,
      waitFor: options.waitFor || appConfig.scraper.opencode.defaultWaitFor,
      timeout: options.timeout || appConfig.scraper.opencode.timeout,
      blockAds: true,
      actions: [
        { type: 'wait', milliseconds: options.waitFor || appConfig.scraper.opencode.defaultWaitFor },
        ...(options.formats?.includes('screenshot') ? [{ type: 'screenshot', fullPage: options.fullPage || false }] : [])
      ]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl API error: ${error}`);
  }

  const data = await response.json();

  if (!data.success || !data.data) {
    throw new Error('Failed to scrape content');
  }

  const { markdown, metadata, screenshot, actions } = data.data;
  const screenshotUrl = screenshot || actions?.screenshots?.[0] || null;

  return {
    success: true,
    provider: 'firecrawl',
    data: {
      title: metadata?.title || '',
      description: metadata?.description || '',
      markdown: sanitizeQuotes(markdown || ''),
      html: data.data.html || '',
      screenshot: screenshotUrl,
      links: [],
      metadata: metadata || {},
      url,
      statusCode: 200,
    }
  };
}

async function scrapeWithOpencode(url: string, options: ScrapeOptions): Promise<ScrapeResult> {
  const result = await firecrawlClone.scrape(url, {
    formats: options.formats || ['markdown', 'html'],
    onlyMainContent: options.onlyMainContent ?? true,
    waitFor: options.waitFor || appConfig.scraper.opencode.defaultWaitFor,
    timeout: options.timeout || appConfig.scraper.opencode.timeout,
    fullPage: options.fullPage || false,
  });

  return {
    ...result,
    provider: 'opencode'
  };
}

export async function scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
  const provider = appConfig.scraper.provider;

  console.log(`[scraper] Using provider: ${provider}`);

  if (provider === 'firecrawl') {
    if (!process.env.FIRECRAWL_API_KEY) {
      console.warn('[scraper] Firecrawl requested but API key not configured, falling back to opencode');
    } else {
      try {
        return await scrapeWithFirecrawl(url, options);
      } catch (error) {
        console.error('[scraper] Firecrawl failed, falling back to opencode:', error);
      }
    }
  }

  return scrapeWithOpencode(url, options);
}

export function getScraperProvider(): 'opencode' | 'firecrawl' {
  return appConfig.scraper.provider as 'opencode' | 'firecrawl';
}

export default { scrape, getScraperProvider };
