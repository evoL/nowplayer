/* eslint-env browser */
/* global chroma */

function adjustColor (color) {
  const c = chroma(color)

  if (c.luminance() < 0.5) return c.hex()
  return c.luminance(0.5).hex()
}

function makeImage (colors) {
  const prefix = 'R0lGODlhAwADAPMA'
  const suffix = '/evol/hacks/your/bytes/lol/CwAAAAAAwADAAAEBxAEMUgxB0UAOw=='
  let palette = ''

  let buffer = '\x00'
  for (let i = 0; i < 9; i++) {
    const color = chroma(colors[i] || '#000000')
    buffer += String.fromCharCode(...color.rgb())

    while (buffer.length > 3) {
      palette += btoa(buffer.substring(0, 3))
      buffer = buffer.substring(3)
    }
  }

  buffer += '\x00'
  palette += btoa(buffer).substring(0, 2)

  return 'data:image/gif;base64,' + prefix + palette + suffix
}

function updateElement (element, callback) {
  const newElement = element.cloneNode()
  callback(newElement)
  newElement.classList.add('is-new')

  element.classList.add('is-old')
  element.parentNode.insertBefore(newElement, element)

  const eventHandler = () => {
    element.removeEventListener('animationend', eventHandler)
    element.parentNode.removeChild(element)
    newElement.classList.remove('is-new')
  }

  element.addEventListener('animationend', eventHandler)
}

function updateField (element, newValue) {
  if (element.textContent === '' || !state.previousPayload.playing || document.hidden) {
    element.textContent = newValue
    return
  }

  if (element.textContent === newValue) {
    return
  }

  updateElement(element, (newElement) => { newElement.textContent = newValue })
}

function updateArtwork (element, newValue) {
  if (element.src === '' || !state.previousPayload.playing || document.hidden) {
    element.src = newValue
    return
  }

  if (element.src === newValue) {
    return
  }

  const wrap = element.parentNode

  const newWrap = wrap.cloneNode(true)
  newWrap.classList.add('is-new')

  const newElement = newWrap.querySelector('img')
  newElement.src = newValue

  wrap.classList.add('is-old')
  wrap.parentNode.insertBefore(newWrap, wrap)

  const eventHandler = () => {
    wrap.removeEventListener('animationend', eventHandler)
    wrap.parentNode.removeChild(wrap)
    newWrap.classList.remove('is-new')
  }

  wrap.addEventListener('animationend', eventHandler)
}

const PANEL_RX = /for-(\w+)/
const ALL_PANELS = Array.from(document.querySelectorAll('.panel')).map((panel) => panel.className.match(PANEL_RX)[1])
function switchPanel (name) {
  ALL_PANELS.forEach((panel) => {
    if (panel !== name) {
      document.documentElement.classList.remove(`is-${panel}`)
    }
  })

  document.documentElement.classList.add(`is-${name}`)
}

const TRANSPARENT_IMAGE = 'url(data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEAAAAALAAAAAABAAEAAAI=)'
function render (payload) {
  const {playing, track: {artist, album, title, artwork}} = payload

  const app = document.getElementById('App')

  if (!playing) {
    switchPanel('paused')
    document.body.style.backgroundColor = 'transparent'
    document.body.style.backgroundImage = TRANSPARENT_IMAGE
    document.title = 'Silence'
    return
  }

  switchPanel('playing')

  document.title = `${title} — ${artist}`

  updateField(app.querySelector('.is-artist'), artist)
  updateField(app.querySelector('.is-album'), album)
  updateField(app.querySelector('.is-title'), title)

  if (artwork) {
    const newImage = new Image()
    newImage.onload = () => {
      setTimeout(() => {
        updateArtwork(app.querySelector('.panel__artwork'), newImage.src)
        document.body.style.backgroundColor = adjustColor(artwork.color)
        document.body.style.backgroundImage = 'url(' + makeImage(artwork.palette.map(adjustColor)) + ')'
      }, 1)
    }
    newImage.crossOrigin = 'Anonymous'
    newImage.src = artwork.uri
  } else {
    document.body.style.backgroundColor = 'transparent'
    document.body.style.backgroundImage = TRANSPARENT_IMAGE
  }
}

const state = {
  previousPayload: {},
  payload: {},
  socketInterval: void 0
}

function start () {
  let ws = new WebSocket('ws://' + location.host + '/')
  ws.onmessage = function (event) {
    state.previousPayload = state.payload
    state.payload = JSON.parse(event.data)
    render(state.payload)
  }
  ws.onopen = function () {
    if (state.socketInterval) {
      clearInterval(state.socketInterval)
      state.socketInterval = void 0
    }
  }
  ws.onclose = function () {
    switchPanel('loading')
    if (!state.socketInterval) {
      state.socketInterval = setInterval(start, 2500)
    }
  }
}

start()
