const gm = require('gm')
const request = require('request')
const getRawBody = require('raw-body')
const chroma = require('chroma-js')
const DataUri = require('datauri')
const farmhash = require('farmhash')
const LRU = require('lru-cache')

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

function getArtworkColor (source) {
  return fetchArtwork(source).then(imageBuffer => (
    new Promise((resolve, reject) => {
      gm(imageBuffer).colors(1).toBuffer('RGB', (err, value) => {
        if (err) {
          reject(err)
        } else {
          resolve(value)
        }
      })
    })
  )).then(buffer => {
    const rgb = Array.from(buffer.slice(0, 3).values())
    return chroma(rgb).hex()
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
    return Promise.all([makeArtworkUri(this.source), getArtworkColor(this.source)]).then(([uri, color]) => {
      const formatted = {uri, color}
      ARTWORK_CACHE.set(this.cacheKey, formatted)
      return formatted
    }, (error) => console.error(error))
  }
}

module.exports = Artwork
