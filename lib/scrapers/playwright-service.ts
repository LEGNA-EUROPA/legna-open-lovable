import { chromium, type Browser, type Page, type ChromiumBrowser, type Route } from 'playwright';

export interface ScrapingOptions {
  waitFor?: number;
  timeout?: number;
  fullPage?: boolean;
  onlyMainContent?: boolean;
  blockAds?: boolean;
  userAgent?: string;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface ScrapedContent {
  html: string;
  text: string;
  screenshot?: string;
  url: string;
  status: number;
}

export interface BrowserPool {
  browser: ChromiumBrowser;
  lastUsed: number;
}

class PlaywrightService {
  private browser: ChromiumBrowser | null = null;
  private browserPool: BrowserPool | null = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;

  private readonly DEFAULT_USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  ];

  private readonly DEFAULT_VIEWPORT = { width: 1920, height: 1080 };

  async initialize(): Promise<void> {
    if (this.browser) return;

    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        console.log('[PlaywrightService] Launching browser...');
        this.browser = await chromium.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
          ],
        });
        console.log('[PlaywrightService] Browser launched successfully');
      } catch (error) {
        console.error('[PlaywrightService] Failed to launch browser:', error);
        throw error;
      } finally {
        this.isInitializing = false;
      }
    })();

    return this.initPromise;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private getRandomUserAgent(): string {
    return this.DEFAULT_USER_AGENTS[Math.floor(Math.random() * this.DEFAULT_USER_AGENTS.length)];
  }

  private async createPage(): Promise<Page> {
    await this.initialize();

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const context = await this.browser.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: this.DEFAULT_VIEWPORT,
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (
        url.includes('google-analytics') ||
        url.includes('googletagmanager') ||
        url.includes('facebook.net') ||
        url.includes('hotjar') ||
        url.includes('intercom') ||
        url.includes('adservice') ||
        url.includes('doubleclick')
      ) {
        route.abort();
      } else {
        route.continue();
      }
    });

    return page;
  }

  async scrape(url: string, options: ScrapingOptions = {}): Promise<ScrapedContent> {
    const {
      waitFor = 2000,
      timeout = 30000,
      fullPage = false,
      userAgent,
      viewport = this.DEFAULT_VIEWPORT,
    } = options;

    console.log(`[PlaywrightService] Scraping: ${url}`);

    let context: any = null;

    try {
      await this.initialize();

      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      context = await this.browser.newContext({
        userAgent: userAgent || this.getRandomUserAgent(),
        viewport,
        ignoreHTTPSErrors: true,
      });

      const newPage = await context.newPage();

      newPage.route('**/*', (route: Route) => {
        const reqUrl = route.request().url();
        const blockedDomains = [
          'google-analytics', 'googletagmanager', 'facebook.net',
          'hotjar', 'intercom', 'adservice', 'doubleclick', 'adnxs',
          'criteo', 'taboola', 'outbrain', 'mixpanel', 'segment'
        ];

        if (blockedDomains.some(domain => reqUrl.includes(domain))) {
          route.abort();
        } else {
          route.continue();
        }
      });

      const response = await newPage.goto(url, {
        waitUntil: 'networkidle',
        timeout,
      });

      const status = response?.status() || 200;

      if (status >= 400) {
        throw new Error(`HTTP ${status}: ${url}`);
      }

      await newPage.waitForTimeout(waitFor);

      const html = await newPage.content();
      const text = await newPage.evaluate(() => document.body?.innerText || '');

      let screenshot: string | undefined;
      try {
        screenshot = await newPage.screenshot({
          fullPage,
          type: 'png',
        }) as unknown as string;
      } catch (screenshotError) {
        console.warn('[PlaywrightService] Screenshot failed:', screenshotError);
      }

      await newPage.close().catch(() => {});

      return {
        html,
        text,
        screenshot,
        url: newPage.url(),
        status,
      };

    } catch (error) {
      console.error(`[PlaywrightService] Error scraping ${url}:`, error);
      throw error;
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  async takeScreenshot(url: string, options: ScrapingOptions = {}): Promise<string> {
    const {
      waitFor = 2000,
      timeout = 30000,
      fullPage = false,
    } = options;

    const content = await this.scrape(url, {
      waitFor,
      timeout,
      fullPage,
    });

    if (!content.screenshot) {
      throw new Error('Failed to capture screenshot');
    }

    return content.screenshot;
  }

  async scrapeBatch(urls: string[], options: ScrapingOptions = {}): Promise<ScrapedContent[]> {
    const results: ScrapedContent[] = [];

    for (const url of urls) {
      try {
        const content = await this.scrape(url, options);
        results.push(content);
      } catch (error) {
        console.error(`[PlaywrightService] Failed to scrape ${url}:`, error);
        results.push({
          html: '',
          text: '',
          url,
          status: 0,
        });
      }
    }

    return results;
  }
}

export const playwrightService = new PlaywrightService();
export default playwrightService;
