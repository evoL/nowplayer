const request = require('request')
const EventEmitter = require('events')
const last = require('lodash/last')
const split = require('lodash/split')
const LRU = require('lru-cache')

let ARTWORK_CACHE = LRU({size: 50, length: (url) => url.length})

function fetchFromCache (cache, key) {
  return new Promise((resolve, reject) => {
    if (cache.has(key)) {
      resolve(cache.get(key))
    } else {
      reject(cache.set.bind(cache, key))
    }
  })
}

function makeRequest (options, requestFunction = request) {
  return new Promise((resolve, reject) => {
    requestFunction(options, (err, message, response) => {
      if (err) {
        reject(err)
      } else if (message.statusCode >= 400) {
        reject(response)
      } else {
        resolve(response)
      }
    })
  })
}

const getOAuthToken = () => makeRequest({
  uri: 'https://open.spotify.com/token',
  json: true
}).then((response) => response.t)

const getArtwork = (albumId) => (
  fetchFromCache(ARTWORK_CACHE, albumId)
  .catch((set) => (
    makeRequest({
      uri: `https://api.spotify.com/v1/albums/${albumId}`,
      json: true
    })
    .then((response) => response.images.find((image) => image.width <= 300).url)
    .then((url) => {
      set(url)
      return url
    })
  ))
)

const makeTestRequest = (port) => makeRequest({
  uri: `https://localhost:${port}/service/version.json`,
  qs: {service: 'remote'},
  timeout: 2000,
  strictSSL: false
}).then(() => port)

const findPort = () => {
  let ports = []
  for (let i = 0; i < 10; i++) {
    ports.push(4370 + i)
  }

  return ports.reduce((promise, port) => promise.catch(() => makeTestRequest(port)), Promise.reject())
}

function parseSpotifyUri (uri) {
  const [, type, id] = split(uri, ':', 3)
  return {id, type}
}

class SpotifyProvider {
  constructor (options) {
    this.onUpdate = options.onUpdate || (() => {})
    this.emitter = new EventEmitter()
    this.running = false
    this.ready = false

    Promise.all([
      getOAuthToken().then((token) => {
        this.oAuthToken = token
      }),
      findPort().then((port) => {
        this.port = port
        return this._makeRequest({url: '/simplecsrf/token.json'})
      }).then(({token}) => {
        this.csrfToken = token
      })
    ]).then(() => {
      this.ready = true
      this.emitter.emit('ready')
    })
  }

  start () {
    this.running = true

    if (this.ready) {
      this._onStart()
    } else {
      this.emitter.on('ready', this._onStart.bind(this))
    }
  }

  stop () {
    this.running = false
  }

  _onStart () {
    this._makeStatusRequest()
    this._makePeriodicStatusRequest()
  }

  _update (payload) {
    if (!this.running) return

    this.onUpdate(payload)
  }

  _makePeriodicStatusRequest () {
    if (!this.running) return

    return this._makeStatusRequest({
      returnon: 'login,logout,play,pause,error,ap',
      returnafter: 60
    }).then(() => this._makePeriodicStatusRequest())
  }

  _makeStatusRequest (qs = {}) {
    return this._makeRequest({
      url: '/remote/status.json',
      timeout: 60500,
      qs
    }).then((status) => {
      const trackInfo = parseSpotifyUri(status.track.track_resource.uri)
      const albumInfo = parseSpotifyUri(status.track.album_resource.uri)

      const payload = {
        playing: status.playing,
        track: {
          id: trackInfo.id,
          title: status.track.track_resource.name,
          artist: status.track.artist_resource.name,
          album: status.track.album_resource.name,
          artwork: null
        }
      }

      if (trackInfo.type === 'local') return payload

      return getArtwork(albumInfo.id).then(
        (artwork) => {
          payload.track.artwork = artwork
          return payload
        },
        (err) => {
          console.error('Error fetching artwork', err)
          return payload
        }
      )
    }).then(
      (payload) => this._update(payload),
      (err) => {
        console.error(err)
        setTimeout(() => this._makeStatusRequest(), 1000)
      }
    )
  }

  _makeRequest (options) {
    options = Object.assign({
      baseUrl: `https://localhost:${this.port}/`,
      strictSSL: false,
      json: true,
      headers: {
        Origin: 'https://open.spotify.com'
      }
    }, options)

    let auth = {}
    if (this.oAuthToken) auth.oauth = this.oAuthToken
    if (this.csrfToken) auth.csrf = this.csrfToken
    options.qs = Object.assign(options.qs || {}, auth)

    return makeRequest(options)
  }
}

module.exports = SpotifyProvider
