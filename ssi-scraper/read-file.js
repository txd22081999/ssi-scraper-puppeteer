import fs from 'fs'
import moment from 'moment'
// import { OUTPUT_PATH } from './constants'

const readFile = () => {
  return new Promise((resolve, reject) =>
    fs.readFile(
      '/Users/mac/Workspaces/Code/ps-indicator/ssi-scraper/output/ps.txt',
      'utf-8',
      (err, data) => {
        if (err) reject(err)
        resolve(data)
      }
    )
  )
}

async function priceDiff(outputPath, priceLimit = 100) {
  const output = await readFile(outputPath)
  if (!output) return []
  let data = output.split('_').filter((item) => item)
  let dps = data
    .map((element) => {
      let obj = undefined
      obj = JSON.parse(element)
      const timeStr = moment(obj.time).format('hh:mm:ss')
      // const timeStr = new Date(obj.time).toString()
      obj.timeStr = timeStr
      obj.price = +obj.price
      return obj
    })
    .filter(({ price }) => price !== 0)

  let priceArr = dps.map(({ price }) => price)
  const priceSet = new Set(priceArr)
  priceArr = Array.from(priceSet)
  console.log('Price arr', priceArr)
  const match = comparator(priceArr, priceLimit)[0]
  if (!match || match.length === 0) return []

  const matchDetail = match.map((matchedPrice) => {
    return dps.find(({ price }) => price === matchedPrice)
  })
  //   console.log(matcheDetail)
  return matchDetail
}

2

function comparator(arr, target) {
  let res = []
  let indexes = []
  for (let i = 0; i < arr.length - 1; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      if (
        // arr[i] + arr[j] >= target &&
        Math.abs(arr[j] - arr[i]) >= target &&
        !indexes.includes(i) &&
        !indexes.includes(j)
      ) {
        res.push([arr[i], arr[j]])
        indexes.push(i)
        indexes.push(j)
      }
    }
  }
  return res
}

// priceDiff(OUTPUT_PATH, 90)
// const arr = [1521.8, 1521.8, 1521.9, 1521.7, 1522.1]
// console.log('TWO SUM', twoSum(arr, 0.3))

export { readFile, priceDiff }
