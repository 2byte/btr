import { Browser, connect } from "puppeteer";

export class RemoteBrowserConnector {
  public endpoint?: string;
  private browser?: Browser;

  constructor(endpoint?: string) {
    this.endpoint = endpoint;
  }

  static createRemoteBrowser(endpoint: string): RemoteBrowserConnector {
    return new this(endpoint);
  }

  async launch(endpoint: string | undefined = this.endpoint): Promise<void> {
    if (!endpoint) {
      throw new Error("Endpoint is not defined");
    }

    this.browser = await connect({
      browserURL: endpoint,
      defaultViewport: null,
      ignoreHTTPSErrors: true,
    });
  }

  getBrowser(): Browser | undefined {
    return this.browser;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = undefined;
    }
  }

  async isConnected(): Promise<boolean> {
    return this.browser ? this.browser.connected : false;
  }

  async newTab(endpoint: string, cookies?: any[]): Promise<any> {
    if (!this.browser) {
      await this.launch();
    }

    const page = await this.browser!.newPage();
    if (cookies && cookies.length > 0) {
      await page.setCookie(...cookies);
    }
    return page.goto(endpoint, { waitUntil: "networkidle2" })!;
  }

  async setCookies(cookies: any[]): Promise<void> {
    if (!this.browser) {
      throw new Error("Browser is not connected.");
    }

    const pages = await this.browser.pages();
    if (pages.length === 0) {
      throw new Error("No pages available in the browser.");
    }
    await pages[0].setCookie(...cookies);
  }

  cookieStringToObject(cookieString: string, domain: string): any {
    const [nameValue, ...attributes] = cookieString.split(";").map(part => part.trim());
    const [name, value] = nameValue.split("=");
    const cookie: any = { name, value, domain };
    attributes.forEach(attr => {
      const [attrName, attrValue] = attr.split("=");
      cookie[attrName.toLowerCase()] = attrValue;
    });
    return cookie;
  }

  /**
   * Returns a list of tabs (pages) with basic info: id, url, title.
   */
  async getAllTabs(): Promise<Array<{ id: string | null; url: string; title: string }>> {
    if (!this.browser) {
      throw new Error("Browser is not connected.");
    }

    const getTitleWithTimeout = (page: any, timeout: number): Promise<string> => {
      return new Promise((resolve) => {
        let resolved = false;
        const timer = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve("");
          }
        }, timeout);

        page.title().then((title: string) => {
          if (!resolved) {
            resolved = true;
            resolve(title);
          }
        });
      });
    };

    const pages = await this.browser.pages();
    const result = await Promise.all(
      pages.map(async (page) => {
        // console.log("Getting info for page with URL:", page.url());
        const target = page.target() as any;
        const id = target?._targetId ?? target?._targetInfo?.targetId ?? null;
        const url = page.url();
        const title = await getTitleWithTimeout(page, 5000);
        return { id, url, title };
      })
    );
    // console.log("Tabs info:", result);
    return result;
  }

  /**
   * Close a tab by its id. Returns true if a tab was found and closed.
   */
  async closeTab(tabId: string): Promise<boolean> {
    if (!this.browser) {
      throw new Error("Browser is not connected.");
    }

    const pages = await this.browser.pages();
    const page = pages.find((p) => {
      const target = (p.target() as any);
      const id = target?._targetId ?? target?._targetInfo?.targetId ?? null;
      return id === tabId;
    });

    if (!page) {
      return false;
    }

    await page.close();
    return true;
  }

  /**
   * Close all open tabs and return the number of tabs closed.
   */
  async closeAllTabs(): Promise<number> {
    if (!this.browser) {
      throw new Error("Browser is not connected.");
    }

    const pages = await this.browser.pages();
    let closed = 0;
    await Promise.all(
      pages.map(async (p) => {
        try {
          await p.close();
          closed++;
        } catch (e) {
          // ignore individual close errors
        }
      })
    );
    return closed;
  }
}
