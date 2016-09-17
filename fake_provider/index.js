const path = require('path')
const fs = require('fs')
const DataUri = require('datauri')

const noop = () => {}

function loadArtwork (filename) {
  const artworkPath = path.join(__dirname, filename)
  const buffer = fs.readFileSync(artworkPath)

  return new DataUri().format('.jpg', buffer).content
}

const artwork = loadArtwork('artwork1.jpg')

const UPDATES = [
  {},
  {
    album: 'A Head Full Of Dreams',
    artist: 'Coldplay',
    title: 'Hymn For The Weekend',
    trackId: '?',
    artwork: {
      data: artwork,
      color: '#cea498'
    }
  },
  {
    album: 'A Head Full Of Dreams',
    artist: 'Coldplay',
    title: 'Fun (feat. Tove Lo)',
    trackId: '?',
    artwork: {
      data: artwork,
      color: '#cea498'
    }
  },
  {
    album: "No Man's Sky: Music For An Infinite Universe",
    artist: '65daysofstatic',
    title: 'Blueprint for a Slow Machine',
    trackId: '?',
    artwork: {
      data: loadArtwork('artwork3.jpg'),
      color: '#31353a'
    }
  }
]

class FakeProvider {
  constructor ({onUpdate}) {
    this.onUpdate = onUpdate || noop
    this.currentIndex = 0
  }

  start () {
    this.interval = setInterval(this._update.bind(this), 5000)
    this._update()
  }

  stop () {
    clearInterval(this.interval)
  }

  _update () {
    this.onUpdate(UPDATES[this.currentIndex])
    this.currentIndex = (this.currentIndex + 1) % UPDATES.length
  }
}

module.exports = FakeProvider
