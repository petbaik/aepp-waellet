import { phishingCheckUrl, getPhishingUrls, setPhishingUrl } from './popup/utils/phishing-detect';
import { checkAeppConnected, initializeSDK, removeTxFromStorage, detectBrowser, extractHostName, setPermissionForAccount, getAeppAccountPermission } from './popup/utils/helper';
import WalletContorller from './wallet-controller'
import Notification from './notifications';


import MemoryAccount from '@aeternity/aepp-sdk/es/account/memory'
import Wallet from '@aeternity/aepp-sdk/es/ae/wallet'
// import BrowserRuntimeConnection from '@aeternity/aepp-sdk/es/utils/aepp-wallet-communication/wallet-connection/browser-runtime'

import initSdk from './popup/utils/initSdk'



global.browser = require('webextension-polyfill');

// listen for our browerAction to be clicked
chrome.browserAction.onClicked.addListener(function (tab) {
    // for the current tab, inject the "inject.js" file & execute it
	chrome.tabs.executeScript(tab.id, {
        file: 'inject.js'
	}); 
});

setInterval(() => {
    browser.windows.getAll({}).then((wins) => {
        if(wins.length == 0) {
            sessionStorage.removeItem("phishing_urls");
            browser.storage.sync.remove('isLogged')
            browser.storage.sync.remove('activeAccount')
        }
    });
},5000);

chrome.browserAction.setBadgeText({ 'text': 'beta' });
chrome.browserAction.setBadgeBackgroundColor({ color: "#FF004D"});

function getAccount() {
    return new Promise(resolve => {
        chrome.storage.sync.get('userAccount', data => {
            if (data.userAccount && data.userAccount.hasOwnProperty('publicKey')) {
                resolve({ keypair: {
                    publicKey: data.userAccount.publicKey,
                    secretKey: data.userAccount.secretKey
                }})
            }
        })
    });
}

const error = {
    "error": {
        "code": 1,
        "data": {
            "request": {}
        },
        "message": "Transaction verification failed"
    },
    "id": null,
    "jsonrpc": "2.0"
}

browser.runtime.onMessage.addListener( (msg, sender,sendResponse) => {
    // console.log("received message -> ", msg)
    switch(msg.method) {
        case 'phishingCheck':
            let data = {...msg, extUrl: browser.extension.getURL ('./') };
            phishingCheckUrl(msg.params.hostname)
            .then(res => {
                if(typeof res.result !== 'undefined' && res.result == 'blocked') {
                    let whitelist = getPhishingUrls().filter(url => url === msg.params.hostname);
                    if(whitelist.length) {
                        data.blocked = false;
                        return postPhishingData(data);
                    }
                    data.blocked = true;
                    return postPhishingData(data);
                }
                data.blocked = false;
                return postPhishingData(data);
            });
        break;
        case 'setPhishingUrl':
            let urls = getPhishingUrls();
            urls.push(msg.params.hostname);
            setPhishingUrl(urls);
        break;
        case 'aeppMessage':
            switch(msg.params.type) {
                case "txSign":
                    checkAeppConnected(msg.params.hostname).then((check) => {
                        if(check) {
                            openAeppPopup(msg,'txSign')
                            .then(res => {
                                sendResponse(res)
                            })
                        }else {
                            error.error.message = "Aepp not registered. Establish connection first"
                            error.id = msg.id
                            sendResponse(error)
                        }
                    });
                break;
                case 'connectConfirm':
                    checkAeppConnected(msg.params.params.hostname).then((check) => {
                        if(!check) {
                            openAeppPopup(msg,'connectConfirm')
                            .then(res => {
                                sendResponse(res)
                            })
                        } else {
                            error.error.message = "Connection already established"
                            error.id = msg.id
                            sendResponse(error)
                        }
                    })
                break;
                case 'getAddress':
                    browser.storage.sync.get('userAccount').then((user)=> {
                        browser.storage.sync.get('isLogged').then((data) => {
                            if (data.isLogged && data.hasOwnProperty('isLogged')) {
                                browser.storage.sync.get('subaccounts').then((subaccounts) => {
                                    browser.storage.sync.get('activeAccount').then((active) => {
                                        let activeIdx = 0
                                        if(active.hasOwnProperty("activeAccount")) {
                                            activeIdx = active.activeAccount
                                        }
                                        let address = subaccounts.subaccounts[activeIdx].publicKey
                                        sendResponse({id:null, jsonrpc:"2.0",address})
                                    })
                                })
                            }else {
                                sendResponse({id:null, jsonrpc:"2.0",address:""})
                            }
                        })
                    })
                break;
                        
                case 'contractCall':
                    checkAeppConnected(msg.params.hostname).then((check) => {
                        if(check) {
                            openAeppPopup(msg,'contractCall')
                            .then(res => {
                                sendResponse(res)
                            })
                        }else {
                            error.error.message = "Aepp not registered. Establish connection first"
                            error.id = msg.id
                            sendResponse(error)
                        }
                    })
                break;

                case 'signMessage':
                    checkAeppConnected(msg.params.hostname).then((check) => {
                        if(check) {
                            openAeppPopup(msg,'signMessage')
                            .then(res => {
                                sendResponse(res)
                            })
                        }else {
                            error.error.message = "Aepp not registered. Establish connection first"
                            error.id = msg.id
                            sendResponse(error)
                        }
                    })
                break;

                case 'verifyMessage':
                    checkAeppConnected(msg.params.hostname).then((check) => {
                        if(check) {
                            openAeppPopup(msg,'verifyMessage')
                            .then(res => {
                                sendResponse(res)
                            })
                        }else {
                            error.error.message = "Aepp not registered. Establish connection first"
                            error.id = msg.id
                            sendResponse(error)
                        }
                    })
                break;
            }
        break
    }

    return true
})


const connectToPopup = (cb,type, id) => {
    browser.runtime.onConnect.addListener((port) => {
        port.onMessage.addListener((msg,sender) => {
            msg.id = sender.name
            if(id == sender.name) cb(msg)
        });
        port.onDisconnect.addListener(async (event) => {
            let list = await removeTxFromStorage(event.name)
            browser.storage.sync.set({pendingTransaction: { list } }).then(() => {})
            browser.storage.sync.remove('showAeppPopup').then(() => {}); 
            error.id = event.name
            if(event.name == id) {
                if(type == 'txSign') {
                    error.error.message = "Transaction rejected by user"
                    cb(error)
                }else if(type == 'connectConfirm') {
                    error.error.message = "Connection canceled"
                    cb(error)
                }else if(type == 'contractCall') {
                    error.error.message = "Transaction rejected by user"
                    cb(error)
                }else {
                    cb()
                }
            }
        });
   })
}

const openAeppPopup = (msg,type) => {
    return new Promise((resolve,reject) => {
        browser.storage.sync.set({showAeppPopup:{ data: msg.params, type } } ).then( () => {
            browser.windows.create({
                url: browser.runtime.getURL('./popup/popup.html'),
                type: "popup",
                height: 680,
                width:420
            }).then((window) => {
                connectToPopup((res) => {
                    resolve(res)
                }, type, msg.params.id)
            })
        })
    })
}

const checkPendingTx = () => {
    return new Promise((resolve,reject) => {
        browser.storage.sync.get('pendingTransaction').then((tx) => {
            if(tx.hasOwnProperty("pendingTransaction")) {
                resolve(false)
            }else {
                resolve(false)
            }
        })
    })
}

const postPhishingData = (data) => {
    browser.tabs.query({active:true, currentWindow:true}).then((tabs) => { 
        const message = { method: 'phishingCheck', data };
        tabs.forEach(({ id }) => browser.tabs.sendMessage(id, message)) 
    });
}

const postToContent = (data, tabId) => {
    const message = { method: 'aeppMessage', data };
    browser.tabs.sendMessage(tabId, message)
}

const controller = new WalletContorller()

browser.runtime.onConnect.addListener( ( port ) => {
    let extensionUrl = 'chrome-extension'
    if(detectBrowser() == 'Firefox') {
        extensionUrl = 'moz-extension'
    }
    if((port.name == 'popup' && port.sender.id == browser.runtime.id && port.sender.url == `${extensionUrl}://${browser.runtime.id}/popup/popup.html` && detectBrowser() != 'Firefox') || ( detectBrowser() == 'Firefox' && port.name == 'popup' && port.sender.id == browser.runtime.id ) ) {
        port.onMessage.addListener(({ type, payload, uuid}) => {
            controller[type](payload).then((res) => {
                port.postMessage({ uuid, res })
            })
        })  
    }
})  

const notification = new Notification();


/** 
 * AEX-2
 */


const postToContentScript = (msg) => {
    chrome.tabs.query({}, function (tabs) { // TODO think about direct communication with tab
        tabs.forEach(({ id }) => chrome.tabs.sendMessage(id, msg)) // Send message to all tabs
    });
}

const account =  MemoryAccount({
    keypair: {
        secretKey: "0eb8cefe04593f2960ddb7d731321b709cec5ce10625334542e410630f0b02d4d1a124ce191ef08e8d2d8fbf424504013c9b8aaecec6f71785f2ee20ddf3a688",
        publicKey: "ak_2bKhoFWgQ9os4x8CaeDTHZRGzUcSwcXYUrM12gZHKTdyreGRgG"
    }
})

const accounts = [
    account
]


const NODE_URL = 'https://sdk-testnet.aepps.com'
const NODE_INTERNAL_URL = 'https://sdk-testnet.aepps.com'
const COMPILER_URL = 'https://compiler.aepps.com'

const confirmDialog = async (method, params, { id, address }, { url }) => {
    console.log(url)
    url = extractHostName(url)
    console.log(url)
    await setPermissionForAccount(url, address)
    console.log("here")
    // let access = await getAeppAccountPermission(url, address)

    console.log(access)

    return Promise.resolve(false)
    // return Promise.resolve(window.confirm(`User ${session.id} wants to run ${method} ${params}`))
}

const methods = {
    async address(...args) {
        console.log("parvo tuka")
        console.log(args)
    },
    sign: data => store.dispatch('accounts/sign', data),
    signTransaction: txBase64 => store.dispatch('accounts/signTransaction', txBase64),
}

Wallet({
    url: NODE_URL,
    internalUrl: NODE_INTERNAL_URL,
    compilerUrl: COMPILER_URL,
    name: 'ExtensionWallet',
    accounts,
    onTx: confirmDialog,
    onChain: confirmDialog,
    onAccount: confirmDialog,
    onContract: confirmDialog,
    extension: true
}).then(wallet => {
    setInterval(() => {
        postToContentScript({ jsonrpc: '2.0', method: 'ready' })
    }, 5000 )
    
    // console.log(wallet) 
}).catch(err => {
    console.error(err)
}) 

// initSdk().then(res => {
//     postToContentScript({ jsonrpc: '2.0', method: 'ready' })
// })

