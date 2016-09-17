const server = require('http').createServer()
const express = require('express')
const WebSocketServer = require('ws').Server
const EventEmitter = require('events')
// const kebabCase = require('lodash/kebabCase')
// const config = require('home-config').load('.nowplayer.ini')

const app = express()
const wss = new WebSocketServer({server})

function configFilePath () {
  return path.join(HOMEDIR, '.nowplayer.toml')
}

function formatTrack (track) {
  if (!track.artwork) return track

  return Object.assign({}, track, {artwork: {data: '[snip]', color: track.artwork.color}})
}

const state = {}
const emitter = new EventEmitter()
emitter.on('trackChanged', (track) => {
  console.log('Track changed: ', formatTrack(track))
  state.track = track
})

const provider = new SnipProvider({
  path: 'C:\\Users\\rafal\\Downloads\\Snip',
  onUpdate: function (track) {
    emitter.emit('trackChanged', track)
  }
})
// const provider = new FakeProvider({
//   onUpdate: (track) => emitter.emit('trackChanged', track)
// })

wss.on('connection', (ws) => {
  const sendTrack = (track) => ws.send(JSON.stringify(track))

  if (state.track) sendTrack(state.track)

  emitter.on('trackChanged', sendTrack)

  ws.on('close', () => {
    emitter.removeListener('trackChanged', sendTrack)
  })
})

app.use(express.static('public'))

server.on('request', app)
server.listen(8000, () => {
  console.log('Visit http://localhost:8000/')
  provider.start()
})
