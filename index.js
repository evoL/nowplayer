const server = require('http').createServer()
const express = require('express')
const WebSocketServer = require('ws').Server
const EventEmitter = require('events')
const get = require('lodash/get')
const merge = require('lodash/merge')

const app = express()
const wss = new WebSocketServer({server})

const CONFIG = {
  provider: 'snip',

  snip: {
    path: 'C:\\Users\\rafal\\Downloads\\Snip'
  }
}

function formatPayload (payload) {
  if ((get(payload, 'track.artwork') || '').startsWith('data:')) {
    return merge({}, payload, {
      track: {artwork: '[snip]'}
    })
  }

  return payload
}

function updatePayload (payload) {
  if (payload.playing === state.payload.playing
    && payload.track.id === state.payload.track.id
    && payload.track.artwork === state.payload.track.artwork) {
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

const state = {payload: {track: {}}}
const emitter = new EventEmitter()
emitter.on('change', (payload) => {
  console.log('Track changed: ', formatPayload(payload))
})

const provider = makeProvider(CONFIG, emitter)

wss.on('connection', (ws) => {
  const sendPayload = (payload) => ws.send(JSON.stringify(payload))

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
