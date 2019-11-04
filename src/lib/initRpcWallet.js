import { DEFAULT_NETWORK, networks } from '../popup/utils/constants'
import { stringifyForStorage, parseFromStorage, extractHostName, getAeppAccountPermission } from '../popup/utils/helper'
import { getAccounts } from '../popup/utils/storage'
import MemoryAccount from '@aeternity/aepp-sdk/es/account/memory'
import { RpcWallet } from '@aeternity/aepp-sdk/es/ae/wallet'
import BrowserRuntimeConnection from '@aeternity/aepp-sdk/es/utils/aepp-wallet-communication/wallet-connection/browser-runtime'

export default async (connection, walletController) => {

    const network = DEFAULT_NETWORK
    const compiler = networks[network].compilerUrl
    const internalUrl = networks[network].internalUrl
    const account = ""
    let activeAccount = ""
    const { subaccounts } = await getAccounts()
    let accounts = []
    let accountKeyPairs = []
    let sdk 

    let seed = {
        seed:stringifyForStorage("3c9ed46b5da9b5686abcbd85870adc66c1706c62d2000857820870b960593a6dcb9734abe47a122a2917462ede5994a0a7eff304cab6aeb66d6c1ad021b6eb6c")
    }
    await walletController.generateWallet(seed)

    connection(async ({ hdwallet, port, type, payload, uuid }) => {
        if(!hdwallet) {
            if(type == "changeAccount") {
                sdk.selectAccount(payload)
                activeAccount = payload
            } else if( type == "addAccount") {
                let account = {
                    publicKey: payload.address
                }
                let newAccount =  MemoryAccount({
                    keypair: parseFromStorage(await walletController.getKeypair({ activeAccount: payload.idx, account }))
                })
                sdk.addAccount(newAccount, { select: true })
                activeAccount = payload.address
            }
        }
    })


    const createWallet = async () => {
        // Init extension stamp from sdk
        accountKeyPairs = await Promise.all(subaccounts.map(async (a, index) => (
            parseFromStorage(await walletController.getKeypair({ activeAccount: index, account: a}))
        )))
        
        let activeIdx = await browser.storage.sync.get('activeAccount') 
        
        
        accounts = accountKeyPairs.map((a) => {
            return MemoryAccount({
                keypair: a
            })
        })

        try {
            sdk  = await RpcWallet({
                url: internalUrl,
                internalUrl: internalUrl,
                compilerUrl: compiler,
                name: 'Waellet',
                accounts,
                // Hook for sdk registration
                async onConnection (aepp, action) {
                    checkAeppPermissions(aepp, action)
                },
                onDisconnect (masg, client) {
                  client.disconnect()
                },
                async onSubscription (aepp, action) {
                    checkAeppPermissions(aepp, action)
                },
                async onSign (aepp, action) {
                    checkAeppPermissions(aepp, action, () => {
                        showConnectionPopup(aepp, action, "sign")
                    })
                }
            })
            
            chrome.runtime.onConnectExternal.addListener(async (port) => {    
                // create Connection
                const connection = await BrowserRuntimeConnection({ connectionInfo: { id: port.sender.frameId }, port })
                // add new aepp to wallet
                sdk.addRpcClient(connection)
            })

            if (activeIdx.hasOwnProperty("activeAccount") && !isNaN(activeIdx.activeAccount)) {
                sdk.selectAccount(accountKeyPairs[activeIdx.activeAccount].publicKey)
                activeAccount = accountKeyPairs[activeIdx.activeAccount].publicKey
            } else {
                sdk.selectAccount(accountKeyPairs[0].publicKey)
                activeAccount = accountKeyPairs[0].publicKey
            }
            
            setInterval(() => sdk.shareWalletInfo(postMessageToContent), 5000)

        } catch(e) {
            console.error(e)
        }
       
        return sdk
    }

    const checkAeppPermissions = async (aepp, action, cb) => {
        let { connection: { port: {  sender: { url } } } } = aepp
        

        let isConnected = await getAeppAccountPermission(extractHostName(url), activeAccount)
        

        if(!isConnected) {
            try {
                let res = await showConnectionPopup(action, aepp)
                if(typeof cb != "undefined") {
                    cb()
                }
            } catch(e) {
                
            }
        } else {
            if (typeof cb == "undefined") {
                action.accept()
            } else {
                cb()
            }
        }
    }

    const showConnectionPopup = (action, aepp, type = "connectConfirm") => {
        const popupWindow = window.open('/popup/popup.html', 'popup', 'width=420,height=680');
        if (!popupWindow) action.deny()
        let { connection: { port: {  sender: { url } } }, info: { icons, name} } = aepp
        let { protocol } = new URL (url)
        return new Promise((resolve, reject) => {
            popupWindow.window.props = { type, resolve, reject, action, host: extractHostName(url), icons, name, protocol };
        });
    }


    const postMessageToContent = (data) => {
        chrome.tabs.query({}, function (tabs) { // TODO think about direct communication with tab
            const message = { method: 'pageMessage', data };
            tabs.forEach(({ id }) => chrome.tabs.sendMessage(id, message)) // Send message to all tabs
        });
    }

    const recreateWallet = async () => {
        await createWallet()
    }

    let created = false
    let lastNetwork
    recreateWallet()
    // let createInterval = setInterval(async () => {
    //     if(walletController.isLoggedIn()) {
    //         if(!created) {
    //             recreateWallet()
    //             clearInterval(createInterval)
    //         }
    //         created = true
    //     }
    // }, 5000)

}