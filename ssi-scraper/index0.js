// https://github.com/aslushnikov/getting-started-with-cdp#using-puppeteers-cdpsession

const puppeteer = require('puppeteer');
const ws = require('ws');


(async() => {
    // Use Puppeteer to launch a browser and open a page.
    const browser = await puppeteer.launch({
        headless: false,
        autoClose: false,
        devtools: false,
        ignoreHTTPSErrors: true,

    });
    const page = await browser.newPage();

    // Create a raw DevTools protocol session to talk to the page.
    // Use CDP to set the animation playback rate.
    const session = await page.target().createCDPSession();
    await session.send('Network.enable');
    await session.send('Page.enable');


    // Check it out! Fast animations on the "loading..." screen!
    await page.goto('https://iboard.ssi.com.vn/bang-gia/hose');

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
})();

const conn = new ws('wss://realtime-iboard.ssi.com.vn/graphql')

conn.on('open', function open() {
    conn.send('something');
});

conn.on('message', function incoming(data) {
    console.log(data);
});