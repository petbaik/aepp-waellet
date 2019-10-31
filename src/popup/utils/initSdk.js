export default async () => {
    const createSdk = async (network) => {

        const NODE_URL = 'https://sdk-testnet.aepps.com'
        const NODE_INTERNAL_URL = 'https://sdk-testnet.aepps.com'
        const COMPILER_URL = 'https://compiler.aepps.com'


        const [Ae, ChainNode, Transaction, Contract, Aens, Rpc, Swagger] = (await Promise.all([
          import(/* webpackChunkName: "sdk" */ '@aeternity/aepp-sdk/es/ae'),
          import(/* webpackChunkName: "sdk" */ '@aeternity/aepp-sdk/es/chain/node'),
          import(/* webpackChunkName: "sdk" */ '@aeternity/aepp-sdk/es/tx/tx'),
          import(/* webpackChunkName: "sdk" */ '@aeternity/aepp-sdk/es/ae/contract'),
          import(/* webpackChunkName: "sdk" */ '@aeternity/aepp-sdk/es/ae/aens'),
          import(/* webpackChunkName: "sdk" */ '@aeternity/aepp-sdk/es/rpc/server'),
          import(/* webpackChunkName: "sdk" */ '@aeternity/aepp-sdk/es/utils/swagger'),
        ])).map(module => module.default);
    
        class App {
          constructor(host) {
            this.host = host;
          }
    
          async ensureCurrentAccountAccessPure() {
            const accessToAccounts = get(
              store.getters.getApp(this.host), 'permissions.accessToAccounts', [],
            );
            if (accessToAccounts.includes(store.getters['accounts/active'].address)) return;
            const promise = store.dispatch(
              'modals/open',
              { name: 'confirmAccountAccess', appHost: this.host },
            );
            const unsubscribe = store.watch(
              (state, getters) => getters['accounts/active'].address,
              address => accessToAccounts.includes(address) && promise.cancel(),
            );
    
            try {
              await Promise.race([
                promise,
                new Promise((resolve, reject) => promise.finally(() => {
                  if (!promise.isCancelled()) return;
                  if (accessToAccounts.includes(store.getters['accounts/active'].address)) {
                    resolve();
                  } else reject(new Error('Unexpected state'));
                })),
              ]);
            } finally {
              unsubscribe();
            }
    
            const { address: accountAddress } = store.getters['accounts/active'];
            if (!accessToAccounts.includes(accountAddress)) {
              store.commit('toggleAccessToAccount', { appHost: this.host, accountAddress });
            }
          }
    
          ensureCurrentAccountAccess() {
            if (!this.accountAccessPromise) {
              this.accountAccessPromise = this.ensureCurrentAccountAccessPure();
              this.accountAccessPromise.finally(() => {
                delete this.accountAccessPromise;
              });
            }
            return this.accountAccessPromise;
          }
        }
    
        const apps = {};
    
        const methods = {
          async address(...args) {
            console.log("parvo tuka")
            if (args[args.length - 1] instanceof App) {
              await args[args.length - 1].ensureCurrentAccountAccess();
            }
            return store.getters['accounts/active'].address;
          },
          sign: data => store.dispatch('accounts/sign', data),
          signTransaction: txBase64 => store.dispatch('accounts/signTransaction', txBase64),
          readQrCode: ({ title }) => store.dispatch('modals/open', {
            name: 'readQrCode',
            title: title || i18n.t('scan-qr-code'),
          }),
          baseAppVersion: () => process.env.npm_package_version,
          share: options => store.dispatch('share', options),
        };
    
        let sdkActive = false;
        const errorHandler = (error) => {
          if (sdkActive && !isNotFoundError(error)) {
            recreateSdk();
            sdkActive = false;
          }
          throw error;
        };
        const sdk = await Ae.compose(
            ChainNode, Transaction, Contract, Aens, Rpc, {
              init(options, { stamp }) {
                console.log(this)
                const rpcMethods = [
                  ...stamp.compose.deepConfiguration.Ae.methods,
                  ...stamp.compose.deepConfiguration.Contract.methods,
                ];
                this.rpcMethods = {
                  ...rpcMethods
                    .map(m => [m, ({ params, origin }) => {
                      const { host } = new URL(origin);
                      console.log("i tukaaaaaaaaaaaaa")
                      console.log(host)
                      const app = apps[host] || (apps[host] = new App(host));
                      return Promise.resolve(this[m](...params, app));
                    }])
                    .reduce((p, [k, v]) => ({ ...p, [k]: v }), {}),
                  ...this.rpcMethods,
                };
              },
              methods,
              deepConfiguration: { Ae: { methods: ['readQrCode', 'baseAppVersion', 'share'] } },
            },
          )({
            url: NODE_URL,
            internalUrl: NODE_INTERNAL_URL,
            compilerUrl: COMPILER_URL,
            axiosConfig: { errorHandler },
          })
        
        return sdk;
      };

    return await createSdk()
}