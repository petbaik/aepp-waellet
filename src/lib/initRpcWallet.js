import { DEFAULT_NETWORK, networks } from '../popup/utils/constants'
import { stringifyForStorage, parseFromStorage } from '../popup/utils/helper'
import { getAccounts } from '../popup/utils/storage'
import MemoryAccount from '@aeternity/aepp-sdk/es/account/memory'
import { RpcWallet } from '@aeternity/aepp-sdk/es/ae/wallet'
import BrowserRuntimeConnection from '@aeternity/aepp-sdk/es/utils/aepp-wallet-communication/wallet-connection/browser-runtime'

export default async (connection, walletController) => {

    const network = DEFAULT_NETWORK
    const compiler = networks[network].compilerUrl
    const internalUrl = networks[network].internalUrl
    const account = ""
    const { subaccounts } = await getAccounts()
    
    let seed = {
        seed:stringifyForStorage("3c9ed46b5da9b5686abcbd85870adc66c1706c62d2000857820870b960593a6dcb9734abe47a122a2917462ede5994a0a7eff304cab6aeb66d6c1ad021b6eb6c")
    }
    await walletController.generateWallet(seed)

    const accountKeyPairs = await Promise.all(subaccounts.map(async (a, index) => (
        parseFromStorage(await walletController.getKeypair({ activeAccount: index, account: a}))
    )))

    const accounts = accountKeyPairs.map((a) => {
        return MemoryAccount({
            keypair: a
        })
    })

    let sdk 

    connection(({ hdwallet, port, type, payload, uuid }) => {
        if(!hdwallet) {
            if(type == "changeAccount") {
                console.log("here 123")
                sdk.selectAccount(payload)
            }
        }
    })

    

    const createWallet = async () => {
        // Init extension stamp from sdk
        
        try {
            console.log("here 1")
            sdk  = await RpcWallet({
                url: internalUrl,
                internalUrl: internalUrl,
                compilerUrl: compiler,
                name: 'Waellet',
                accounts,
                // Hook for sdk registration
                onConnection (aepp, action) {
                    console.log(aepp)
                    browser.storage.sync.set({showAeppPopup:{ data: {}, type: "connectConfirm" } } ).then( () => {
                        // browser.windows.create({
                        //     url: browser.runtime.getURL('./popup/popup.html'),
                        //     type: "popup",
                        //     height: 680,
                        //     width:420
                        // }).then((window) => {
                        //     console.log(window)
                        // })
                        action.accept()
                        window.open('/popup/popup.html', 'popup', 'width=420,height=680');
                    })
                    // if (confirm(`Client ${aepp.info.name} with id ${aepp.id} want to connect`)) {
                    //     action.accept()
                    // }
                },
                onDisconnect (masg, client) {
                  client.disconnect()
                },
                onSubscription (aepp, action) {
                    if (confirm(`Aepp ${aepp.info.name} with id ${aepp.id} want to subscribe for accounts`)) {
                        action.accept()
                    } else { action.deny() }
                },
                onSign (aepp, action) {
                    console.log(action)
                    if (confirm(`Aepp ${aepp.info.name} with id ${aepp.id} want to sign tx ${action.params.tx}`)) {
                        action.accept()
                    } else { action.deny() }
                }
            })
            chrome.runtime.onConnectExternal.addListener(async (port) => {    
                // create Connection
                const connection = await BrowserRuntimeConnection({ connectionInfo: { id: port.sender.frameId }, port })
                // add new aepp to wallet
                sdk.addRpcClient(connection)
            })
            // Share wallet info with extensionId to the page
            // Send wallet connection info to Aepp throug content script
            setInterval(() => sdk.shareWalletInfo(postMessageToContent), 5000)
        } catch(e) {
            console.error(err)
        }
       
        return sdk
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

    recreateWallet()


    
    
}