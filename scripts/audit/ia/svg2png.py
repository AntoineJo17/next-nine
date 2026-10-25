import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as pw:
        b = await pw.chromium.launch(); p = await b.new_page(viewport={'width': 1300, 'height': 620})
        await p.goto('file://' + sys.argv[1]); await p.screenshot(path=sys.argv[2]); await b.close()
asyncio.run(main())
