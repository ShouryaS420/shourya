// services/pdf.js
import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

/**
 * Launch a single browser instance (reused). Adjust executablePath on some hosts if needed.
 */
let _browser;
async function getBrowser() {
    if (_browser) return _browser;
    _browser = await puppeteer.launch({
        headless: "new",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--font-render-hinting=medium",
            "--disable-gpu",
            "--no-zygote",
            "--single-process",
        ],
    });
    return _browser;
}

/**
 * Renders HTML to PDF with a repeating 50px black header (empty content for now) and a neat footer.
 * @param {string} html - full HTML document
 * @param {object} opts - { filePath?, marginTop?, marginBottom?, printBackground? }
 * @returns {Buffer} PDF Buffer
 */
export async function renderPdf(html, opts = {}) {
    const {
        filePath,               // optional: if provided, PDF will be saved to disk as well
        marginTop = "70px",     // allow a bit more space than 50px header (safety)
        marginBottom = "70px",  // footer safety
        printBackground = true,
    } = opts;

    const browser = await getBrowser();
    const page = await browser.newPage();

    // Set a decent viewport for layout pass (not critical for PDF).
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 1 });

    // Inject the HTML
    await page.setContent(html, { waitUntil: ["domcontentloaded", "networkidle0"] });

    // Puppeteer header/footer live in a separate context. Use inline HTML.
    const headerTemplate = `
    <div style="font-size: 10px; width: 100%;">
      <div style="
        width: 100%;
        height: 50px;
        background: #000;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding: 0 18mm;
        box-sizing: border-box;
      ">
        <!-- keep empty for now; you can inject logo/text later -->
      </div>
    </div>
  `;

    const footerTemplate = `
    <div style="font-size: 10px; width:100%; color:#64748B;">
      <div style="
        width: 100%;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 18mm;
        box-sizing: border-box;
        border-top: 0.6px solid #E5E7EB;
      ">
        <span class="date" style="font-size:10px;"></span>
        <span class="pageNumber" style="font-size:10px;"></span>
      </div>
    </div>
  `;

    const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground,
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: { top: marginTop, bottom: marginBottom, left: "14mm", right: "14mm" },
    });

    await page.close();

    if (filePath) {
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(filePath, pdfBuffer);
    }

    return pdfBuffer;
}
