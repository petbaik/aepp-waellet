<template>
    <div id="manageNetworks" class="popup">
        <div class="actions">
            <button class="backbutton toAccount" @click="navigateAccount"><ae-icon name="back" /> {{$t('pages.manageNetworks.backToAccount')}}</button>
        </div>
        <h3>{{$t('pages.manageNetworks.manageNetworks') }}</h3>
        <ae-panel>
            <h4>{{$t('pages.manageNetworks.networks') }}</h4>
            <hr>
            <ae-list >
                <ae-list-item class="editaccount" fill="neutral" v-for="(userNetowrk, index) in userNetworks" v-bind:key="index">
                    <div>
                        <span class="name">{{ userNetowrk.name }}</span>
                        <button @click="removeUserNetworkCheck(userNetowrk.name)"><ae-icon name="close" class="primary" /></button>
                    </div>
                </ae-list-item>
                
            </ae-list>
        </ae-panel>
        <ae-panel>
            <h4 class="addaccount">
                {{$t('pages.manageNetworks.addNewNetwork') }}
                <button class="icon-btn" v-if="!аddNewUserNetwork" @click="AddNewUserNetwork"><ae-icon name="plus" /></button>
                <button class="icon-btn" v-if="аddNewUserNetwork" @click="closeNewUserNetworkForm"><ae-icon name="close" /></button>
            </h4>
            <hr>
            <transition name="slide">
                <ul class="slideform" :class="dropdown ? 'open' : ''">
                    <div class="add-form">
                        <ae-input class="node-name" :label="$t('pages.manageNetworks.networkName')" v-model="newUserNetwork" :placeholder="$t('pages.manageNetworks.addnetworkName')"></ae-input>
                        <ae-input class="node-url" :label="$t('pages.manageNetworks.networkURL')" v-model="newUserNetworkURL" :placeholder="$t('pages.manageNetworks.addnetworkURL')"></ae-input>
                        <ae-input class="node-internalURL" :label="$t('pages.manageNetworks.internalURL')" v-model="newUserNetworkInternalURL" :placeholder="$t('pages.manageNetworks.addinternalURL')"></ae-input>
                        <ae-input class="node-networkId" :label="$t('pages.manageNetworks.networkId')" v-model="newNetworkId" :placeholder="$t('pages.manageNetworks.networkId')"></ae-input>
                        <ae-input class="node-middlewareUrl" :label="$t('pages.manageNetworks.middlewareUrl')" v-model="newUserNetworkMiddlewareURL" :placeholder="$t('pages.manageNetworks.addmiddlewareUrl')"></ae-input>
                        <ae-input class="node-explorerUrl" :label="$t('pages.manageNetworks.explorerUrl')" v-model="newUserNetworkExplorerURL" :placeholder="$t('pages.manageNetworks.addexplorerUrl')"></ae-input>
                        <ae-input class="node-compilerUrl" :label="$t('pages.manageNetworks.compilerUrl')" v-model="networkCompilerURL" :placeholder="$t('pages.manageNetworks.addcompilerUrl')"></ae-input>
                        <ae-button @click="addbtn" face="round" fill="primary" extend>{{ $t('pages.manageNetworks.add') }}</ae-button>
                    </div>
                </ul>
            </transition>
        </ae-panel>
        <popup :popupSecondBtnClick="popup.secondBtnClick"></popup>
    </div>
</template>

<script>
import store from '../../../store';
import { mapGetters } from 'vuex';

export default {
    data () {
        return {
            logo_top: browser.runtime.getURL('../../../icons/icon_48.png'),
            editNetworkName: false,
            аddNewUserNetwork: false,
            dropdown: false,
            newUserNetwork: '',
            newUserNetworkURL: '',
            newUserNetworkInternalURL: '',
            newNetworkId: '',
            newUserNetworkMiddlewareURL: '',
            newUserNetworkExplorerURL: '',
            networkCompilerURL: ''
        }
    },
    computed: {
        ...mapGetters (['current', 'userNetworks', 'wallet', 'popup'])
    },
    created(){

    },
    methods: {
        removeUserNetwork () {
            let networkName = this.popup.data;
            if (networkName != '') {
                let un = this.userNetworks.filter(d => {
                    return d.name != networkName
                });
                this.$store.dispatch('setUserNetworks', un).then(() => {
                    browser.storage.local.set({ userNetworks: un}).then(() => {
                    delete this.$store.state.network[networkName];
                    });
                });
            }
        },
        removeUserNetworkCheck (name) {
            if (this.$store.state.current.network == name) {
                this.$store.dispatch('popupAlert', {
                    name: 'network',
                    type: 'cannot_remove',
                });
            } else {
                this.$store.dispatch('popupAlert', {
                    name: 'network',
                    type: 'confirm_remove',
                    data: name
                });
            }
        },
        AddNewUserNetwork() {
            this.аddNewUserNetwork = true;
            this.dropdown = true;
        },
        closeNewUserNetworkForm() {
            this.dropdown = false;
            this.аddNewUserNetwork = false;
        },
        addbtn() {
            let sameNameNetwork = false,
                networkName = this.newUserNetwork,
                networkURL = this.newUserNetworkURL,
                networkInternalURL = this.newUserNetworkInternalURL,
                networkId = this.newNetworkId,
                networkMiddlewareURL = this.newUserNetworkMiddlewareURL,
                networkExplorerURL = this.newUserNetworkExplorerURL,
                networkCompilerURL = this.networkCompilerURL,
                index =  this.userNetworks.length - 1,
                newNetwork = {
                    name: networkName,
                    url: networkURL,
                    internalUrl: networkInternalURL,
                    networkId: networkId,
                    middlewareUrl: networkMiddlewareURL,
                    explorerUrl: networkExplorerURL,
                    compilerUrl: networkCompilerURL,
                };
            Object.keys(this.$store.state.network).forEach((name) => {
                if (name == networkName) {
                    sameNameNetwork = true;
                    return;
                }
            });
            if (networkName != '' && networkURL != '' 
                && networkInternalURL != '' && networkId != '' 
                    && networkMiddlewareURL != '' && networkExplorerURL != '' 
                        && networkCompilerURL != '' && !sameNameNetwork) {
                this.$store.dispatch('setUserNetwork', newNetwork).then(() => {
                    browser.storage.local.set({ userNetworks: this.userNetworks}).then(() => {
                        this.$store.dispatch('popupAlert', {
                            name: 'account',
                            type: 'added_success'
                        }).then(() => {
                            this.$store.state.network[networkName] = newNetwork;
                            this.resetInputValues();
                            this.$store.dispatch('switchNetwork', networkName).then(() => {
                                this.$store.state.aeAPI = this.fetchApi();
                                this.$store.dispatch('updateBalance');
                                let transactions = this.$store.dispatch('getTransactionsByPublicKey',{publicKey:this.account.publicKey,limit:3});
                                transactions.then(res => {
                                    this.$store.dispatch('updateLatestTransactions',res);
                                });
                            }); 
                            this.setNetworks();
                        });
                    });
                });
            }
            else if (sameNameNetwork) {
                this.$store.dispatch('popupAlert', {
                    name: 'network',
                    type: 'name_exists'
                });
            }
            else {
                this.$store.dispatch('popupAlert', {
                    name: 'account',
                    type: 'requiredField'
                });
            }
        },
        navigateAccount() {
            this.$router.push('/account')
        },
        resetInputValues(){
            this.newUserNetwork = "";
            this.newUserNetworkURL = "";
            this.newUserNetworkInternalURL = "";
            this.newNetworkId = "";
            this.newUserNetworkMiddlewareURL = "";
            this.newUserNetworkExplorerURL = "";
            this.networkCompilerURL = "";
        }
    }
}


</script>

<style lang="scss" scoped>
.ae-list-item { cursor: default !important; }
.ae-list-item .ae-icon, h4 .ae-icon , h4 .icon-btn{ float: right; font-size: 1.2rem; }

#manageAccounts .ae-icon-check { color: #13b100 !important; }
#manageAccounts .ae-icon-close { color: #b10000 !important; }
.editaccount:first-child { border-top: none !important; }
.editaccount div, .addaccount div { width: 100%; }
.editaccount div span, .editaccount div input, .addaccount div span, .editaccount div canvas { float: left; }
.editaccount div button, .addaccount div button { float: right; }
.editaccount div input { width: 60% !important; }

.slideform { position: relative; width: 100%; overflow: hidden; overflow-y: auto; padding: 0; top: 10px; list-style-type: none; height: 0; margin:0;
    transform-origin: top; transition: all .4s ease-in-out; padding: 0 3px;}
.slide-enter, .slide-leave-to{ transform: scaleY(0); }
.add-form { text-align: center; }
.required_fields { color: red; margin: 5px; }
.ae-list-item .ae-icon, h4 .ae-icon { font-size: 1.7rem !important; }
.add-form .ae-input-container { margin-bottom: 1rem; }
.slideform.open { height:240px }
.ae-button { margin-top: 1rem}
</style>