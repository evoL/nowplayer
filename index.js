const server = require('http').createServer()
const express = require('express')
const WebSocketServer = require('ws').Server
const EventEmitter = require('events')
const get = require('lodash/get')
const merge = require('lodash/merge')
const Artwork = require('./artwork')

const app = express()
const wss = new WebSocketServer({server})

const CONFIG = {
  provider: 'spotify',

  snip: {
    path: 'C:\\Users\\rafal\\Downloads\\Snip'
  }
}

function formatPayload (payload) {
  const {artwork} = payload.track

  if (artwork.isLocal()) {
    return merge({}, payload, {
      track: {artwork: '[snip]'}
    })
  }

  return payload
}

function updatePayload (payload) {
  // Wrap the artwork
  payload = merge({}, payload, {
    track: {artwork: new Artwork(payload.track.artwork || null)}
  })

  if (payload.playing === state.payload.playing
    && payload.track.id === state.payload.track.id
    && payload.track.artwork.equals(state.payload.track.artwork)) {
    return
  }

  state.payload = payload
  emitter.emit('change', payload)
}

function makeProvider (config, emitter) {
  const type = config.provider
  const ProviderClass = require(`./${type}_provider`)

  return new ProviderClass(Object.assign({}, config[type], {
    onUpdate: updatePayload
  }))
}

const state = {payload: {track: {artwork: new Artwork(null)}}}
const emitter = new EventEmitter()
emitter.on('change', (payload) => {
  console.log('Track changed: ', formatPayload(payload))
})

const provider = makeProvider(CONFIG, emitter)

wss.on('connection', (ws) => {
  const sendPayload = (payload) => {
    payload.track.artwork.format().then(() => {
      ws.send(JSON.stringify(payload))
    })
  }

  if (state.payload.playing !== undefined) sendPayload(state.payload)

  emitter.on('change', sendPayload)

  ws.on('close', () => {
    emitter.removeListener('change', sendPayload)
  })
})

app.use(express.static('public'))

server.on('request', app)
server.listen(8000, () => {
  console.log('Visit http://localhost:8000/')
  provider.start()
})
