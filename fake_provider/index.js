const path = require('path')
const fs = require('fs')

const noop = () => {}

function loadArtwork (filename) {
  const artworkPath = path.join(__dirname, filename)
  return fs.readFileSync(artworkPath)
}

const artwork = loadArtwork('artwork1.jpg')

const UPDATES = [
  {
    playing: false,
    track: {}
  },
  {
    playing: true,
    track: {
      id: '1',
      album: 'A Head Full Of Dreams',
      artist: 'Coldplay',
      title: 'Hymn For The Weekend',
      artwork
    }
  },
  {
    playing: true,
    track: {
      id: '2',
      album: 'A Head Full Of Dreams',
      artist: 'Coldplay',
      title: 'Fun (feat. Tove Lo)',
      artwork
    }
  },
  {
    playing: true,
    track: {
      id: '3',
      album: "No Man's Sky: Music For An Infinite Universe",
      artist: '65daysofstatic',
      title: 'Blueprint for a Slow Machine',
      artwork: loadArtwork('artwork3.jpg')
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
