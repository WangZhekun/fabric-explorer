/*
 Copyright ONECHAIN 2017 All Rights Reserved.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 * 该模块为查询模块，查询fabric-client的配置、查询config.json的配置、查询fabric的信息
 */

var helper=require('../app/helper.js')
var path=require('path')


var hfc = require('fabric-client');
var config = require('../config.json');
if(config.enableTls){ // 给fabric-client添加配置
    hfc.addConfigFile(path.join(__dirname, '/app/network-config-tls.json')); // TODO：问题这里的配置是否为整个fabric网络的配置？
}else{
    hfc.addConfigFile(path.join(__dirname, '/app/network-config.json'));
}


var ORGS = hfc.getConfigSetting('network-config'); // 获取fabric-client的配置

var query=require('../app/query.js')
var logger = helper.getLogger('bcservice');

// var bcserver = require('./bcservice');



/**
 * 获取fabric-client配置项中的所有组织
 */
function getAllOrgs(){
    var OrgArray=[]
    for (let key in ORGS) { // 遍历配置
        if (key.indexOf('org') === 0) { // 获取以org开头的key，即为组织的配置 TODO：这种取法有问题
            let orgName = ORGS[key].name; // 组织名称
            OrgArray.push(orgName)
        }
    }
    return OrgArray

}


/**
 * 获取fabric-client配置项中的所有peer节点的名称
 */
function getAllPeerRequest() {

    var peerArray = []

    for (let key in ORGS) {
        if (key.indexOf('org') === 0) {
            let orgproperty = ORGS[key]
            for ( let orgkey in orgproperty){
                if(  orgkey.indexOf('peer') === 0 ){
                    var peerbean = {'name':orgkey,'org':key}
                    peerArray.push(peerbean)
                }
            }
        }
    }

    return peerArray;


}

/**
 * 获取fabric-client配置项中的所有账本
 */
function getAllChannels(){


}

/**
 * 获取fabric-client配置项中的所有peer节点的请求地址
 */
function getallPeers () {

    var peerArray=[]
    for (let key in ORGS) {
        if (key.indexOf('org') === 0) {
            let orgproperty = ORGS[key];
            for ( let orgkey in orgproperty){
                if(  orgkey.indexOf('peer') === 0 ){
                    let peerName = ORGS[key][orgkey].requests;
                    peerArray.push(peerName);
                }
            }
        }
    }
    return peerArray

}

/**
 * 获取config.json中的channel列表
 */
function getAllChannels(){
    return config.channelsList

}

/**
 * 获取fabric中指定channel的信息，包括channel长度、peer节点等
 * @param {string} channelname channel名称
 */
function getChainInfo( channelname ){
    return query.getChainInfo('peer1',channelname,'admin','org1')
}

/**
 * 获取fabric中指定channel的指定编号的区块的信息
 * @param {string} channelname channel名称
 * @param {number} blockNum 区块编号
 */
function getBlock4Channel( channelName,blockNum ){
    return query.getBlockByNumber('peer1',blockNum ,'admin','org1')

}

/**
 * 获取channel中的交易
 * @param chainid
 */
/**
 * 获取fabric中指定channel的指定交易编号的交易信息
 * @param {string} channelName channel名称
 * @param {string} trxnID 交易ID
 */
function getTans4Chain( channelName,trxnID ) {
    return query.getTransactionByID('peer1',channelName, trxnID, 'admin', 'org1')

}


/**
 * 获取fabric中指定channel上已实例化的chaincode
 * @param {string} channelName channel名称
 */
function getChainCode4Channel(channelName) {
    return query.getInstalledChaincodes('peer1',channelName, '', 'admin', 'org1')

}

/**
 * 获取fabric中mychannel channel上指定范围内的区块
 * @param {number} from 区块编号
 * @param {number} to 区块编号
 */
function getBlockRange(from,to){

    var parms = [];
    for(var ind = from ; ind < to ; ind++){
        parms.push(query.getBlockByNumber('peer1','mychannel',ind,'admin','org1'));
    }

    return Promise.all(parms).then(datas=>{
        var block_array=[]
        datas.forEach((k,v) =>{
            var block_obj={}
            var num = k.header.number.toString();
            block_obj.num=num
            var previous_hash=k.header.previous_hash
            block_obj.previous_hash=previous_hash
            var data_hash=k.header.data_hash
            block_obj.data_hash=data_hash
            block_obj.tx=[]
            k.data.data.forEach(t=>{
                block_obj.tx.push(t.payload.header.channel_header.tx_id)
            })
            block_array.push(block_obj)
        })
        return Promise.resolve(block_array)
    }).catch(err=>{
        logger.error(err)
    })
}

/**
 * 获取fabric中指定channel的指定多个指定交易ID的交易信息
 * @param {string} channelName channel名称
 * @param {Array<string>} tx_array 交易ID数组
 */
function getTx(channelName,tx_array){
    let params=[]
    tx_array.forEach(tx=>{
        params.push(getTans4Chain(channelName,tx))
    })
    return Promise.all(params).then(datas=>{
        return Promise.resolve(datas)
    }).catch(err=>{
        logger.error(err)
    })
}


module.exports.getAllOrgs=getAllOrgs
module.exports.getAllPeerRequest = getAllPeerRequest
module.exports.getAllChannels=getAllChannels
module.exports.getallPeers=getallPeers
module.exports.getTans4Chain=getTans4Chain
module.exports.getChainCode4Channel=getChainCode4Channel
module.exports.getChainInfo=getChainInfo
module.exports.getBlock4Channel=getBlock4Channel
module.exports.getBlockRange=getBlockRange
module.exports.getTx=getTx

