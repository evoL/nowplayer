const request = require('request')
const EventEmitter = require('events')
const last = require('lodash/last')
const split = require('lodash/split')

function makeRequest (options, requestFunction = request) {
  return new Promise((resolve, reject) => {
    requestFunction(options, (err, _, response) => {
      if (err) {
        reject(err)
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

const getArtwork = (trackId) => makeRequest({
  uri: `https://api.spotify.com/v1/tracks/${trackId}`,
  json: true
}).then((response) => response.album.images.find((image) => image.width <= 300).url)

const makeTestRequest = (port) => makeRequest({
  uri: `https://localhost:${port}/service/version.json`,
  qs: {service: 'remote'},
  timeout: 2000,
  strictSSL: false
})

const findPort = () => {
  let ports = []
  for (let i = 0; i < 10; i++) {
    ports.push(4370 + i)
  }

  const promises = ports.map((port) => makeTestRequest(port).then(() => port))
  return Promise.race(promises)
}

function getTrackInfo (track) {
  const [,type,id] = split(track.track_resource.uri, ':', 3)
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
      const trackInfo = getTrackInfo(status.track)
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

      return getArtwork(trackInfo.id).then(
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
