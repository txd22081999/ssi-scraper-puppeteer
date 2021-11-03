// https://github.com/aslushnikov/getting-started-with-cdp#using-puppeteers-cdpsession

import puppeteer from 'puppeteer'
import ws from 'ws'
import fs from 'fs'
import fetch from 'node-fetch'
import { exec } from 'child_process'
import { priceDiff, readFile } from './read-file.js'
import { OUTPUT_PATH } from './constants.js'
import axios from 'axios'

const PS_URL = 'https://iboard.ssi.com.vn/bang-gia/phai-sinh'
const VN30_URL = 'https://iboard.ssi.com.vn/bang-gia/vn30'
const PS_INGEST_URL = 'http://localhost:5994'
const VN30_INGEST_URL = 'http://localhost:5993'
const CHECK_STATUS_INTERVAL = 1000 * 2 // in ms
const MAX_WAITING_TIME = 60 // in second
const FILE_NAME = `index.js`
const PANE_ID = process.env.TMUX_PANE || 'puppeteer'
const VIBER_BOT_URL = 'http://localhost:5080/'

const CLEAR_FILE_INTERVAL_TIME = 1000 * 60

let clearOutputInterval = setInterval(() => {
  fs.writeFile(OUTPUT_PATH, '', function (err) {
    if (err) {
      return console.log(err)
    }
    console.log(`Clear PS output! ${new Date().toString()}`)
  })
}, CLEAR_FILE_INTERVAL_TIME)

process.stdin.resume() //so the program will not close instantly

const getDaysInMonth = (month, year) => {
  var date = new Date(year, month - 1, 1)
  var days = []
  while (date.getMonth() === month - 1) {
    date.setDate(date.getDate() + 1)
    days.push(new Date(date))
  }
  return days
}

const getThurdays = () => {
  const today = new Date()
  const days = getDaysInMonth(today.getMonth() + 1, today.getFullYear())

  const dueDates = []
  for (let i = 0; i < days.length; i++) {
    const day = days[i]
    const order = day.getDay()
    if (order === 5) {
      dueDates.push(day)
    }
  }

  return dueDates
}

const getDueDay = () => {
  return getThurdays()[2]
}

const isAfterDueDate = (date = new Date()) => {
  const dueDate = getDueDay()
  date = new Date(date.setHours(date.getHours() + 7))
  return +date.getTime() > +dueDate.getTime()
}

const getCurrentMonthAndNextMonthCode = () => {
  const today = new Date()
  const month = today.getMonth() + 1
  const year = today.getFullYear() - 2000
  const derivativeCode = `VN30F${year}` // VN30F21
  let currentMonth = month < 10 ? `0${month}` : month

  let nextMonth = month + 1 > 12 ? 1 : month + 1
  nextMonth = nextMonth < 10 ? `0${nextMonth}` : nextMonth

  let nextNextMonth = month + 2 > 12 ? 1 : month + 2
  nextNextMonth = nextNextMonth < 10 ? `0${nextNextMonth}` : nextNextMonth

  // Example: VN30F2107
  let codeCurrentMonth
  let codeFullNextMonth

  codeCurrentMonth = isAfterDueDate(today)
    ? `${derivativeCode}${nextMonth}`
    : `${derivativeCode}${currentMonth}`
  codeFullNextMonth = isAfterDueDate(today)
    ? `${derivativeCode}${nextNextMonth}`
    : `${derivativeCode}${nextMonth}`

  return {
    derivativeCodeFullCurrentMonth: codeCurrentMonth,
    derivativeCodeFullNextMonth: codeFullNextMonth,
  }
}
const execCommand = (command) => {
  exec(command, (err, stdout, stderr) => {
    if (err) {
      // node couldn't execute the command
      console.log(err)
      return
    }

    // // the *entire* stdout and stderr (buffered)
    console.log(`stdout: ${stdout}`)
    console.log(`stderr: ${stderr}`)
  })
}

// refresh every time new data received
let globalTimePS = new Date()
let globalTimeVN30 = new Date()

const checkStatus = (globalTime) => {
  const now = new Date()
  const duration = (now - globalTime) / 1000 // in second
  const MARKET_START_TIME = new Date(new Date().setHours(8, 55, 0))
  const MARKET_END_TIME = new Date(new Date().setHours(14, 45, 0))
  const BREAK_START_TIME = new Date(new Date().setHours(11, 31, 0))
  const BREAK_END_TIME = new Date(new Date().setHours(12, 59, 0))

  if (now < MARKET_START_TIME || now > MARKET_END_TIME) {
    console.log('Waiting for market to start! ...')
    return
  }
  if (now < BREAK_END_TIME && now > BREAK_START_TIME) {
    console.log('Noon break time! ...')
    return
  }
  if (duration < MAX_WAITING_TIME) {
    // Still running good
    return
  }
  // Exceed pending time, maybe encounter error -> restart tmux
  execCommand(
    `tmux send-keys -t "${PANE_ID}" C-c C-z "node ${FILE_NAME}" Enter`
  )
  // Execute order:
  // 1. Ctrl C
  // 2. node index.js
  // 3. Enter
}

const handleErrors = (response) => {
  if (!response.ok) {
    console.log(response.statusText)
  }
  return response
}

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

const sendDataHoseAPI = (data) => {
  const postData = () =>
    fetch('http://localhost:5998/ingest-data', {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
    })
      .then(handleErrors)
      .then((res) => res.json())
      .then((data) => data)
      .catch(function (error) {
        console.log(error)
      })

  const BID_ASK_PORT = 5996
  const postBidAskData = () =>
    fetch(`http://localhost:${BID_ASK_PORT}/bid-ask`, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
    })
      .then(handleErrors)
      .then((res) => res.json())
      .then((data) => data)
      .catch(function (error) {
        console.log(error)
      })

  console.log(data)
  postData(data)
    .then(console.log)
    .then((data) => data)
  try {
    postBidAskData(data)
  } catch (error) {
    console.log('Bid Ask server is not running!')
  }
}

const scrapePageHose = async (page) => {
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

  session.on('Network.webSocketFrameReceived', (x) => {
    // console.log(
    //   '==================================================================== RECEIVED HOSE ===================================================================='
    // )
    const dateObj = new Date()
    // console.log(`Date: ${dateObj.toDateString()}`)
    // console.log(`Time: ${dateObj.toTimeString()}`)
    // console.log(x)
    const IGNORE_KEY_SCRAPER = ['I#HNX']
    // if (
    //   !IGNORE_KEY_SCRAPER.some((key) => x.response.payloadData.includes(key))
    // ) {
    //   sendDataHoseAPI({
    //     description: `Date: ${dateObj.toDateString()}, Time: ${dateObj.toTimeString()}, url: ${URL}`,
    //     timestamp: dateObj.getTime(),
    //     data: x,
    //   }),
    //     function (err) {
    //       if (err) throw err
    //     }
    // }

    const PATH = '/Users/mac/Workspaces/Code/ps-indicator/ssi-scraper/output/'
    const FN = `${PATH}${getDateString()}_ssi_hose.received.txt`
    fs.appendFile(
      FN,
      '\n' +
        JSON.stringify({
          description: `Date: ${dateObj.toDateString()}, Time: ${dateObj.toTimeString()}, url:https://iboard.ssi.com.vn/bang-gia/hose`,
          timestamp: dateObj.getTime(),
          data: x,
        }),
      function (err) {
        if (err) throw err
      }
    )
    // console.log('Wrote HOSE to' + FN)
  })

  //   session.on('Network.webSocketFrameSent', (x) => {
  //     console.log(
  //       '===================================================================== SENT: ======================================================================='
  //     )
  //     const dateObj = new Date()
  //     console.log(`Date: ${dateObj.toDateString()}`)
  //     console.log(`Time: ${dateObj.toTimeString()}`)
  //     const FN = `${PATH}${getDateString()}_ssi_hose.sent.txt`
  //     //   fs.appendFile(
  //     //     FN,
  //     //     '\n' +
  //     //       JSON.stringify({
  //     //         description: `Date: ${dateObj.toDateString()}, Time: ${dateObj.toTimeString()}, url:https://iboard.ssi.com.vn/bang-gia/hose`,
  //     //         timestamp: dateObj.getTime(),
  //     //         data: x,
  //     //       }),
  //     //     function (err) {
  //     //       if (err) throw err
  //     //     }
  //     //   )
  //     console.log('Wrote to' + FN)
  //   })

  session.on('error', () => {
    console.log('Session error')
  })
}

const scrapePagePS = async (page) => {
  setInterval(() => {
    // checkStatus(globalTimePS)
  }, CHECK_STATUS_INTERVAL)

  // Create a raw DevTools protocol session to talk to the page.
  // Use CDP to set the animation playback rate.
  try {
    const session = await page.target().createCDPSession()
    // noinspection JSStringConcatenationToES6Template
    await session.send('Network.enable')
    // noinspection JSStringConcatenationToES6Template
    await session.send('Page.enable')

    await page.setViewport({ width: 1865, height: 930 })
    // Check it out! Fast animations on the "loading..." screen!
    await page.goto(PS_URL)
    const derivativeCodeFullCurrentMonth =
      getCurrentMonthAndNextMonthCode().derivativeCodeFullCurrentMonth
    console.log(derivativeCodeFullCurrentMonth)
    const symbol = derivativeCodeFullCurrentMonth
    const selector = `#${symbol} > td.stockSymbol`
    await page.waitForSelector(selector)
    await page.evaluate((derivativeCodeFullCurrentMonth) => {
      const symbol = derivativeCodeFullCurrentMonth
      const selector = `#${symbol} > td.stockSymbol`
      return document.querySelector(selector).click()
    }, derivativeCodeFullCurrentMonth)

    async function sendData(raw) {
      raw['myTimeStamp'] = new Date().getTime()

      let text = JSON.stringify(raw)
      const postData = () =>
        fetch(`${PS_INGEST_URL}/ingest-data`, {
          method: 'POST',
          body: text,
          headers: {
            'Content-type': 'application/json; charset=UTF-8',
          },
        })
          .then(handleErrors)
          .then((res) => res.json())
          .then((data) => console.log(data))

      const sendViber = async (text) => {
        const res = await axios.post(VIBER_BOT_URL, { message: text })
        const { data } = res
        console.log(data)
        return data
      }

      if (
        text.includes(
          getCurrentMonthAndNextMonthCode().derivativeCodeFullCurrentMonth
        )
      ) {
        const data = text.split('|')
        const priceIndex = 42
        // const priceIndex = 1
        const price = data[priceIndex] ?? 0
        const currentTime = raw['myTimeStamp']

        const PRICE_LIMIT = 1
        const priceDiffMatch = await priceDiff(OUTPUT_PATH, PRICE_LIMIT)
        if (priceDiffMatch.length > 0) {
          console.log(`===============================================
                      ================     STONK!   ==================
                      ===============================================`)
          const difference = +Number.parseFloat(
            priceDiffMatch[0].price - priceDiffMatch[1].price
          ).toFixed(1)
          const direction = difference > 0 ? 'giảm' : 'tăng'
          const message = `Phái sinh ${direction} ${Math.abs(
            difference
          )} điểm: ${priceDiffMatch[0].price} (${
            priceDiffMatch[0].timeStr
          }) -> ${priceDiffMatch[1].price} (${priceDiffMatch[1].timeStr})`
          console.log(message)
          sendViber(message)
          console.log('MATCH', priceDiffMatch)
        }

        const outputText = JSON.stringify({ time: currentTime, price })
        fs.appendFile(OUTPUT_PATH, outputText + '_', function (err) {
          if (err) {
            return console.log(err)
          }
          console.log('Wrote PS!')
        })
        // const duration = currentTime -
        // postData(data)
        //   .then(console.log)
        //   .then((data) => data)
      }
    }

    session.on('Network.webSocketFrameReceived', (x) => {
      '==================================================================== RECEIVED PS ===================================================================='
      // console.log(x)
      globalTimePS = new Date() // set global date to current time that received data
      sendData(x)
    })

    session.on('Network.webSocketFrameSent', (x) => {
      return
      console.log(
        '===================================================================== SENT: ======================================================================='
      )
      const dateObj = new Date()
      console.log(`Date: ${dateObj.toDateString()}`)

      const FN = `${PATH}${getDateString()}_ssi_hose.sent.txt`
      fs.appendFile(
        FN,
        '\n' +
          JSON.stringify({
            description: `Date: ${dateObj.toDateString()}, 
                    Time: ${dateObj.toTimeString()}, 
                    url:https://iboard.ssi.com.vn/bang-gia/hose`,
            timestamp: dateObj.getTime(),
            data: x,
          }),
        function (err) {
          if (err) throw err
        }
      )
      console.log('Wrote to' + FN)
    })

    session.on('error', (x) => {
      console.log('Error')
      console.log(x)
    })
  } catch (error) {
    console.log('Error')
    console.log(error)
  }
}

const scrapePageVn30 = async (page) => {
  setInterval(() => {
    // checkStatus(globalTimeVN30)
  }, CHECK_STATUS_INTERVAL)

  const parseVn30Data = (data) => {
    const {
      response: { payloadData },
    } = data
    try {
      const containVn30 = payloadData.split('|')[0] == 'I#VN30'
      if (containVn30) {
        return payload
      }
      return null
    } catch (error) {
      // console.log('Error')
      return null
    }
  }

  // Create a raw DevTools protocol session to talk to the page.
  // Use CDP to set the animation playback rate.
  try {
    const session = await page.target().createCDPSession()
    // noinspection JSStringConcatenationToES6Template
    await session.send('Network.enable')
    // noinspection JSStringConcatenationToES6Template
    await session.send('Page.enable')

    await page.setViewport({ width: 1865, height: 930 })
    // Check it out! Fast animations on the "loading..." screen!
    await page.goto(VN30_URL)

    function sendData(data) {
      const dateObj = new Date()
      data['myTimeStamp'] = dateObj.getTime()

      let text = JSON.stringify(data)
      const postData = () =>
        fetch(`${VN30_INGEST_URL}/ingest-data`, {
          method: 'POST',
          body: text,
          headers: {
            'Content-type': 'application/json; charset=UTF-8',
          },
        })
          .then(handleErrors)
          .then((res) => res.json())
          .then(console.log)
      postData(data)
    }

    session.on('Network.webSocketFrameReceived', (x) => {
      '==================================================================== RECEIVED VN30 ===================================================================='
      globalTimeVN30 = new Date() // set global date to current time that received data
      const data = parseVn30Data(x)
      if (data) {
        console.log(data)
        sendData(x)
      }
    })

    session.on('Network.webSocketFrameSent', (x) => {
      return
      console.log(
        '===================================================================== SENT: ======================================================================='
      )
      const dateObj = new Date()
      console.log(`Date: ${dateObj.toDateString()}`)

      const FN = `${PATH}${getDateString()}_ssi_hose.sent.txt`
      fs.appendFile(
        FN,
        '\n' +
          JSON.stringify({
            description: `Date: ${dateObj.toDateString()}, 
                    Time: ${dateObj.toTimeString()}, 
                    url:https://iboard.ssi.com.vn/bang-gia/hose`,
            timestamp: dateObj.getTime(),
            data: x,
          }),
        function (err) {
          if (err) throw err
        }
      )
      console.log('Wrote to' + FN)
    })

    session.on('error', (x) => {
      console.log('Error')
      console.log(x)
    })
  } catch (error) {
    console.log('Error')
    console.log(error)
  }
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

  const pageHose = await browser.newPage()
  const pagePs = await browser.newPage()
  //  const pageVn30 = await browser.newPage()

  scrapePageHose(pageHose)
  scrapePagePS(pagePs)
  // scrapePageVn30(pageVn30)

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
