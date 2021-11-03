// https://github.com/aslushnikov/getting-started-with-cdp#using-puppeteers-cdpsession
const fetch = require('node-fetch')
const puppeteer = require('puppeteer')
const ws = require('ws')
const fs = require('fs')
const { exec } = require('child_process')
const paneId = process.env.TMUX_PANE

const INGEST_HOST = 'http://localhost:5993'
const CHECK_STATUS_INTERVAL = 1000 * 2 // in ms
const MAX_WAITING_TIME = 60 // in second
const FILE_NAME = `index-vn30.js`

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

let globalDate = new Date() // refresh every time new data received

const checkStatus = () => {
  const now = new Date()
  const duration = (now - globalDate) / 1000 // in second
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
  execCommand(`tmux send-keys -t "${paneId}" C-c C-z "node ${FILE_NAME}" Enter`)
  // Execute order:
  // 1. Ctrl C
  // 2. node puppeteer_ps_hung.js
  // 3. Enter
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

const parseData = (data) => {
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

;(async () => {
  setInterval(() => {
    checkStatus()
  }, CHECK_STATUS_INTERVAL)

  // Use Puppeteer to launch a browser and open a page.
  const browser = await puppeteer.launch({
    headless: true,
    autoClose: false,
    devtools: false,
    ignoreHTTPSErrors: true,
  })

  // fetch('https://bddatafeed.vps.com.vn/getpschartintraday/VN30F1M', {
  //   headers: {
  //     accept: 'application/json, text/javascript, */*; q=0.01',
  //     'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
  //     'if-none-match': 'W/"e8962-s/tfPQ0efSf6a38uH3C4kUfcMyA"',
  //     'sec-ch-ua':
  //       '"Google Chrome";v="89", "Chromium";v="89", ";Not A Brand";v="99"',
  //     'sec-ch-ua-mobile': '?0',
  //     'sec-fetch-dest': 'empty',
  //     'sec-fetch-mode': 'cors',
  //     'sec-fetch-site': 'same-site',
  //   },
  //   referrer: 'https://banggia.vps.com.vn/',
  //   referrerPolicy: 'strict-origin-when-cross-origin',
  //   body: null,
  //   method: 'GET',
  //   mode: 'cors',
  // })
  //   .then((req) => {
  //     console.log('request sent')
  //     return req.text()
  //   })
  //   .then((data) => console.log())

  const page = await browser.newPage()

  // Create a raw DevTools protocol session to talk to the page.
  // Use CDP to set the animation playback rate.
  try {
    const session = await page.target().createCDPSession()
    // noinspection JSStringConcatenationToES6Template
    await session.send('Network.enable')
    // noinspection JSStringConcatenationToES6Template
    await session.send('Page.enable')

    await page.setViewport({ width: 1865, height: 930 })
    const URL = 'https://iboard.ssi.com.vn/bang-gia/vn30'
    await page.goto(URL)

    const PATH = '/d/data/ssi/'

    function handleErrors(response) {
      if (!response.ok) {
        console.log(response.statusText)
      }
      return response
    }

    function sendData(data) {
      const dateObj = new Date()
      data['myTimeStamp'] = dateObj.getTime()

      let text = JSON.stringify(data)
      const postData = () =>
        fetch(`${INGEST_HOST}/ingest-data`, {
          method: 'POST',
          body: text,
          headers: {
            'Content-type': 'application/json; charset=UTF-8',
          },
        })
          .then(handleErrors)
          .then((res) => res.json())
          .then((data) => console.log(data))
      // console.log(text)
      // if (text.includes('VN30F2109'))
      postData(data)
        .then(console.log)
        .then((data) => data)
    }

    session.on('Network.webSocketFrameReceived', (x) => {
      globalDate = new Date() // set global date to current time that received data
      const data = parseData(x)
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
})()
