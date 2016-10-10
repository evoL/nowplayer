const fs = require('fs')
const path = require('path')
const readline = require('readline')
const gm = require('gm')
const getRawBody = require('raw-body')
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

const album = makeLineUpdater('Snip_Album.txt')
const artist = makeLineUpdater('Snip_Artist.txt')
const title = makeLineUpdater('Snip_Track.txt')
const id = makeLineUpdater('Snip_TrackId.txt')

const artwork = makeFileUpdater('Snip_Artwork.jpg', (stream, resolve, reject) => {
  getRawBody(stream).then((imageBuffer) => {
    const image = gm(imageBuffer)

    image.size((err, size) => {
      if (err) {
        reject(err)
      } else if (size.width === 1 && size.height === 1) {
        resolve(null)
      } else {
        resolve(imageBuffer)
      }
    })
  })
})

module.exports = {
  id,
  album,
  artist,
  title,
  artwork
}
