// https://github.com/aslushnikov/getting-started-with-cdp#using-puppeteers-cdpsession

const puppeteer = require('puppeteer')
const ws = require('ws')
const fs = require('fs')

process.stdin.resume() //so the program will not close instantly

const getDateString = () => {
  var MyDate = new Date()
  var MyDateString

  return (
    MyDate.getFullYear() +
    '_' +
    ('0' + (MyDate.getMonth() + 1)).slice(-2) +
    '_' +
    ('0' + MyDate.getDate()).slice(-2)
  )
}

const scrape = async () => {
  // Use Puppeteer to launch a browser and open a page.
  const browser = await puppeteer.launch({
    headless: true,
    autoClose: false,
    devtools: false,
    ignoreHTTPSErrors: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  const page = await browser.newPage()

  // Create a raw DevTools protocol session to talk to the page.
  // Use CDP to set the animation playback rate.
  const session = await page.target().createCDPSession()
  // noinspection JSStringConcatenationToES6Template
  await session.send('Network.enable')
  // noinspection JSStringConcatenationToES6Template
  await session.send('Page.enable')

  await page.setViewport({ width: 1865, height: 930 })
  // Check it out! Fast animations on the "loading..." screen!
  const URL = 'https://iboard.ssi.com.vn/bang-gia/hose'
  await page.goto(URL)

  const PATH = '/d/data/ssi/'
  session.on('Network.webSocketFrameReceived', (x) => {
    console.log(
      '==================================================================== RECEIVED: ===================================================================='
    )
    const dateObj = new Date()
    console.log(`Date: ${dateObj.toDateString()}`)
    console.log(`Time: ${dateObj.toTimeString()}`)
    console.log(x)
    const FN = `${PATH}${getDateString()}_ssi_hose.received.txt`
    //   fs.appendFile(
    //     FN,
    //     '\n' +
    //       JSON.stringify({
    //         description: `Date: ${dateObj.toDateString()}, Time: ${dateObj.toTimeString()}, url:https://iboard.ssi.com.vn/bang-gia/hose`,
    //         timestamp: dateObj.getTime(),
    //         data: x,
    //       }),
    //     function (err) {
    //       if (err) throw err
    //     }
    //   )
    console.log('Wrote to' + FN)
  })

  session.on('Network.webSocketFrameSent', (x) => {
    console.log(
      '===================================================================== SENT: ======================================================================='
    )
    const dateObj = new Date()
    console.log(`Date: ${dateObj.toDateString()}`)
    console.log(`Time: ${dateObj.toTimeString()}`)
    const FN = `${PATH}${getDateString()}_ssi_hose.sent.txt`
    //   fs.appendFile(
    //     FN,
    //     '\n' +
    //       JSON.stringify({
    //         description: `Date: ${dateObj.toDateString()}, Time: ${dateObj.toTimeString()}, url:https://iboard.ssi.com.vn/bang-gia/hose`,
    //         timestamp: dateObj.getTime(),
    //         data: x,
    //       }),
    //     function (err) {
    //       if (err) throw err
    //     }
    //   )
    console.log('Wrote to' + FN)
  })

  session.on('error', () => {
    console.log('Session error')
  })

  function exitHandler(options, exitCode) {
    console.log(`Exited`)
    if (options.cleanup) console.log('clean')
    if (exitCode || exitCode === 0) console.log(exitCode)
    browser.close()
    console.log('Close Chrome browser')
    if (options.exit) process.exit()
  }

  //do something when app is closing
  process.on('exit', exitHandler.bind(null, { cleanup: true }))

  //catches ctrl+c event
  process.on('SIGINT', exitHandler.bind(null, { exit: true }))

  // catches "kill pid" (for example: nodemon restart)
  process.on('SIGUSR1', exitHandler.bind(null, { exit: true }))
  process.on('SIGUSR2', exitHandler.bind(null, { exit: true }))

  //catches uncaught exceptions
  process.on('uncaughtException', exitHandler.bind(null, { exit: true }))
}

scrape()

// const conn = new ws('wss://realtime-iboard.ssi.com.vn/graphql')

// conn.on('open', function open() {
//   conn.send('something')
// })

// conn.on('message', function incoming(data) {
//   console.log(data)
// })
