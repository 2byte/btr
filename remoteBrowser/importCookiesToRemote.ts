import puppeteer from "puppeteer";

export type Cookie = {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number; // seconds since epoch
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None" | "unspecified" | undefined;
};

/**
 * Extract cookies by visiting provided origins using a real profile userDataDir
 * @param profilePath path to Chrome user data directory (Default profile folder)
 * @param origins array of origins to visit (e.g. ['https://example.com'])
 */
export async function extractCookies(profilePath: string, origins: string[]): Promise<Cookie[]> {
  if (!origins || origins.length === 0) {
    throw new Error("At least one origin is required to extract cookies");
  }
  const browser = await puppeteer.launch({
    headless: "new",
    args: [`--user-data-dir=${profilePath}`],
  });

  console.log(`Launched browser with profile at ${profilePath}`);
  console.log("Origins to visit:", origins);

  try {
    const cookies: Cookie[] = [];

    for (const origin of origins) {
      const page = await browser.newPage();
      try {
        await page
          .goto(origin, { waitUntil: "domcontentloaded", timeout: 15000 })
          .catch(() => null);
        const pageCookies = await page.cookies();
        for (const c of pageCookies) {
          cookies.push({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            expires: c.expires ? Math.floor(c.expires) : undefined,
            httpOnly: c.httpOnly,
            secure: c.secure,
            sameSite: (c.sameSite as any) || undefined,
          });
        }
      } finally {
        await page.close();
      }
    }

    // deduplicate by name+domain+path
    const map = new Map<string, Cookie>();
    for (const c of cookies) {
      const key = `${c.name}|${c.domain}|${c.path || "/"} `;
      map.set(key, c);
    }

    return Array.from(map.values());
  } finally {
    await browser.close();
  }
}

/**
 * POST cookies JSON to remote server endpoint, returns parsed JSON response
 */
export async function postCookiesToRemote(remoteUrl: string, cookies: Cookie[]): Promise<any> {
  const res = await fetch(remoteUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookies }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to post cookies: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Connect to an existing Chrome instance (remote debugging) and set cookies there.
 * @param wsEndpoint Either a browserWSEndpoint (ws://...) or browserURL (http://localhost:9222)
 */
export async function setCookiesToRemote(wsEndpoint: string, cookies: Cookie[]): Promise<void> {
  if (!wsEndpoint) throw new Error("wsEndpoint is required");

  // Prefer CDP pathway where possible (avoid puppeteer.connect hanging)
  const isHttpLike =
    wsEndpoint.startsWith("http://") ||
    wsEndpoint.startsWith("https://") ||
    wsEndpoint.startsWith("ws://") ||
    wsEndpoint.startsWith("wss://");
  if (isHttpLike) {
    // convert ws://host:port/... to http://host:port
    let browserBaseUrl = wsEndpoint;
    if (wsEndpoint.startsWith("ws://") || wsEndpoint.startsWith("wss://")) {
      const u = new URL(wsEndpoint);
      browserBaseUrl = `${u.protocol.startsWith("wss") ? "https" : "http"}://${u.hostname}${u.port ? `:${u.port}` : ""}`;
    }

    try {
      await setCookiesViaCDP(browserBaseUrl, cookies);
      return;
    } catch (err) {
      console.warn("[setCookiesToRemote] CDP path failed, falling back to puppeteer.connect:", err);
      // continue to puppeteer.connect fallback
    }
  }

  let browser: any;

  // Try to get browser-level websocket (more reliable) from /json/version
  try {
    if (!wsEndpoint.startsWith("ws://") && !wsEndpoint.startsWith("wss://")) {
      const verResp = await fetch(`${wsEndpoint.replace(/\/$/, "")}/json/version`);
      if (verResp.ok) {
        const ver = await verResp.json();
        const browserWs = ver.webSocketDebuggerUrl;
        if (browserWs) {
          console.log("[Fallback] connecting to browserWS", browserWs);
          browser = await puppeteer.connect({
            browserWSEndpoint: browserWs,
            defaultViewport: null,
          });
        }
      }
    }
  } catch (e) {
    console.warn("[Fallback] failed to get browserWSEndpoint:", e);
  }

  try {
    if (!browser) {
      // last resort: try to connect using puppeteer.connect with browserURL or browserWSEndpoint
      const connectOptions: any = {};
      if (wsEndpoint.startsWith("ws://") || wsEndpoint.startsWith("wss://")) {
        connectOptions.browserWSEndpoint = wsEndpoint;
      } else {
        connectOptions.browserURL = wsEndpoint; // e.g. http://localhost:9222
      }
      console.log("[Fallback] connecting puppeteer with connect options", connectOptions);
      browser = await puppeteer.connect(connectOptions);
    }

    // group cookies by domain
    const map = new Map<string, Cookie[]>();
    for (const c of cookies) {
      const domain = (c.domain || "").replace(/^\./, "");
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(c);
    }

    for (const [domain, domainCookies] of map) {
      console.log(
        `[Fallback] Puppeteer setting ${domainCookies.length} cookies for domain ${domain}`
      );
      const page = await browser.newPage();
      try {
        const url = `https://${domain}/`;
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null);

        const mapped = domainCookies.map((c: any) => {
          const out: any = {
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || "/",
            httpOnly: !!c.httpOnly,
            secure: !!c.secure,
          };
          if (c.expires !== undefined) out.expires = c.expires;
          if (c.sameSite) out.sameSite = c.sameSite;
          return out;
        });

        await page.setCookie(...mapped);
      } finally {
        await page.close();
      }
    }
  } finally {
    try {
      await browser.disconnect();
    } catch (e) {
      // ignore
    }
  }
  try {
    // group cookies by domain
    const map = new Map<string, Cookie[]>();
    for (const c of cookies) {
      const domain = (c.domain || "").replace(/^\./, "");
      if (!map.has(domain)) map.set(domain, []);
      map.get(domain)!.push(c);
    }

    for (const [domain, domainCookies] of map) {
      console.log(`Setting ${domainCookies.length} cookies for domain ${domain}...`);
      const page = await browser.newPage();
      try {
        const url = `https://${domain}/`;
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => null);

        const mapped = domainCookies.map((c: any) => {
          const out: any = {
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || "/",
            httpOnly: !!c.httpOnly,
            secure: !!c.secure,
          };
          if (c.expires !== undefined) out.expires = c.expires;
          if (c.sameSite) out.sameSite = c.sameSite;
          return out;
        });

        await page.setCookie(...mapped);
      } finally {
        await page.close();
      }
    }
  } finally {
    // disconnect from remote browser; do not close it
    try {
      await browser.disconnect();
    } catch (e) {
      // ignore
    }
  }
}

/**
 * Set cookies via Chrome DevTools Protocol using the HTTP /json/new -> per-target WebSocket
 * This avoids puppeteer.connect and uses the lightweight CDP commands directly.
 */
export async function setCookiesViaCDP(browserBaseUrl: string, cookies: Cookie[]): Promise<void> {
  if (!browserBaseUrl) throw new Error("browserBaseUrl is required");
  browserBaseUrl = browserBaseUrl.replace(/\/$/, "");

  async function createWs(url: string, timeout = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      let ws: any;
      const timer = setTimeout(() => onError(new Error("WebSocket connect timeout")), timeout);
      const onOpen = () => {
        cleanup();
        resolve(ws);
      };
      const onError = (err: any) => {
        cleanup();
        reject(err || new Error("WebSocket error"));
      };
      const cleanup = () => {
        clearTimeout(timer);
        try {
          if (!ws) return;
          if (typeof ws.removeEventListener === "function") {
            ws.removeEventListener("open", onOpen);
            ws.removeEventListener("error", onError);
          } else {
            ws.off && ws.off("open", onOpen);
            ws.off && ws.off("error", onError);
          }
        } catch (e) {}
      };

      if (typeof WebSocket !== "undefined") {
        ws = new WebSocket(url);
        ws.addEventListener("open", onOpen);
        ws.addEventListener("error", onError);
      } else {
        // @ts-ignore: optional ws for Node environments
        import("ws")
          .then((m: any) => {
            ws = new m.default(url);
            ws.on("open", onOpen);
            ws.on("error", onError);
          })
          .catch(onError);
      }
    });
  }

  function makeRpc(ws: any) {
    let id = 1;
    const pending = new Map<number, (data: any) => void>();

    const onMessage = (msg: any) => {
      let data: any;
      try {
        const s = typeof msg.data === "string" ? msg.data : msg.toString ? msg.toString() : msg;
        data = JSON.parse(s);
      } catch (e) {
        return;
      }
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)!(data);
        pending.delete(data.id);
      }
    };

    if (typeof ws.addEventListener === "function") {
      ws.addEventListener("message", onMessage);
    } else {
      ws.on("message", onMessage);
    }

    return (method: string, params: any = {}) => {
      return new Promise<any>((resolve, reject) => {
        const curId = id++;
        const payload = JSON.stringify({ id: curId, method, params });
        pending.set(curId, (data: any) => {
          if (data.error) return reject(new Error(data.error.message || "CDP error"));
          resolve(data.result);
        });
        try {
          ws.send(payload);
        } catch (e) {
          pending.delete(curId);
          return reject(e);
        }
        setTimeout(() => {
          if (pending.has(curId)) {
            pending.delete(curId);
            reject(new Error("CDP RPC timeout"));
          }
        }, 5000);
      });
    };
  }

  // group cookies by domain
  const map = new Map<string, Cookie[]>();
  for (const c of cookies) {
    const domain = (c.domain || "").replace(/^\./, "");
    if (!map.has(domain)) map.set(domain, []);
    map.get(domain)!.push(c);
  }

  for (const [domain, domainCookies] of map) {
    const targetUrl = `https://${domain}/`;
    // Try creating a new target via /json/new
    let targetInfo: any = null;
    let wsUrl: string | undefined;

    try {
      const createResp = await fetch(`${browserBaseUrl}/json/new?${encodeURIComponent(targetUrl)}`);
      if (createResp.ok) {
        targetInfo = await createResp.json();
        wsUrl = targetInfo.webSocketDebuggerUrl;
      } else {
        // If /json/new is not allowed (405) or fails, fall back to browser-level Target.createTarget
        if (createResp.status === 405) {
          // use /json/version to get browser WebSocket
          const verResp = await fetch(`${browserBaseUrl}/json/version`);
          if (!verResp.ok) throw new Error(`/json/version failed: ${verResp.status}`);
          const ver = await verResp.json();
          const browserWs = ver.webSocketDebuggerUrl;
          if (!browserWs) throw new Error("No browser-level webSocketDebuggerUrl in /json/version");

          const bws = await createWs(browserWs);
          const brpc = makeRpc(bws);

          // create and attach to target, then use Target.sendMessageToTarget to forward Network.setCookie
          const created = await brpc("Target.createTarget", { url: targetUrl }).catch((e: any) => {
            throw new Error("Target.createTarget failed: " + (e.message || e));
          });
          const targetId = created?.targetId;
          if (!targetId) throw new Error("Target.createTarget returned no targetId");

          const attached = await brpc("Target.attachToTarget", { targetId, flatten: true }).catch(
            (e: any) => {
              throw new Error("Target.attachToTarget failed: " + (e.message || e));
            }
          );
          const sessionId = attached?.sessionId;
          if (!sessionId) throw new Error("Attach returned no sessionId");

          const sendMessage = (method: string, params: any = {}) =>
            brpc("Target.sendMessageToTarget", {
              sessionId,
              message: JSON.stringify({ id: 1, method, params }),
            });

          // enable network
          await sendMessage("Network.enable");

          for (const c of domainCookies) {
            const params: any = {
              name: c.name,
              value: c.value,
              url: targetUrl,
              path: c.path || "/",
              domain: c.domain,
              secure: !!c.secure,
              httpOnly: !!c.httpOnly,
            };
            if (c.expires !== undefined) params.expires = c.expires;
            if (c.sameSite) params.sameSite = c.sameSite;

            try {
              await sendMessage("Network.setCookie", params);
            } catch (e: any) {
              console.warn("[CDP via browser] setCookie failed for", c.name, e.message || e);
            }
          }

          try {
            await brpc("Target.detachFromTarget", { sessionId });
          } catch (e) {}
          try {
            bws.close && bws.close();
          } catch (e) {}
          try {
            await fetch(`${browserBaseUrl}/json/close/${targetId}`);
          } catch (e) {}

          // target handled, continue to next domain
          continue;
        } else {
          // other failures: try to find existing target entry
          const listResp = await fetch(`${browserBaseUrl}/json`);
          const list = await listResp.json();
          const found = list.find((t: any) => t.url && t.url.startsWith(targetUrl));
          wsUrl = found && found.webSocketDebuggerUrl;
          targetInfo = found || null;

          // if no matching target, we'll later try attaching to ANY existing target via browser-level ws
        }
      }
    } catch (err: any) {
      console.warn(
        "[CDP] create target failed, trying to find existing target:",
        err.message || err
      );
    }

    if (!wsUrl) {
      // if we couldn't get a page-level websocket, try attaching to any existing target via browser-level ws
      try {
        const listResp = await fetch(`${browserBaseUrl}/json`);
        const list = await listResp.json();
        const anyTarget = list.find(
          (t: any) => t.type === "page" || t.type === "page" || t.webSocketDebuggerUrl
        );
        if (anyTarget) {
          // attach to it using browser-level ws
          const verResp = await fetch(`${browserBaseUrl}/json/version`);
          if (verResp.ok) {
            const ver = await verResp.json();
            const browserWs = ver.webSocketDebuggerUrl;
            if (browserWs) {
              const bws = await createWs(browserWs);
              const brpc = makeRpc(bws);

              const attached = await brpc("Target.attachToTarget", {
                targetId: anyTarget.id,
                flatten: true,
              }).catch((e: any) => {
                throw new Error("Target.attachToTarget failed: " + (e.message || e));
              });
              const sessionId = attached?.sessionId;
              if (!sessionId) throw new Error("Attach returned no sessionId");

              const sendMessage = (method: string, params: any = {}) =>
                brpc("Target.sendMessageToTarget", {
                  sessionId,
                  message: JSON.stringify({ id: 1, method, params }),
                });

              // navigate target to domain
              try {
                await sendMessage("Page.navigate", { url: targetUrl });
                await sendMessage("Network.enable");

                for (const c of domainCookies) {
                  const params: any = {
                    name: c.name,
                    value: c.value,
                    url: targetUrl,
                    path: c.path || "/",
                    domain: c.domain,
                    secure: !!c.secure,
                    httpOnly: !!c.httpOnly,
                  };
                  if (c.expires !== undefined) params.expires = c.expires;
                  if (c.sameSite) params.sameSite = c.sameSite;

                  try {
                    await sendMessage("Network.setCookie", params);
                  } catch (e: any) {
                    console.warn("[CDP via attach] setCookie failed for", c.name, e.message || e);
                  }
                }
              } finally {
                try {
                  await brpc("Target.detachFromTarget", { sessionId });
                } catch (e) {}
                try {
                  bws.close && bws.close();
                } catch (e) {}
              }

              // target handled
              continue;
            }
          }
        }
      } catch (err: any) {
        console.warn("[CDP] attach-to-any-target fallback failed:", err.message || err);
      }

      if (targetInfo && targetInfo.id) {
        try {
          await fetch(`${browserBaseUrl}/json/close/${targetInfo.id}`);
        } catch (e) {}
      }
      console.warn("No webSocketDebuggerUrl for target", domain);
      continue;
    }

    const ws = await createWs(wsUrl);
    const rpc = makeRpc(ws);

    try {
      await rpc("Network.enable");

      for (const c of domainCookies) {
        const params: any = {
          name: c.name,
          value: c.value,
          url: targetUrl,
          path: c.path || "/",
          domain: c.domain,
          secure: !!c.secure,
          httpOnly: !!c.httpOnly,
        };
        if (c.expires !== undefined) params.expires = c.expires;
        if (c.sameSite) params.sameSite = c.sameSite;

        try {
          await rpc("Network.setCookie", params);
        } catch (e: any) {
          console.warn("[CDP] setCookie failed for", c.name, e.message || e);
        }
      }
    } finally {
      try {
        ws.close && ws.close();
      } catch (e) {}
      try {
        await fetch(`${browserBaseUrl}/json/close/${targetInfo?.id || ""}`);
      } catch (e) {}
    }
  }
}

export async function connectToRemoteBrowser(wsEndpoint: string): Promise<void> {
  if (!wsEndpoint) throw new Error("wsEndpoint is required");

  try {
    const browser = await puppeteer.connect({
      browserURL: "http://127.0.0.1:9222", // или 'http://localhost:9222'
      defaultViewport: null, // не ломает размер окон
      ignoreHTTPSErrors: true, // если нужно
    });

    // Берём первую вкладку (или создаём новую)
    let page;
    const pages = await browser.pages();
    if (pages.length > 0) {
      page = pages[0];
      console.log("Подключились к существующей вкладке");
    } else {
      page = await browser.newPage();
      console.log("Создали новую вкладку");
    }

    // Пример: проверь куки
    const cookies = await page.cookies();
    console.log(`Куки: ${cookies.length} шт`);
    await page.setCookie({
      name: "visavinet_session",
      value:
        "eyJpdiI6IjJHRG5HODQvQ25sWTFYN3l3b1p2Znc9PSIsInZhbHVlIjoiOVE4TGhkN3BhdnN3dXMzRmEyVFZZVHF3TEhSWEQ1SHRKdU5kVjJDamp2ZEVIdEtqRUxySG02VGI1RzZCSXZaQVYyWnM5c2NrZzEza3dnak41Znd4N0tqbUd1YlE5SThiNkxpMThWdlUreHNqcEtCdHVrUEZmUldVMnY3Z3MrbUYiLCJtYWMiOiI1OWNiYzgwY2VhNzYzMWEyNmJkNzBkZjkzYzk2MDBlMTcyMWZkNjA0Y2Q0OGI4MTNlZmVjNDI1MzhlMTFkNzMwIiwidGFnIjoiIn0%3D",
      domain: ".visavi.net",
      path: "/",
      expires: 1769857634,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    });

    await page.goto("https://visavi.net", { waitUntil: "networkidle2" });
    // ... твои действия

    // НЕ закрывай браузер, если хочешь оставить окно живым
    // await browser.close();   ← закомментируй
  } catch (err) {
    console.error("Ошибка подключения:", err);
  }
}

// Example CLI usage: bun run importCookiesToRemote.ts <profile-path> <origin1> [origin2 ...] [--ws <wsEndpoint>]
if (require.main === module) {
  (async () => {
    let argv = process.argv.slice(2);
    // simple parser: --ws <endpoint> at the end
    let wsIndex = argv.indexOf("--ws");
    let wsEndpoint: string | undefined;
    if (wsIndex !== -1) {
      wsEndpoint = argv[wsIndex + 1];
      argv = argv.slice(0, wsIndex);
    } else {
      wsEndpoint = "http://localhost:9222"; // default remote debugging URL
    }

    let [profilePath, ...origins] = argv;

    // fallback defaults for quick testing
    if (!profilePath) {
      profilePath = "C:\\Users\\2byte\\AppData\\Local\\Google\\Chrome\\User Data\\Default";
    }
    if (!origins || origins.length === 0) {
      origins = ["https://visavi.net"];
    }

    try {
      const cookies = await extractCookies(profilePath, origins);
      console.log("Extracted cookies:", cookies.length, "cookies", cookies);
      if (wsEndpoint) {
        console.log(`Setting cookies to ${wsEndpoint}...`);
        // await setCookiesToRemote(wsEndpoint, cookies);
        await connectToRemoteBrowser(wsEndpoint);
        console.log("Done.");
      } else {
        console.log(JSON.stringify(cookies, null, 2));
      }
    } catch (err: any) {
      console.error("Error:", err.message);
      process.exit(1);
    }
  })();
}
