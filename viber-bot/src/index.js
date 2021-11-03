const Bot = require('viber-bot')
const ViberBot = Bot.Bot
const BotEvents = Bot.Events
const TextMessage = Bot.Message.Text
const SKIP_TIME = 60 // second

// Viber will push messages sent to this URL. Web server should be internet-facing.
const webhookUrl = 'https://9ff9-113-161-34-115.ngrok.io'

const bot = new ViberBot({
  authToken: '4e1ddc951fe7e292-2c31066b5e0a6123-ddb5fcec145467a8',
  name: 'F5BidAskVolume',
  avatar:
    'https://share.cdn.viber.com/pg_download?id=0-04-01-183ada6dd8b8c9e8cbb412a359709d48b7d320c03868eae5b2f5826bac31bf65&filetype=jpg&type=icon',
})

// const CLIENT_IDS = ['bMtS/OvBVHwf5SU33sgWMQ==']
const CLIENT_IDS = [
  'bMtS/OvBVHwf5SU33sgWMQ==',
  'RDywonCk+fMFTQbOYjmPxA==',
  '2W+6S2KUfhPCMwy/pBJABw==',
  'j/y8az0kJ/9XprwINJzLqg==',
  'vOnPBxKlKdZRQMe3tHeJXQ==',
]

// Perfect! Now here's the key part:
// bot.on(BotEvents.MESSAGE_RECEIVED, (message, response) => {
//   // Echo's back the message to the client. Your bot logic should sit here.
//   response.send(message)
// })

// Wasn't that easy? Let's create HTTPS server and set the webhook:
const https = require('https')
const port = process.env.PORT || 5080
let tick = 0

setInterval(() => {
  tick += 1
}, 1000)

const express = require('express')
const app = express()

app.use(express.json())
app.use('/viber/webhook', bot.middleware())

function sendMessage(msg) {
  CLIENT_IDS.forEach((clientId) => {
    bot.sendMessage({ id: clientId }, [new TextMessage(msg)])
  })
}

try {
  bot.setWebhook(webhookUrl)
} catch (error) {
  console.log(error)
}

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.post('/', (req, res) => {
  if (tick % SKIP_TIME !== 0) {
    res.send('Skip')
    return
  }
  const { body } = req
  const { message } = body
  console.log(body)
  if (!message) return
  sendMessage(message)
  res.send('Sent!')
})

app.post('/hpg', (req, res) => {
  const { body } = req
  const { message } = body
  console.log(body)
  if (!message) return
  sendMessage(message)
  res.send('Sent!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}!`)
  console.log('set webhook')
  //
})
