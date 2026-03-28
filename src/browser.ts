import { chromium, Browser, Page } from 'playwright';
import { ViewportSize } from './utils.js';

export interface ConsoleEntry {
  type: 'log' | 'info' | 'warning' | 'error' | 'pageerror';
  text: string;
  timestamp: number;
  location?: string;
}

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private currentViewport: ViewportSize | null = null;
  private currentUrl: string | null = null;
  private consoleLogs: ConsoleEntry[] = [];

  async ensureBrowser(): Promise<void> {
    if (!this.browser) {
      try {
        this.browser = await chromium.launch({ headless: true });
      } catch (error: any) {
        if (error.message?.includes('Executable doesn\'t exist') || error.message?.includes('browserType.launch')) {
          throw new Error(
            'Chromium browser not found. Run "npx playwright install chromium" to install it.'
          );
        }
        throw error;
      }
    }
  }

  async getPage(url: string, viewport: ViewportSize, reload?: boolean): Promise<Page> {
    await this.ensureBrowser();

    if (!this.page) {
      const context = await this.browser!.newContext({ viewport });
      this.page = await context.newPage();
      this.setupConsoleCapture(this.page);
      this.currentViewport = viewport;

      await this.page.goto(url, { timeout: 45000, waitUntil: 'load' });
      this.currentUrl = url;

      await this.waitForNetworkIdle();
      await this.disableAnimations();
      return this.page;
    }

    // Update viewport if different
    if (!this.currentViewport || this.currentViewport.width !== viewport.width || this.currentViewport.height !== viewport.height) {
      await this.page.setViewportSize(viewport);
      this.currentViewport = viewport;
    }

    // Navigate if URL changed or reload requested
    if (this.currentUrl !== url || reload) {
      await this.page.goto(url, { timeout: 45000, waitUntil: 'load' });
      this.currentUrl = url;
      await this.waitForNetworkIdle();
    }

    await this.disableAnimations();
    return this.page;
  }

  private async waitForNetworkIdle(): Promise<void> {
    try {
      await this.page!.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      // Non-fatal: some pages never reach networkidle
    }
  }

  private async disableAnimations(): Promise<void> {
    await this.page!.evaluate(() => {
      let style = document.getElementById('__glimpse_no_anim');
      if (!style) {
        style = document.createElement('style');
        style.id = '__glimpse_no_anim';
        document.head.appendChild(style);
      }
      style.textContent = '*, *::before, *::after { animation-duration: 0s !important; transition-duration: 0s !important; }';
    });
  }

  async enableAnimations(): Promise<void> {
    if (!this.page) return;
    await this.page.evaluate(() => {
      const style = document.getElementById('__glimpse_no_anim');
      if (style) style.textContent = '';
    });
  }

  private setupConsoleCapture(page: Page): void {
    page.on('console', (msg) => {
      const rawType = msg.type() as string;
      let type: ConsoleEntry['type'];
      if (rawType === 'warn' || rawType === 'warning') {
        type = 'warning';
      } else if (rawType === 'error') {
        type = 'error';
      } else if (rawType === 'info') {
        type = 'info';
      } else {
        type = 'log';
      }

      const loc = msg.location();
      let location: string | undefined;
      if (loc && loc.url) {
        location = `${loc.url}:${loc.lineNumber}`;
      }

      this.consoleLogs.push({
        type,
        text: msg.text(),
        timestamp: Date.now(),
        location,
      });

      // Keep only last 500 entries
      if (this.consoleLogs.length > 500) {
        this.consoleLogs = this.consoleLogs.slice(-500);
      }
    });

    page.on('pageerror', (error) => {
      this.consoleLogs.push({
        type: 'pageerror',
        text: error.message,
        timestamp: Date.now(),
      });
    });
  }

  getConsoleLogs(): ConsoleEntry[] {
    return [...this.consoleLogs];
  }

  clearConsoleLogs(): void {
    this.consoleLogs = [];
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.currentViewport = null;
      this.currentUrl = null;
      this.consoleLogs = [];
    }
  }
}
