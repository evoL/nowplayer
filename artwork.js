const gm = require('gm')
const request = require('request')
const getRawBody = require('raw-body')
const chroma = require('chroma-js')
const DataUri = require('datauri')
const farmhash = require('farmhash')
const LRU = require('lru-cache')
const chunk = require('lodash/chunk')

const HTTP_RX = /^https?:\/\//
const ARTWORK_CACHE = LRU({size: 50, length: ({uri}) => uri.length})

function fetchArtwork (source) {
  if (Buffer.isBuffer(source)) return Promise.resolve(source)
  if (typeof source === 'string' && HTTP_RX.test(source)) {
    return getRawBody(request(source))
  }

  return Promise.reject('Invalid artwork source')
}

function makeArtworkUri (source) {
  if (Buffer.isBuffer(source)) return Promise.resolve(new DataUri().format('.jpg', source).content)
  if (typeof source === 'string') return Promise.resolve(source)

  return Promise.reject('Invalid artwork source')
}

function makeCacheKey (source) {
  if (source === null) return null
  return farmhash.hash32(source)
}

function promisify(object, method, ...args) {
  const fn = object[method].bind(object, ...args)

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

function getArtworkColors (source) {
  return fetchArtwork(source).then(imageBuffer => {
    const image = gm(imageBuffer)

    return Promise.all([
      promisify(image.colors(1), 'toBuffer', 'RGB'),
      promisify(image.resizeExact(3, 3), 'toBuffer', 'RGB')
    ])
  }).then(([colorBuffer, paletteBuffer]) => {
    const averageColor = Array.from(colorBuffer.slice(0, 3).values())
    const paletteColors = chunk(Array.from(paletteBuffer.values()), 3)

    return {
      averageColor: chroma(averageColor).hex(),
      palette: paletteColors.map((color) => chroma(color).hex())
    }
  })
}

class Artwork {
  constructor (source) {
    this.source = source
    this.cacheKey = makeCacheKey(source)
  }

  equals (other) {
    return this.cacheKey === other.cacheKey
  }

  isValid () {
    return this.source !== null
  }

  isLocal () {
    return Buffer.isBuffer(this.source)
  }

  toJSON () {
    return ARTWORK_CACHE.has(this.cacheKey) ? ARTWORK_CACHE.get(this.cacheKey) : {ready: false}
  }

  format () {
    if (!this.isValid()) return Promise.resolve(null)
    if (ARTWORK_CACHE.has(this.cacheKey)) return Promise.resolve(ARTWORK_CACHE.get(this.cacheKey))
    return Promise.all([makeArtworkUri(this.source), getArtworkColors(this.source)]).then(([uri, colors]) => {
      const formatted = {
        uri,
        color: colors.averageColor,
        palette: colors.palette
      }
      ARTWORK_CACHE.set(this.cacheKey, formatted)
      return formatted
    }, (error) => console.error(error))
  }
}

module.exports = Artwork
