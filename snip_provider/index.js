const chokidar = require('chokidar')
const {camelCase, debounce} = require('lodash')
const updaters = require('./updaters')

const noop = () => {}
const fieldRx = /^Snip_([^.]+)\.(?:jpg|txt)$/

class SnipProvider {
  constructor (options) {
    this.options = Object.assign({
      onUpdate: noop,
      threshold: 300
    }, options)
    const {onUpdate, threshold} = this.options

    this._handleUpdate = this._handleUpdate.bind(this)
    this._onUpdate = onUpdate
    this.update = debounce(this.update.bind(this), threshold)

    this.state = {}
  }

  start () {
    this.watcher = chokidar
      .watch([
        'Snip_*.txt',
        'Snip_Artwork.jpg'
      ], {
        cwd: this.options.path,
        ignoreInitial: false
      })
      .on('add', this._handleUpdate)
      .on('change', this._handleUpdate)
  }

  stop () {
    this.watcher.close()
  }

  update (track) {
    const playing = Object.keys(track).map((k) => track[k]).some((value) => value)
    this._onUpdate({
      playing,
      track
    })
  }

  _fieldFor (pathField) {
    if (pathField === 'TrackId') return 'id'
    if (pathField === 'Track') return 'title'
    return camelCase(pathField)
  }

  _handleUpdate (path) {
    const matches = fieldRx.exec(path)
    if (!matches) return

    this._updateState(this._fieldFor(matches[1]))
  }

  _updateState (field) {
    const updater = updaters[field]
    if (!updater) {
      console.warn(`Missing updater for field "${field}"`)
      return
    }

    updater(this.options).then((value) => {
      this.state[field] = value
      this.update(this.state)
    }, (error) => {
      console.error(error)
    })
  }
}

module.exports = SnipProvider
