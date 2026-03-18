import { playwrightService } from './playwright-service';
import { parseHtml } from './html-parser';
import { screenshotService } from './screenshot-service';

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
}

const DEFAULT_OPTIONS: Required<ScrapeOptions> = {
  formats: ['markdown', 'html'],
  onlyMainContent: true,
  waitFor: 2000,
  timeout: 30000,
  fullPage: false,
  includeMetadata: true,
  includeRawHtml: false,
};

export class FirecrawlClone {
  private cache: Map<string, { data: ScrapeResult; timestamp: number }> = new Map();
  private cacheMaxAge: number = 3600000;

  async scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    console.log(`[FirecrawlClone] Scraping URL: ${url}`);
    console.log(`[FirecrawlClone] Options:`, opts);

    if (this.cache.has(url)) {
      const cached = this.cache.get(url)!;
      if (Date.now() - cached.timestamp < this.cacheMaxAge) {
        console.log(`[FirecrawlClone] Returning cached result for: ${url}`);
        return cached.data;
      }
    }

    try {
      const scrapedContent = await playwrightService.scrape(url, {
        waitFor: opts.waitFor,
        timeout: opts.timeout,
        fullPage: opts.fullPage,
      });

      if (scrapedContent.status >= 400) {
        return {
          success: false,
          error: `HTTP ${scrapedContent.status}: ${url}`,
        };
      }

      const parsedContent = parseHtml(scrapedContent.html, url, {
        onlyMainContent: opts.onlyMainContent,
      });

      const result: ScrapeResult = {
        success: true,
        data: {
          title: parsedContent.title,
          description: parsedContent.description,
          markdown: opts.formats.includes('markdown') ? parsedContent.markdown : undefined as any,
          html: opts.formats.includes('html') ? parsedContent.html : undefined as any,
          links: opts.formats.includes('links') ? parsedContent.links : [],
          metadata: parsedContent.metadata,
          url: scrapedContent.url,
          statusCode: scrapedContent.status,
        },
      };

      if (opts.formats.includes('screenshot')) {
        try {
          const screenshotResult = await screenshotService.capture(url, {
            fullPage: opts.fullPage,
            waitFor: opts.waitFor,
          });
          result.data!.screenshot = screenshotResult.screenshot;
        } catch (screenshotError) {
          console.warn('[FirecrawlClone] Screenshot failed:', screenshotError);
        }
      }

      if (opts.includeRawHtml) {
        result.data!.rawHtml = scrapedContent.html;
      }

      this.cache.set(url, {
        data: result,
        timestamp: Date.now(),
      });

      console.log(`[FirecrawlClone] Successfully scraped: ${url}`);

      return result;

    } catch (error) {
      console.error(`[FirecrawlClone] Error scraping ${url}:`, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  async scrapeMultiple(urls: string[], options: ScrapeOptions = {}): Promise<ScrapeResult[]> {
    const results: ScrapeResult[] = [];

    for (const url of urls) {
      const result = await this.scrape(url, options);
      results.push(result);
    }

    return results;
  }

  async scrapeWithFallback(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    try {
      return await this.scrape(url, options);
    } catch (error) {
      console.warn(`[FirecrawlClone] Playwright failed, trying fallback for: ${url}`);

      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
        });

        if (!response.ok) {
          return {
            success: false,
            error: `HTTP ${response.status}: ${url}`,
          };
        }

        const html = await response.text();
        const parsed = parseHtml(html, url, {
          onlyMainContent: options.onlyMainContent ?? true,
        });

        return {
          success: true,
          data: {
            title: parsed.title,
            description: parsed.description,
            markdown: parsed.markdown,
            html: parsed.html,
            links: parsed.links,
            metadata: parsed.metadata,
            url,
            statusCode: response.status,
          },
        };
      } catch (fallbackError) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  }

  clearCache(): void {
    this.cache.clear();
    console.log('[FirecrawlClone] Cache cleared');
  }

  setCacheMaxAge(maxAgeMs: number): void {
    this.cacheMaxAge = maxAgeMs;
  }
}

export const firecrawlClone = new FirecrawlClone();
export default firecrawlClone;
