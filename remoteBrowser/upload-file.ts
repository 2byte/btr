/**
 * Helper script for uploading files to forms in remote browser
 * 
 * Solves the problem with Chrome DevTools Inspector (chrome://inspect)
 * where file dialogs don't work properly with remote browsers.
 * 
 * Usage:
 *   bun upload-file.ts <selector> <filepath> [host] [port]
 *   bun upload-file.ts 'input#avatar' '/home/user/image.png'
 *   bun upload-file.ts 'input[name="file"]' 'C:\\Users\\user\\doc.pdf' localhost 9222
 * 
 * For remote browser, the file path must be on the REMOTE server!
 */

import { SeleniumWd } from "./SeleniumWd";

async function main() {
  const args = Bun.argv.slice(2);
  
  if (args.length < 2) {
    console.error(`
❌ Error: Missing required arguments

Usage:
  bun upload-file.ts <selector> <filepath> [host] [port]

Arguments:
  selector   - CSS selector for input[type="file"] element
               Examples: 'input#avatar', 'input[name="file"]', '.file-upload'
  
  filepath   - Absolute file path on the machine where Chrome is running
               For remote browser: path on remote server (e.g., /home/user/image.png)
               For local browser: path on local machine (e.g., C:\\Users\\user\\image.png)
  
  host       - Chrome debugging host (default: 81.24.214.134)
  port       - Chrome debugging port (default: 9222)

Examples:
  # Upload to remote browser (file must exist on 81.24.214.134)
  bun upload-file.ts 'input#avatar' '/home/user/avatar.png'
  
  # Upload to local browser
  bun upload-file.ts 'input.file-input' 'C:\\Users\\user\\document.pdf' localhost 9222
  
  # Upload by name attribute
  bun upload-file.ts 'input[name="attachment"]' '/tmp/file.txt'

Tips:
  - Make sure the browser is already open and connected to debugging port
  - Navigate to the page with the file input BEFORE running this script
  - For remote browser, upload the file to remote server first (using scp, sftp, etc.)
  - The input element must be visible and enabled in the DOM
`);
    process.exit(1);
  }

  const selector = args[0];
  const filePath = args[1];
  const host = args[2] || "81.24.214.134";
  const port = parseInt(args[3] || "9222", 10);

  console.log(`
🔄 Connecting to browser...
   Host: ${host}
   Port: ${port}
   Selector: ${selector}
   File: ${filePath}
`);

  try {
    // Connect to existing browser
    const wd = SeleniumWd.init({
      debuggerHost: host,
      debuggerPort: port,
    });

    await wd.connect();
    console.log("✅ Connected to browser\n");

    // Get current page info
    const url = await wd.getCurrentUrl();
    const title = await wd.getTitle();
    console.log(`📄 Current page: ${title}`);
    console.log(`🔗 URL: ${url}\n`);

    // Upload file
    console.log("📤 Uploading file...");
    await wd.uploadFile(selector, filePath);
    
    console.log(`
✅ File uploaded successfully!

Next steps:
  1. Check the file input in the browser (should show filename)
  2. Submit the form if needed
  3. To upload another file, run this script again

💡 Tip: If you need to upload the file to remote server first:
   scp ${filePath.includes('\\') ? 'local-file.txt' : filePath} user@${host}:/remote/path/
`);

    // Keep connection open for a moment to see any errors
    await new Promise(resolve => setTimeout(resolve, 2000));
    
  } catch (error) {
    console.error(`
❌ Upload failed!

Error: ${error}

Troubleshooting:
  1. Make sure browser is running and accessible on ${host}:${port}
  2. Navigate to the page with file input BEFORE running this script
  3. Check that selector '${selector}' matches an input[type="file"] element
  4. For remote browser: ensure file exists on remote server at: ${filePath}
  5. Try using chrome://inspect to manually locate the correct selector:
     - Right-click element → Inspect
     - Copy selector from DevTools
`);
    process.exit(1);
  }
}

main();
