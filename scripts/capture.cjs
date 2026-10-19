const puppeteer = require('B:/workgit/tlslens/web/node_modules/puppeteer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const targetDir = path.resolve(__dirname, '../docs/images');
const framesDir = path.resolve(__dirname, '../docs/images/frames');
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
if (!fs.existsSync(framesDir)) fs.mkdirSync(framesDir, { recursive: true });

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });

  // 1. Render logo.png from logo.svg
  console.log('Rendering logo.png from logo.svg...');
  const logoPage = await browser.newPage();
  await logoPage.setViewport({ width: 512, height: 512, deviceScaleFactor: 2 });
  const svgContent = fs.readFileSync(path.join(targetDir, 'logo.svg'), 'utf8');
  await logoPage.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { width: 512px; height: 512px; display: flex; align-items: center; justify-content: center; background: transparent; }
          svg { width: 512px; height: 512px; }
        </style>
      </head>
      <body>${svgContent}</body>
    </html>
  `);
  await logoPage.screenshot({
    path: path.join(targetDir, 'logo.png'),
    omitBackground: true,
  });
  await logoPage.close();
  console.log('logo.png successfully created.');

  // 2. Main Studio Captures
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  console.log('Navigating to NATSLens Studio at http://127.0.0.1:8085...');
  await page.goto('http://127.0.0.1:8085', { waitUntil: 'networkidle0' });
  await new Promise((r) => setTimeout(r, 2000));

  // --- TAB 1: Cluster Overview (natslens-1.png) ---
  console.log('Capturing Cluster Overview (natslens-1.png)...');
  await page.screenshot({ path: path.join(targetDir, 'natslens-1.png'), fullPage: false });

  // --- TAB 2: Streams & Subjects (natslens-2.png) ---
  console.log('Navigating to Streams & Subjects...');
  await clickTab(page, 'Streams & Subjects');
  await new Promise((r) => setTimeout(r, 1200));

  // Click on the 'ORDERS' stream card to open StreamDetail
  console.log('Selecting ORDERS stream...');
  const streamCards = await page.$$('div.cursor-pointer');
  let clickedStream = false;
  for (const card of streamCards) {
    const text = await page.evaluate(el => el.textContent, card);
    if (text && text.includes('ORDERS')) {
      await card.click();
      clickedStream = true;
      break;
    }
  }
  if (!clickedStream && streamCards.length > 0) {
    await streamCards[0].click();
  }
  await new Promise((r) => setTimeout(r, 1200));

  // Switch to "Messages" tab inside stream detail
  const detailTabs = await page.$$('button');
  for (const btn of detailTabs) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Messages')) {
      await btn.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1500));
  console.log('Capturing Stream & Message Browser (natslens-2.png)...');
  await page.screenshot({ path: path.join(targetDir, 'natslens-2.png'), fullPage: false });

  // --- TAB 3: Consumer Lag & Heatmap (natslens-3.png) ---
  console.log('Navigating to Consumer Lag & Heatmap...');
  await clickTab(page, 'Consumer Lag & Heatmap');
  await new Promise((r) => setTimeout(r, 1500));
  console.log('Capturing Consumer Lag & Heatmap (natslens-3.png)...');
  await page.screenshot({ path: path.join(targetDir, 'natslens-3.png'), fullPage: false });

  // --- TAB 4: Key-Value Workbench (natslens-4.png) ---
  console.log('Navigating to Key-Value Workbench...');
  await clickTab(page, 'Key-Value Workbench');
  await new Promise((r) => setTimeout(r, 1200));

  // Click on rate-limits bucket if available, then click on a key
  const bucketButtons = await page.$$('button');
  for (const btn of bucketButtons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('rate-limits')) {
      await btn.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 800));

  // Select a key
  const keyRows = await page.$$('button, tr, div');
  for (const row of keyRows) {
    const text = await page.evaluate(el => el.textContent, row);
    if (text && text.includes('tenant.1001.rpm')) {
      await row.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1200));
  console.log('Capturing Key-Value Workbench (natslens-4.png)...');
  await page.screenshot({ path: path.join(targetDir, 'natslens-4.png'), fullPage: false });

  // --- TAB 5: Message Studio & Replay (natslens-5.png) ---
  console.log('Navigating to Message Studio & Replay...');
  await clickTab(page, 'Message Studio & Replay');
  await new Promise((r) => setTimeout(r, 1200));

  // Switch to Stream Replay tab inside studio
  const studioTabs = await page.$$('button');
  for (const btn of studioTabs) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Stream Replay')) {
      await btn.click();
      break;
    }
  }
  await new Promise((r) => setTimeout(r, 1000));
  console.log('Capturing Message Studio & Replay (natslens-5.png)...');
  await page.screenshot({ path: path.join(targetDir, 'natslens-5.png'), fullPage: false });

  // --- 6. RECORDING ANIMATED DEMO FRAMES FOR GIF ---
  console.log('Recording sequence of frames for natslens_demo.gif...');
  let frameIdx = 0;

  const demoTour = [
    { name: 'Cluster Overview', action: async () => { await clickTab(page, 'Cluster Overview'); } },
    { name: 'Streams Overview', action: async () => { await clickTab(page, 'Streams & Subjects'); } },
    { name: 'Stream Detail (ORDERS)', action: async () => {
      const cards = await page.$$('div.cursor-pointer');
      for (const card of cards) {
        const text = await page.evaluate(el => el.textContent, card);
        if (text && text.includes('ORDERS')) { await card.click(); break; }
      }
    } },
    { name: 'Stream Messages', action: async () => {
      const btns = await page.$$('button');
      for (const b of btns) {
        const text = await page.evaluate(el => el.textContent, b);
        if (text && text.includes('Messages')) { await b.click(); break; }
      }
    } },
    { name: 'Consumer Lag & Heatmap', action: async () => { await clickTab(page, 'Consumer Lag & Heatmap'); } },
    { name: 'KV Workbench', action: async () => { await clickTab(page, 'Key-Value Workbench'); } },
    { name: 'ObjectStore Explorer', action: async () => { await clickTab(page, 'ObjectStore Explorer'); } },
    { name: 'Message Studio', action: async () => { await clickTab(page, 'Message Studio & Replay'); } },
    { name: 'Stream Replay Engine', action: async () => {
      const btns = await page.$$('button');
      for (const b of btns) {
        const text = await page.evaluate(el => el.textContent, b);
        if (text && text.includes('Stream Replay')) { await b.click(); break; }
      }
    } },
    { name: 'Live Tap & Probe', action: async () => { await clickTab(page, 'Live Tap & Probe'); } },
  ];

  for (const step of demoTour) {
    console.log(`Frame recording step: ${step.name}`);
    await step.action();
    await new Promise((r) => setTimeout(r, 800));

    // Capture 3 frames per step with small intervals to capture animations/live traffic
    for (let f = 0; f < 3; f++) {
      const framePath = path.join(framesDir, `frame_${String(frameIdx).padStart(4, '0')}.png`);
      await page.screenshot({ path: framePath, fullPage: false });
      frameIdx++;
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  await browser.close();
  console.log(`Captured ${frameIdx} frames. Generating natslens_demo.gif with ffmpeg...`);

  const gifPath = path.join(targetDir, 'natslens_demo.gif');
  const palettePath = path.join(framesDir, 'palette.png');

  execSync(`ffmpeg -y -framerate 2.5 -i "${framesDir}/frame_%04d.png" -vf "fps=2.5,scale=1280:-1:flags=lanczos,palettegen" "${palettePath}"`, { stdio: 'inherit' });
  execSync(`ffmpeg -y -framerate 2.5 -i "${framesDir}/frame_%04d.png" -i "${palettePath}" -filter_complex "fps=2.5,scale=1280:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3" "${gifPath}"`, { stdio: 'inherit' });

  // Clean up frames
  fs.rmSync(framesDir, { recursive: true, force: true });
  console.log('Successfully generated all screenshots and natslens_demo.gif!');
}

async function clickTab(page, tabLabel) {
  const allBtns = await page.$$('button, a');
  for (const b of allBtns) {
    const text = await page.evaluate(el => el.textContent, b);
    if (text && text.includes(tabLabel)) {
      await b.click();
      return;
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
