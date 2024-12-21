const CPU =
  "   https://pcpartpicker.com/products/cpu/#R=5&s=62,60,59,69,11,12,13";
const GPU =
  "   https://pcpartpicker.com/products/video-card/#R=5&c=396,379,380,378,373,369,415,367,390,439,450,438,436,514,446,425,447,427,448,424,572,518,546,499,497,494,506,492,505,493,520,552,553,550,565,549,566,542,567,539,377,370,394,420,416,395,392,445,521,511,522,526,501,523,495,496,498,524,554,571,558,559,560,547,548&m=7,8,14,18,27,40&T=8,10";
const MOBO =
  "  https://pcpartpicker.com/products/motherboard/#c=125,147,165,124,133,145,160,123,127,132,138,158,159,166,167,112,120,129,136,144,149,75,154,163,113,111,121,131,130,141,142,151,150,155,153,164,110,119,128,135,143,148,152,162,170&R=5";
const RAM =
  "   https://pcpartpicker.com/products/memory/#R=5&b=ddr4,ddr5&Z=8192001,16384001,32768001,65536001,131072001";
const Drive = " https://pcpartpicker.com/products/internal-hard-drive/#R=5";

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

async function initializePage(link) {
  const browser = await puppeteer.launch({
    headless: false,

    defaultViewport: null,
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
  );
  await page.goto(link, { waitUntil: "networkidle0" });
  return { browser, page };
}

const cpu = async () => {
  let browser = null;
  let page = null;
  let allCpuSpecs = [];

  try {
    ({ page, browser } = await initializePage(
      "https://pcpartpicker.com/products/cpu/#R=5&s=62,60,59,69,11,12,13"
    ));

    await page.waitForSelector("tr[class*='tr__product']", {
      timeout: 60000,
      visible: true,
    });

    const totalPages = await page.evaluate(() => {
      const pageLinks = document.querySelectorAll(
        "#module-pagination a[href^='#page=']"
      );
      const pageNumbers = Array.from(pageLinks).map((link) => {
        const match = link.getAttribute("href").match(/page=(\d+)/);
        return match ? parseInt(match[1]) : 1;
      });
      return Math.max(...pageNumbers);
    });

    for (let currentPage = 1; currentPage <= totalPages; currentPage++) {
      if (currentPage > 1) {
        await Promise.all([
          page.click(`a[href="#page=${currentPage}"]`),
          page.waitForNavigation({ waitUntil: "networkidle0" }),
        ]);
        await page.waitForSelector("tr[class*='tr__product']", {
          visible: true,
        });
      }

      const pageResults = await page.evaluate(() => {
        const rows = document.querySelectorAll("tr[class*='tr__product']");

        return Array.from(rows)
          .map((row) => {
            const nameEl = row.querySelector("div[class*='td__nameWrapper'] p");
            const name = nameEl ? nameEl.textContent.trim() : null;

            const coreEl = row.querySelector(
              "td[class*='td__spec--1'] h6[class*='specLabel']"
            );
            const cores = coreEl ? coreEl.nextSibling.textContent.trim() : null;

            const clockEl = row.querySelector(
              "td[class*='td__spec--2'] h6[class*='specLabel']"
            );
            const clockSpeed = clockEl
              ? clockEl.nextSibling.textContent.trim()
              : null;

            const tdpEl = row.querySelector(
              "td[class*='td__spec--5'] h6[class*='specLabel']"
            );
            const tdp = tdpEl ? tdpEl.nextSibling.textContent.trim() : null;

            const priceEl = row.querySelector("td[class*='td__price']");
            const price = priceEl
              ? priceEl.firstChild.textContent.trim()
              : null;

            return {
              name,
              category: "CPU",
              price,
              specs: {
                cores,
                clockSpeed,
                tdp,
              },
            };
          })
          .filter((spec) => spec.name);
      });

      allCpuSpecs = allCpuSpecs.concat(pageResults);
    }

    return allCpuSpecs;
  } catch (error) {
    console.error("Error during CPU scraping:", error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const gpu = async () => {
  let browser = null;
  let page = null;
  let allGpuSpecs = [];

  try {
    ({ page, browser } = await initializePage(GPU));

    await page.waitForSelector("tr[class*='tr__product']", {
      timeout: 60000,
      visible: true,
    });

    let hasNextPage = true;
    let currentPage = 1;

    while (hasNextPage) {
      const pageResults = await page.evaluate(() => {
        const getTextContent = (element, selector) => {
          try {
            const el = element.querySelector(selector);
            if (!el) return null;

            if (selector.includes("specLabel")) {
              const parent = el.parentNode;
              const textContent = parent.textContent
                .replace(el.textContent, "")
                .trim();
              return textContent || null;
            }

            return el.textContent.trim() || null;
          } catch (e) {
            return null;
          }
        };

        const rows = document.querySelectorAll("tr[class*='tr__product']");

        return Array.from(rows)
          .map((row) => {
            try {
              const name =
                getTextContent(row, "div[class*='nameWrapper'] p") ||
                getTextContent(row, "div[class*='nameWrapper'] span");

              const chipset = getTextContent(
                row.querySelector("td[class*='td__spec--1']"),
                "h6[class*='specLabel']"
              );

              const coreClock = getTextContent(
                row.querySelector("td[class*='td__spec--2']"),
                "h6[class*='specLabel']"
              );

              const memory = getTextContent(
                row.querySelector("td[class*='td__spec--4']"),
                "h6[class*='specLabel']"
              );

              let price = null;
              const priceEl = row.querySelector("td[class*='td__price']");
              if (priceEl && priceEl.firstChild) {
                price = priceEl.firstChild.textContent.trim() || null;
              }

              return {
                name,
                category: "GPU",
                price,
                specs: {
                  chipset,
                  coreClock: memory,
                  memory: coreClock,
                },
              };
            } catch (error) {
              console.error("Error processing row:", error);
              return null;
            }
          })
          .filter((spec) => spec && spec.name);
      });

      allGpuSpecs = allGpuSpecs.concat(pageResults);

      hasNextPage = await page.evaluate(() => {
        const nextButton = Array.from(
          document.querySelectorAll("#module-pagination a")
        ).find((a) => a.textContent.includes("Next"));
        return nextButton !== undefined;
      });

      if (hasNextPage) {
        try {
          await page.evaluate(() => {
            setTimeout(() => {}, 1000);
          });

          await Promise.all([
            page.evaluate(() => {
              const nextButton = Array.from(
                document.querySelectorAll("#module-pagination a")
              ).find((a) => a.textContent.includes("Next"));
              if (nextButton) nextButton.click();
            }),
            page.waitForNavigation({ waitUntil: "networkidle0" }),
          ]);

          await page.waitForSelector("tr[class*='tr__product']", {
            visible: true,
          });

          currentPage++;
          console.log(`Scraped page ${currentPage}`);
        } catch (error) {
          console.error(`Error navigating to next page: ${error.message}`);
          hasNextPage = false;
        }
      }
    }

    return allGpuSpecs;
  } catch (error) {
    console.error("Error during GPU scraping:", error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const motherboard = async () => {
  let browser = null;
  let page = null;
  let allMotherboardSpecs = [];

  try {
    ({ page, browser } = await initializePage(MOBO));

    await page.waitForSelector("tr[class*='tr__product']", {
      timeout: 60000,
      visible: true,
    });

    let hasNextPage = true;
    let currentPage = 1;

    while (hasNextPage) {
      const pageResults = await page.evaluate(() => {
        const getTextContent = (element, selector) => {
          try {
            const el = element.querySelector(selector);
            if (!el) return null;

            if (selector.includes("specLabel")) {
              const parent = el.parentNode;
              const textContent = parent.textContent
                .replace(el.textContent, "")
                .trim();
              return textContent || null;
            }

            return el.textContent.trim() || null;
          } catch (e) {
            return null;
          }
        };

        const getPrice = (element) => {
          try {
            const priceEl = element.querySelector("td[class*='td__price']");
            if (!priceEl) return null;
            const priceText = priceEl.textContent.trim();
            return priceText || null;
          } catch (e) {
            return null;
          }
        };

        const rows = document.querySelectorAll("tr[class*='tr__product']");

        return Array.from(rows)
          .map((row) => {
            try {
              const name =
                getTextContent(row, "div[class*='nameWrapper'] p") ||
                getTextContent(row, "div[class*='nameWrapper'] span");

              const socket = getTextContent(
                row.querySelector("td[class*='td__spec--1']"),
                "h6[class*='specLabel']"
              );

              const formFactor = getTextContent(
                row.querySelector("td[class*='td__spec--2']"),
                "h6[class*='specLabel']"
              );

              const memoryMax = getTextContent(
                row.querySelector("td[class*='td__spec--3']"),
                "h6[class*='specLabel']"
              );

              const memorySlots = getTextContent(
                row.querySelector("td[class*='td__spec--4']"),
                "h6[class*='specLabel']"
              );

              const price = getPrice(row);

              return {
                name,
                category: "Motherboard",
                price,
                specs: {
                  socket,
                  formFactor,
                  memoryMax,
                  memorySlots,
                },
              };
            } catch (error) {
              console.error("Error processing row:", error);
              return null;
            }
          })
          .filter((spec) => spec && spec.name);
      });

      allMotherboardSpecs = allMotherboardSpecs.concat(pageResults);

      hasNextPage = await page.evaluate(() => {
        const nextButton = Array.from(
          document.querySelectorAll("#module-pagination a")
        ).find((a) => a.textContent.includes("Next"));
        return nextButton !== undefined;
      });

      if (hasNextPage) {
        try {
          await page.evaluate(() => {
            setTimeout(() => {}, 1000);
          });

          await Promise.all([
            page.evaluate(() => {
              const nextButton = Array.from(
                document.querySelectorAll("#module-pagination a")
              ).find((a) => a.textContent.includes("Next"));
              if (nextButton) nextButton.click();
            }),
            page.waitForNavigation({ waitUntil: "networkidle0" }),
          ]);

          await page.waitForSelector("tr[class*='tr__product']", {
            visible: true,
          });

          currentPage++;
          console.log(`Scraped page ${currentPage}`);
        } catch (error) {
          console.error(`Error navigating to next page: ${error.message}`);
          hasNextPage = false;
        }
      }
    }

    return allMotherboardSpecs;
  } catch (error) {
    console.error("Error during motherboard scraping:", error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const ram = async () => {
  let browser = null;
  let page = null;
  let allRamSpecs = [];

  try {
    ({ page, browser } = await initializePage(RAM));

    await page.waitForSelector("tr[class*='tr__product']", {
      timeout: 60000,
      visible: true,
    });

    let hasNextPage = true;
    let currentPage = 1;

    while (hasNextPage) {
      const pageResults = await page.evaluate(() => {
        const getTextContent = (element, selector) => {
          try {
            const el = element.querySelector(selector);
            if (!el) return null;

            if (selector.includes("specLabel")) {
              const parent = el.parentNode;
              const textContent = parent.textContent
                .replace(el.textContent, "")
                .trim();
              return textContent || null;
            }

            return el.textContent.trim() || null;
          } catch (e) {
            return null;
          }
        };

        const getPrice = (element) => {
          try {
            const priceEl = element.querySelector("td[class*='td__price']");
            if (!priceEl) return null;
            const priceText = priceEl.textContent.trim();

            const cleanPrice = priceText.replace(/Add.*$/, "").trim();
            return cleanPrice || null;
          } catch (e) {
            return null;
          }
        };

        const rows = document.querySelectorAll("tr[class*='tr__product']");

        return Array.from(rows)
          .map((row) => {
            try {
              const name =
                getTextContent(row, "div[class*='nameWrapper'] p") ||
                getTextContent(row, "div[class*='nameWrapper'] span");

              const speed = getTextContent(
                row.querySelector("td[class*='td__spec--1']"),
                "h6[class*='specLabel']"
              );

              const modules = getTextContent(
                row.querySelector("td[class*='td__spec--2']"),
                "h6[class*='specLabel']"
              );

              const pricePerGB = getTextContent(
                row.querySelector("td[class*='td__spec--3']"),
                "h6[class*='specLabel']"
              );

              const casLatency = getTextContent(
                row.querySelector("td[class*='td__spec--4']"),
                "h6[class*='specLabel']"
              );

              const timing = getTextContent(
                row.querySelector("td[class*='td__spec--5']"),
                "h6[class*='specLabel']"
              );

              const price = getPrice(row);

              let rating = null;
              const ratingEl = row.querySelector("td[class*='td__rating']");
              if (ratingEl) {
                rating = ratingEl.getAttribute("data-cl") || null;
              }

              let totalCapacity = null;
              if (modules) {
                const match = modules.match(/(\d+)\s*x\s*(\d+)GB/i);
                if (match) {
                  totalCapacity = parseInt(match[1]) * parseInt(match[2]);
                }
              }

              return {
                name,
                category: "RAM",
                price,
                specs: {
                  speed,
                  totalCapacity: totalCapacity ? `${totalCapacity}GB` : null,
                  timing,
                },
              };
            } catch (error) {
              console.error("Error processing row:", error);
              return null;
            }
          })
          .filter((spec) => spec && spec.name && spec.price);
      });

      allRamSpecs = allRamSpecs.concat(pageResults);

      hasNextPage = await page.evaluate(() => {
        const nextButton = Array.from(
          document.querySelectorAll("#module-pagination a")
        ).find((a) => a.textContent.includes("Next"));
        return nextButton !== undefined;
      });

      if (hasNextPage) {
        try {
          await page.evaluate(() => {
            setTimeout(() => {}, 1000);
          });

          await Promise.all([
            page.evaluate(() => {
              const nextButton = Array.from(
                document.querySelectorAll("#module-pagination a")
              ).find((a) => a.textContent.includes("Next"));
              if (nextButton) nextButton.click();
            }),
            page.waitForNavigation({ waitUntil: "networkidle0" }),
          ]);

          await page.waitForSelector("tr[class*='tr__product']", {
            visible: true,
          });

          currentPage++;
          console.log(`Scraped page ${currentPage}`);
        } catch (error) {
          console.error(`Error navigating to next page: ${error.message}`);
          hasNextPage = false;
        }
      }
    }

    return allRamSpecs;
  } catch (error) {
    console.error("Error during RAM scraping:", error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};

const storage = async () => {
  let browser = null;
  let page = null;
  let allStorageSpecs = [];

  try {
    ({ page, browser } = await initializePage(Drive));

    await page.waitForSelector("tr[class*='tr__product']", {
      timeout: 60000,
      visible: true,
    });

    let hasNextPage = true;
    let currentPage = 1;

    while (hasNextPage) {
      const pageResults = await page.evaluate(() => {
        const getTextContent = (element, selector) => {
          try {
            const el = element.querySelector(selector);
            if (!el) return null;

            if (selector.includes("specLabel")) {
              const parent = el.parentNode;
              const textContent = parent.textContent
                .replace(el.textContent, "")
                .trim();
              return textContent || null;
            }

            return el.textContent.trim() || null;
          } catch (e) {
            return null;
          }
        };

        const getPrice = (element) => {
          try {
            const priceEl = element.querySelector("td[class*='td__price']");
            if (!priceEl) return null;
            const priceText = priceEl.textContent.trim();

            const cleanPrice = priceText.replace(/Add.*$/, "").trim();
            return cleanPrice || null;
          } catch (e) {
            return null;
          }
        };

        const rows = document.querySelectorAll("tr[class*='tr__product']");

        return Array.from(rows)
          .map((row) => {
            try {
              const name =
                getTextContent(row, "div[class*='nameWrapper'] p") ||
                getTextContent(row, "div[class*='nameWrapper'] span");

              const capacity = getTextContent(
                row.querySelector("td[class*='td__spec--1']"),
                "h6[class*='specLabel']"
              );

              const type = getTextContent(
                row.querySelector("td[class*='td__spec--3']"),
                "h6[class*='specLabel']"
              );

              const cache = getTextContent(
                row.querySelector("td[class*='td__spec--4']"),
                "h6[class*='specLabel']"
              );

              const formFactor = getTextContent(
                row.querySelector("td[class*='td__spec--5']"),
                "h6[class*='specLabel']"
              );

              const price = getPrice(row);

              return {
                name,
                category: "Storage",
                price,
                specs: {
                  capacity,
                  type,
                  cache,
                  formFactor,
                },
              };
            } catch (error) {
              console.error("Error processing row:", error);
              return null;
            }
          })
          .filter(
            (spec) => spec && spec.name && spec.price && spec.specs.cache
          );
      });

      allStorageSpecs = allStorageSpecs.concat(pageResults);

      hasNextPage = await page.evaluate(() => {
        const nextButton = Array.from(
          document.querySelectorAll("#module-pagination a")
        ).find((a) => a.textContent.includes("Next"));
        return nextButton !== undefined;
      });

      if (hasNextPage) {
        try {
          await page.evaluate(() => {
            setTimeout(() => {}, 1000);
          });

          await Promise.all([
            page.evaluate(() => {
              const nextButton = Array.from(
                document.querySelectorAll("#module-pagination a")
              ).find((a) => a.textContent.includes("Next"));
              if (nextButton) nextButton.click();
            }),
            page.waitForNavigation({ waitUntil: "networkidle0" }),
          ]);

          await page.waitForSelector("tr[class*='tr__product']", {
            visible: true,
          });

          currentPage++;
          console.log(`Scraped page ${currentPage}`);
        } catch (error) {
          console.error(`Error navigating to next page: ${error.message}`);
          hasNextPage = false;
        }
      }
    }

    return allStorageSpecs;
  } catch (error) {
    console.error("Error during storage scraping:", error.message);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
};
module.exports = { storage, cpu, gpu, ram, motherboard };
