import { playwrightService } from './playwright-service';

export interface ScreenshotOptions {
  fullPage?: boolean;
  waitFor?: number;
  width?: number;
  height?: number;
  format?: 'png' | 'jpeg' | 'webp';
  quality?: number;
}

export interface ScreenshotResult {
  screenshot: string;
  base64: string;
  width: number;
  height: number;
  url: string;
}

const DEFAULT_SCREENSHOT_OPTIONS: ScreenshotOptions = {
  fullPage: false,
  waitFor: 2000,
  width: 1920,
  height: 1080,
  format: 'png',
};

class ScreenshotService {
  async capture(
    url: string,
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult> {
    const mergedOptions = { ...DEFAULT_SCREENSHOT_OPTIONS, ...options };

    console.log(`[ScreenshotService] Capturing screenshot: ${url}`);

    try {
      const content = await playwrightService.scrape(url, {
        waitFor: mergedOptions.waitFor,
        timeout: 30000,
        fullPage: mergedOptions.fullPage,
        viewport: {
          width: mergedOptions.width!,
          height: mergedOptions.height!,
        },
      });

      if (!content.screenshot) {
        throw new Error('Failed to capture screenshot');
      }

      const base64 = Buffer.from(content.screenshot).toString('base64');

      return {
        screenshot: `data:image/${mergedOptions.format};base64,${base64}`,
        base64,
        width: mergedOptions.width!,
        height: mergedOptions.height!,
        url: content.url,
      };
    } catch (error) {
      console.error('[ScreenshotService] Error capturing screenshot:', error);
      throw error;
    }
  }

  async captureViewport(url: string, waitFor: number = 2000): Promise<ScreenshotResult> {
    return this.capture(url, { fullPage: false, waitFor });
  }

  async captureFullPage(url: string, waitFor: number = 2000): Promise<ScreenshotResult> {
    return this.capture(url, { fullPage: true, waitFor });
  }

  async captureMultiple(
    urls: string[],
    options: ScreenshotOptions = {}
  ): Promise<ScreenshotResult[]> {
    const results: ScreenshotResult[] = [];

    for (const url of urls) {
      try {
        const result = await this.capture(url, options);
        results.push(result);
      } catch (error) {
        console.error(`[ScreenshotService] Failed to capture ${url}:`, error);
        results.push({
          screenshot: '',
          base64: '',
          width: 0,
          height: 0,
          url,
        });
      }
    }

    return results;
  }
}

export const screenshotService = new ScreenshotService();
export default screenshotService;
