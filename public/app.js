/* eslint-env browser */
/* global chroma */

let previousPayload = {}
let payload

function adjustColor (color) {
  const c = chroma(color)

  if (c.luminance() < 0.3) return c.hex()
  return c.luminance(0.3).hex()
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
  if (element.textContent === '' || !previousPayload.playing || document.hidden) {
    element.textContent = newValue
    return
  }

  if (element.textContent === newValue) {
    return
  }

  updateElement(element, (newElement) => { newElement.textContent = newValue })
}

function updateArtwork (element, newValue) {
  if (element.src === '' || !previousPayload.playing || document.hidden) {
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

function render (payload) {
  const {playing, track: {artist, album, title, artwork}} = payload

  const html = document.documentElement
  const app = document.getElementById('App')

  if (!playing) {
    html.classList.remove('is-playing')
    html.classList.add('is-paused')
    document.body.style.backgroundColor = 'transparent'
    document.title = 'Silence'
    return
  }

  html.classList.remove('is-paused')
  html.classList.add('is-playing')

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
      }, 1)
    }
    newImage.crossOrigin = 'Anonymous'
    newImage.src = artwork.uri
  } else {
    document.body.style.backgroundColor = 'transparent'
  }
}

let ws = new WebSocket('ws://' + location.host + '/')

ws.onmessage = function (event) {
  previousPayload = payload
  payload = JSON.parse(event.data)
  render(payload)
}
