const fs = require('fs')
const path = require('path')
const readline = require('readline')
const gm = require('gm')
const getRawBody = require('raw-body')
const DataUri = require('datauri')
const {bindKey} = require('lodash')

function makeFileUpdater (fileName, worker) {
  return (options) => {
    const fullPath = path.resolve(options.path, fileName)
    const stream = fs.createReadStream(fullPath)

    return new Promise((resolve, reject) => (
      worker(stream, resolve, reject)
    ))
  }
}

function makeLineUpdater (fileName) {
  return makeFileUpdater(fileName, (stream, resolve) => {
    const lineReader = readline.createInterface({
      input: stream
    })

    lineReader.on('line', (line) => {
      resolve(line)
      lineReader.close()
      stream.destroy()
    })

    lineReader.on('close', () => {
      resolve('')
    })
  })
}

const promisify = (fnOrObject, key, ...args) => {
  const fn = (key === void 0) ? fnOrObject : bindKey(fnOrObject, key, ...args)

  return new Promise((resolve, reject) => {
    fn((err, value) => {
      if (err) {
        reject(err)
      } else {
        resolve(value)
      }
    })
  })
}

const album = makeLineUpdater('Snip_Album.txt')
const artist = makeLineUpdater('Snip_Artist.txt')
const title = makeLineUpdater('Snip_Track.txt')
const id = makeLineUpdater('Snip_TrackId.txt')

const artwork = makeFileUpdater('Snip_Artwork.jpg', (stream, resolve, reject) => {
  getRawBody(stream).then((imageBuffer) => {
    const image = gm(imageBuffer)

    return promisify(image, 'size').then(({width, height}) => {
      if (width === 1 && height === 1) {
        return null // no artwork
      } else {
        return new DataUri().format('.jpg', imageBuffer).content
      }
    })
  }).then(resolve, () => {})
})

module.exports = {
  id,
  album,
  artist,
  title,
  artwork
}
