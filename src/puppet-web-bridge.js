/**
*
* Wechaty - Wechat for Bot, and human who talk to bot.
*
* Inject this js code to browser,
* in order to interactive with wechat web program.
*
* Licenst: MIT
* https://github.com/zixia/wechaty-lib
*
*/
const co = require('co')
const retryPromise  = require('retry-promise').default

const log = require('./npmlog-env')

class Bridge {
  constructor(options) {
    if (!options || !options.puppet) { throw new Error('Bridge need a puppet')}
    log.verbose('PuppetwebBridge', 'new Bridge({puppet: %s, port: %s})'
      , options.puppet.constructor.name
      , options.port)

    this.puppet   = options.puppet
    this.port     = options.port || 8788 // W(87) X(88), ascii char code ;-]
  }
  toString() { return `Bridge({puppet: ${this.options.puppet.constructor.name}, port: ${this.options.port}})` }

  init() {
    log.verbose('PuppetwebBridge', 'init()')
    return this.inject()
  }

  logout() {
    log.verbose('PuppetwebBridge', 'quit()')
    return this.proxyWechaty('logout')
    .catch(e => {
      log.error('PuppetwebBridge', 'logout() exception: %s', e.message)
      throw e
    })
  }
  quit()                    {
    log.verbose('PuppetwebBridge', 'quit()')
    return this.proxyWechaty('quit')
    .catch(e => {
      log.error('PuppetwebBridge', 'quit() exception: %s', e.message)
      throw e
    })
  }

  // @Deprecated: use `scan` event instead
  // getLoginStatusCode()      { return this.proxyWechaty('getLoginStatusCode') }
  // @Deprecated: use `scan` event instead
  // getLoginQrImgUrl()        { return this.proxyWechaty('getLoginQrImgUrl') }

  getUserName() {
    return this.proxyWechaty('getUserName')
    .catch(e => {
      log.error('PuppetwebBridge', 'getUserName() exception: %s', e.message)
      throw e
    })
  }

  send(toUserName, content) {
    return this.proxyWechaty('send', toUserName, content)
    .catch(e => {
      log.error('PuppetwebBridge', 'send() exception: %s', e.message)
      throw e
    })
  }

  getContact(id) {
    const max = 30
    const backoff = 100

    // max = (2*totalTime/backoff) ^ (1/2)
    // timeout = 11250 for {max: 15, backoff: 100}
    // timeout = 45000 for {max: 30, backoff: 100}
    const timeout = max * (backoff * max) / 2

    return retryPromise({ max: max, backoff: backoff }, function (attempt) {
      log.silly('PuppetwebBridge', 'getContact() retryPromise: attampt %s/%s time for timeout %s'
        , attempt, max, timeout)

      return this.proxyWechaty('getContact', id)
      .then(r => {
        if (!r) {
          throw ('got empty return')
        }
        return r
      })
      .catch(e => {
        log.error('PuppetwebBridge', 'proxyWechaty(getContact, %s) exception: %s', id, e.message)
        throw e
      })
    }.bind(this))
    .catch(e => {
      log.error('PuppetwebBridge', 'retryPromise() getContact() finally FAIL: %s', e.message)
      throw e
    })
    /////////////////////////////////
  }

  getInjectio() {
    const fs = require('fs')
    const path = require('path')
    return fs.readFileSync(
      path.join(path.dirname(__filename), 'puppet-web-injectio.js')
      , 'utf8'
    )
  }
  inject() {
    log.verbose('PuppetwebBridge', 'inject()')
    return co.call(this, function* () {
      const injectio = this.getInjectio()
      let r = yield this.execute(injectio, this.port)
      log.verbose('PuppetwebBridge', 'inject() injected, got [%s]', r)
      r = yield this.proxyWechaty('init')
      log.verbose('PuppetwebBridge', 'inject() Wechaty.init() return: %s', r)
      return r
    })
    .catch (e => {
      log.error('PuppetwebBridge', 'inject() exception: %s', e.message)
      throw e
    })
  }

  /**
   * Proxy Call to Wechaty in Bridge
   */
  proxyWechaty(wechatyFunc, ...args) {
    const argsEncoded = new Buffer(
      encodeURIComponent(
        JSON.stringify(args)
      )
    ).toString('base64')
    // see: http://blog.sqrtthree.com/2015/08/29/utf8-to-b64/
    const argsDecoded = `JSON.parse(decodeURIComponent(window.atob('${argsEncoded}')))`

    const wechatyScript   = `return (typeof Wechaty !== 'undefined' && Wechaty.${wechatyFunc}.apply(undefined, ${argsDecoded}))`
    log.silly('PuppetwebBridge', 'proxyWechaty(%s, ...args) %s', wechatyFunc, wechatyScript)
    return this.execute(wechatyScript)
    .catch(e => {
      log.error('PuppetwebBridge', 'proxyWechaty() exception: %s', e.message)
      throw e
    })
  }

  execute(script, ...args) {
    return this.puppet.browser.execute(script, ...args)
    .catch(e => {
      log.error('PuppetwebBridge', 'execute() exception: %s', e.message)
      throw e
    })
  }
}

module.exports = Bridge

/**
 *
 * some handy browser javascript snips
 *
ac = Wechaty.glue.contactFactory.getAllContacts();
Object.keys(ac).filter(function(k) { return /李/.test(ac[k].NickName) }).map(function(k) { var c = ac[k]; return {NickName: c.NickName, Alias: c.Alias, Uin: c.Uin, MMInChatRoom: c.MMInChatRoom} })

Object.keys(window._chatContent).filter(function (k) { return window._chatContent[k].length > 0 }).map(function (k) { return window._chatContent[k].map(function (v) {return v.MMDigestTime}) })

.web_wechat_tab_add
.web_wechat_tab_launch-chat
 *
 */
