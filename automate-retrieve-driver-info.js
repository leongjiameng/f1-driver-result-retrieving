const puppeteer = require('puppeteer');
const fs = require('fs');
const { format } = require('date-fns');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Set a user-agent to reduce chances of detection
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.121 Safari/537.36');

  await page.goto('https://www.formula1.com/en/drivers.html');

  // Extract the links to the driver detail pages
  const driverLinks = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll('.f1-inner-wrapper a'));
    return anchors.map(anchor => anchor.href).filter(href => href.startsWith('https://www.formula1.com/en/drivers/'));
  });

  console.log('Driver Links:', driverLinks);

  const drivers = [];

  for (const link of driverLinks) {
    console.log('Navigating to:', link);
    try {
      await page.goto(link, { waitUntil: 'domcontentloaded' });

      // Introduce a cooldown to mimic human browsing behavior
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before continuing

    } catch (error) {
      console.error('Error navigating to:', link, error);
      continue;
    }

    const driverData = await page.evaluate(() => {
      const getTextContent = (dtText) => {
        const dtElement = Array.from(document.querySelectorAll('dt')).find(dt => dt.textContent.trim() === dtText);
        return dtElement ? dtElement.nextElementSibling.textContent.trim() : null;
      };

      const driverName = document.querySelector('.f1-driver-position h1')?.textContent.trim() || null;
      const driverSlug = driverName ? driverName.toLowerCase().replace(/ /g, '-') : null;

      const podiums = getTextContent('Podiums');
      const driverPoint = getTextContent('Points');
      const entered = getTextContent('Grands Prix entered');
      const championships = getTextContent('World Championships');

      return {
        driver_slug: driverSlug,
        podiums: podiums,
        driver_point: driverPoint,
        entered: entered,
        championships: championships
      };
    });

    // Filter out entries with empty or null slugs
    if (driverData.driver_slug) {
      console.log('Driver Data:', driverData);
      drivers.push(driverData);
    } else {
      console.warn(`Skipping driver with empty slug:`, driverData);
    }
  }

  const dateStr = format(new Date(), 'MMdd');
  const fileName = `driver_updated_${dateStr}.csv`;

  const header = 'slug,podiums,driver_point,entered,championships\n';
  const csvContent = drivers.map(driver =>
    `${driver.driver_slug},${driver.podiums},${driver.driver_point},${driver.entered},${driver.championships}`
  ).join('\n');

  fs.writeFileSync(fileName, header + csvContent);

  console.log(`Data saved to ${fileName}`);

  await browser.close();
})();
