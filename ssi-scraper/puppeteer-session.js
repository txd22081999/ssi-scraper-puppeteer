//https://github.com/puppeteer/puppeteer/blob/v5.5.0/docs/api.md
const puppeteer = require('puppeteer');
const RequestSpy = require('puppeteer-request-spy');
const fs = require(`fs`);


// https://www.npmjs.com/package/puppeteer-request-spy
function KeywordMatcher(testee, keyword) {
    return testee.indexOf(keyword) > -1;
}

let requestInterceptor = new RequestSpy.RequestInterceptor(KeywordMatcher, console);

let imageSpy = new RequestSpy.RequestSpy('/pictures');
requestInterceptor.addSpy(imageSpy);

let page = null, session = null, browser = null;


(async() => {
    // Use Puppeteer to launch a browser and open a page.
    browser = await puppeteer.launch({
        headless: false,
        autoClose: false,
        devtools: false,
        ignoreHTTPSErrors: true,
        }
    );
    page = await browser.newPage();


    // Create a raw DevTools protocol session to talk to the page.
    // Use CDP to set the animation playback rate.
    session = await page.target().createCDPSession();
    await session.send('Network.enable');
    await session.send('Page.enable');
    await page.setViewport({
        width: 1640,
        height: 880,
        deviceScaleFactor: 1,
    });

    // Check it out! Fast animations on the "loading..." screen!
    let count = 0
    page.on('response', async (response) => {
        const s = response.url();

        await response.json().then(data => {
            count += 1
            if (Object.keys(data).includes("data")) {
                console.log(Object.keys(data["data"]))
                const keys = Object.keys(data["data"])
                console.log(data["data"])
                fs.writeFile(keys[0]+"_"+count+".json", JSON.stringify(data), function (err) {
                    if (err) return console.log(err);
                });
            }

        }).catch((error) => {
        })

    });

    session.on("Network.webSocketFrameReceived", (x) => {
        console.log("==================================================================== RECEIVED: ====================================================================");
        const dateObj = new Date();
        console.log(`Date: ${dateObj.toDateString()}`);
        console.log(`Time: ${dateObj.toTimeString()}`); console.log(x)})

    session.on("Network.webSocketFrameSent", (x) =>{
        console.log("===================================================================== SENT: =======================================================================")
        const dateObj = new Date();
        console.log(`Date: ${dateObj.toDateString()}`);
        console.log(`Time: ${dateObj.toTimeString()}`);
        console.log(x)} )


    await page.goto('https://iboard.ssi.com.vn/bang-gia/hose')

})();
