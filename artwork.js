const gm = require('gm')
const request = require('request')
const getRawBody = require('raw-body')
const chroma = require('chroma-js')
const DataUri = require('datauri')
const farmhash = require('farmhash')

const HTTP_RX = /^https?:\/\//

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
    this._cached = null
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
    return this._cached || {ready: false}
  }

  format () {
    if (!this.isValid()) return Promise.resolve(null)
    if (this._cached) return Promise.resolve(this._cached)
    return Promise.all([makeArtworkUri(this.source), getArtworkColor(this.source)]).then(([uri, color]) => {
      this._cached = {uri, color}
      return this._cached
    })
  }
}

module.exports = Artwork
