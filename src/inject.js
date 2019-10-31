import { extractHostName, detectBrowser } from './popup/utils/helper';
global.browser = require('webextension-polyfill');

if(typeof navigator.clipboard == 'undefined') {
    redirectToWarning(extractHostName(window.location.href),window.location.href)
} else {
    sendToBackground('phishingCheck',{ hostname:extractHostName(window.location.href), href:window.location.href })    
}
let aepp = browser.runtime.getURL("aepp.js")
fetch(aepp) 
.then(res => res.text())
.then(res => {
    // injectScript(res)
})
// Subscribe from postMessages from page
window.addEventListener("message", ({data}) => {
    let method = "pageMessage";
    if(typeof data.method != "undefined") {
        method = data.method
    }
    if(data.method == "ready") return
    if(!data.hasOwnProperty("resolve")) {
        postMessageToBackground(data).then(res => {
            // console.log(data)
            // console.log(res)
        })
    }

    
    // if(!data.hasOwnProperty("resolve")) {
    //     sendToBackground(method,data).then(res => {
    //         if (method == 'aeppMessage') {
    //             res.resolve = true
    //             res.method = method
    //             window.postMessage(res, "*")
    //         }
    //     })
    // }
}, false)

function postMessageToBackground(data) {
    return new Promise((resolve,reject) => {
        browser.runtime.sendMessage({
            data
        }).then((res) => {
            resolve(res)
        })
    })
}


// Handle message from background and redirect to page
browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    window.postMessage(msg, '*')
    let { data } = msg
    if(data.method == 'phishingCheck') {
        if(data.blocked) {
            redirectToWarning(data.params.hostname,data.params.href,data.extUrl)
        }
    }
})

const redirectToWarning = (hostname,href,extUrl = '') => {
    window.stop()
    let extensionUrl = 'chrome-extension'
    if(detectBrowser() == 'Firefox') {
        extensionUrl = 'moz-extension'
    }
    let redirectUrl = ''
    if(extUrl != '') {
        redirectUrl = `${extUrl}phishing/phishing.html#hostname=${hostname}&href=${href}`
    }else {
        redirectUrl = `${extensionUrl}://${browser.runtime.id}/phishing/phishing.html#hostname=${hostname}&href=${href}`
    }
    window.location.href = redirectUrl
    return
}

const injectScript = (content) => {
    try {
      const container = document.head || document.documentElement
      const scriptTag = document.createElement('script')
      scriptTag.setAttribute('async', false)
      scriptTag.textContent = content
      container.insertBefore(scriptTag, container.children[0])
    } catch (e) {
      console.error('Waellet script injection failed', e)
    }
}

function sendToBackground(method, params) {
    return new Promise((resolve,reject) => {
        browser.runtime.sendMessage({
            jsonrpc: "2.0",
            id: params.id || null,
            method,
            params
        }).then((res) => {
            resolve(res)
        })
    })
}

// Render
function render(data) {
    // @TODO create list with sdks and his transaction with ability to accept/decline signing
}

function clickSign({target, value}) {
    const [sdkId, tx] = target.id.split['-'];
    signResponse({value, sdkId, tx})
}

function signResponse({value, sdkId, tx}) {
    sendToBackground('txSign', {value, sdkId, tx})
}


