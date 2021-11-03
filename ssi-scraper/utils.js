const moment = require('moment')

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

const parseSSI = (raw) => {
  // def parse_ssi(raw):
  //   f = lambda x: -1 if x == "ATC" else int(x) if len(x) > 0 else 0
  //   ff = lambda x: -1 if x == "ATC" else float(x) if len(x) > 0 else 0.0
  //   maybe_int = lambda x: int(x) if x != "" else np.NaN
  //   parse_time = lambda x: (
  //           dt.fromtimestamp(int(x) / 1000) - timedelta(hours=7)
  //   ).strftime("%X")
  const data = raw['data']['response']['payloadData'].split('|')

  const dp = {
    // timestamp2: raw['data']['timestamp'],
    timestamp: raw['timestamp'],
    time: moment(new Date(parseInt(raw['timestamp']))).format('HH:mm:ss'),
    hoseId: data[0],
    code: data[1],
    bestBid1: Number(data[2]),
    bestBid1Volume: Number(data[3]),
    bestBid2: Number(data[4]),
    bestBid2Volume: Number(data[5]),
    bestBid3: Number(data[6]),
    bestBid3Volume: Number(data[7]),
    bestOffer1: Number(data[22]),
    bestOffer1Volume: Number(data[23]),
    bestOffer2: Number(data[24]),
    bestOffer2Volume: Number(data[25]),
    bestOffer3: Number(data[26]),
    bestOffer3Volume: Number(data[27]),
    last: Number(data[42]),
    matchingVolume: data[43] * 1,
    averageMatchPrice: Number(data[47]),
    change: data[52],
    changePercentage: data[53],
    totalMatchVolume: data[54],
    totalMatchValue: data[55],
    refPrice: Number(data[61]),
    session: data[-14] ?? '',
    openPrice: Number(data[75]),
  }

  return dp
}

const raw = {
  description:
    'Date: Mon Nov 01 2021, Time: 09:28:14 GMT+0700 (Indochina Time), url:https://iboard.ssi.com.vn/bang-gia/hose',
  timestamp: 1635733694021,
  data: {
    requestId: '1719.64',
    timestamp: 2443.547702,
    response: {
      opcode: 1,
      mask: false,
      payloadData:
        'S#hose:1354|HPG|56700|128500|56600|478300|56500|641500|||||||||||||||56800|448300|56900|109800|57000|407800|||||||||||||||56700|10|57100|hose|56700|56912.92|||||-400|-0.7|3414500|194329170000||||||57100||LO|||s||| ||0|4472922706||0|57100|',
    },
  },
}

// console.log(parseSSI(raw))

module.exports = {
  execCommand,
  checkStatus,
  // parseSSI,
}
