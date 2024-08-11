const puppeteer = require('puppeteer');
const fs = require('fs');
const https = require('https');
const path = require('path');
require('dotenv').config()

//const logFile = fs.createWriteStream('output.log', { flags: 'a' });
//process.stdout.write = logFile.write.bind(logFile);

let lastIndex = 0;

(async () => {
    const browser = await puppeteer.launch({headless: false});
    const page = await browser.newPage();
    await page.goto(process.env.COLLECTION_MAGICEDEN_URL);
    await sleep(4000);
    const elements = await page.$$('.tw-pb-2');
    const firstCard = await page.$$('.tw-pb-2:first-child');
    const point = await firstCard[0].clickablePoint({x: 10, y: 10})
    await firstCard[0].click()
    let e1 = 0;
    fs.mkdirSync(process.env.COLLECTION_MAGICEDEN_URL.split('/').at(-1));
    setInterval(() => {
        fs.readdir(process.env.COLLECTION_MAGICEDEN_URL.split('/').at(-1), (err, files) => {
            if (err) throw err;
            console.log(`Картинок: ${files.length}`);
        });
    }, process.env.SCROLL_INTERVAL)

    setInterval(async () => {
        const elements = await page.$$('.tw-pb-2');
        if (elements.length > 0) {
            //const elements = await page.$$('.tw-pb-2');
            const startSelector = '.tw-pb-2:first-child';
            const endSelector = '.tw-pb-2:last-child';
            const res = await page.evaluate(() => {
                const elements = document.getElementsByClassName('tw-pb-2')
                const startElement = elements[0];
                const endElement = elements[elements.length - 1];
                if (startElement && endElement) {
                    const startIndex = startElement.getAttribute('data-index');
                    const endIndex = endElement.getAttribute('data-index');
                    return { indexes: { s2: startIndex, e2: endIndex } };
                } else {
                    return { indexes: { s2: null, e2: null } };
                }
            });

            const workStart = e1 > res.indexes.s2 ? e1 : res.indexes.s2
            const workEnd = res.indexes.e2;
            console.log(workStart, "/", workEnd);
            await download(elements, workStart, workEnd);
            //download(elements, workStart, workEnd);
            e1 = workEnd;
        } else {
            console.log('Элементы не найдены');
        }
        await page.mouse.wheel({ deltaY: Number(process.env.PIXELS_PER_SCROLL) });
        await page.screenshot({path: 'screenshot.png'})
    }, process.env.SCROLL_INTERVAL);

    async function download(els, workStart, workEnd) {
        //const elss = els.slice(0, 10)
        if (!(workStart === workEnd)) {
            for (let i = 0; i < els.length; i++) {
                const res = await page.evaluate(async (el, workStart, workEnd) => {
                    function goDown(el, steps= 4) {
                        let targetElement = el;
                        for (let i = 0; i < steps; i++) {
                            if (targetElement && targetElement.children.length > 0) {
                                targetElement = targetElement.children[0];
                            } else {
                                return null;
                            }
                        }
                        return targetElement;
                    }
                    const index = el.getAttribute('data-index')
                    if (index < workStart || index > workEnd) {
                        return {index: null, src: null}
                    }
                    const imgElement = await goDown(el, 4)
                    const src = imgElement ? imgElement.getAttribute('src') : null;
                    return {index, src}
                }, els[i], workStart, workEnd);
                if (res.src && res.index) {
                    //console.log(res.index, res.src);
                    const filename = `${process.env.COLLECTION_MAGICEDEN_URL.split('/').at(-1)}_${res.index}.png`
                    const downloadDir = path.resolve(__dirname, process.env.COLLECTION_MAGICEDEN_URL.split('/').at(-1).toString());
                    if (!fs.existsSync(downloadDir)){
                        fs.mkdirSync(downloadDir);
                    }
                    const filePath = path.join(downloadDir, filename); // Задаем имя файла
                    const file = fs.createWriteStream(filePath);
                    https.get(res.src, function(response) {
                        response.pipe(file);
                        file.on('finish', function() {
                            file.close(() => {
                                //console.log('Изображение успешно скачано и сохранено по пути:', filePath);
                            });
                        });
                    }).on('error', function(err) {
                        fs.unlink(filePath); // Удаляем файл при ошибке
                        //console.log('Ошибка при скачивании изображения:', err.message);
                    });

                    //console.log(`${res.index} ПОЛУЧИЛОСЬ СКАЧАТЬ`)
                }
                else {
                    //console.log(`${res.index} НЕ ПОЛУЧИЛОСЬ СКАЧАТЬ`)
                }
            }
        }
    }
})();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
