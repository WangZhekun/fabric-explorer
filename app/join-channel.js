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
var util = require('util');
var path = require('path');
var fs = require('fs');

var Peer = require('fabric-client/lib/Peer.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var tx_id = null;
var nonce = null;
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('Join-Channel');
//helper.hfc.addConfigFile(path.join(__dirname, 'network-config.json'));
var ORGS = helper.ORGS;
var allEventhubs = []; // TODO: 这个全局缓存可以优化

//
//Attempt to send a request to the orderer with the sendCreateChain method
//
/**
 * 将peers中的peer节点加入到channel中
 * @param {string} channelName channel名称
 * @param {Array<string>} peers peer节点的访问地址
 * @param {string} username 用户名 TODO：该参数没用，用的是组织的admin用户
 * @param {string} org 组织名
 */
var joinChannel = function(channelName, peers, username, org) {
    // on process exit, always disconnect the event hub
    var closeConnections = function(isSuccess) { // 断开allEventhubs中所有事件监听器到peer的连接
        if (isSuccess) {
            logger.debug('\n============ Join Channel is SUCCESS ============\n');
        } else {
            logger.debug('\n!!!!!!!! ERROR: Join Channel FAILED !!!!!!!!\n');
        }
        logger.debug('');
        for (var key in allEventhubs) {
            var eventhub = allEventhubs[key];
            if (eventhub && eventhub.isconnected()) {
                //logger.debug('Disconnecting the event hub');
                eventhub.disconnect();
            }
        }
    };
    //logger.debug('\n============ Join Channel ============\n')
    logger.info(util.format(
        'Calling peers in organization "%s" to join the channel', org));

    var client = helper.getClientForOrg(org); // 获取指定组织的fabric-client实例
    var channel = helper.getChannelForOrg(org); // 获取指定组织的默认channel的实例
    var eventhubs = [];

    return helper.getOrgAdmin(org).then((admin) => { // 获取组织的admin用户
        logger.info(util.format('received member object for admin of the organization "%s": ', org));
        tx_id = client.newTransactionID(); // 创建TransactionID实例
        let request = {
            txId : 	tx_id
        };

        return channel.getGenesisBlock(request); // 获取channel的起始区块
    }).then((genesis_block) => {
        console.info('genesis block: ',genesis_block)
        tx_id = client.newTransactionID(); // 获取交易ID
        var request = {
            targets: helper.newPeers(peers),
            txId: tx_id,
            block: genesis_block
        };

        for (let key in ORGS[org]) { // 遍历fabirc-client的org组织的配置项
            if (ORGS[org].hasOwnProperty(key)) {
                if (key.indexOf('peer') === 0) { // 当前遍历的配置项为peer
                    let eh = client.newEventHub(); // 创建事件监听器
                    eh.setPeerAddr(ORGS[org][key].events); // 设置需要连接到的peer节点的访问地址
                    eh.connect(); // 事件监听器连接到peer节点
                    eventhubs.push(eh); // 局部缓存事件监听器
                    allEventhubs.push(eh); // 全局缓存事件监听器
                }
            }
        }

        var eventPromises = [];
        eventhubs.forEach((eh) => {
            let txPromise = new Promise((resolve, reject) => {
                let handle = setTimeout(reject, parseInt(config.eventWaitTime)); // 达到最大等待时间，Promise实例置rejected状态，这里不需要断开事件监听器到peer节点的连接
                eh.registerBlockEvent((block) => { // 注册整个区块提交的事件处理函数
                    clearTimeout(handle); // 清空计时器
                    // in real-world situations, a peer may have more than one channels so
                    // we must check that this block came from the channel we asked the peer to join
                    if (block.data.data.length === 1) { // 区块的交易数量为1 TODO：问题：是否应该以交易数量为1来区别是否为channel.joinChannel的事件？
                        // Config block must only contain one transaction
                        var channel_header = block.data.data[0].payload.header.channel_header;
                        if (channel_header.channel_id === channelName) { // TODO:问题：如果peer上有多个channel，监听到的这个事件并不是channel.joinChannel的事件，那么直接reject？
                            resolve();
                        }
                        else {
                            reject();
                        }
                    }
                });
            });
            eventPromises.push(txPromise);
        });
        let sendPromise = channel.joinChannel(request); // 发送加入channel提案
        return Promise.all([sendPromise].concat(eventPromises)); // 处理加入channel提案和事件监听的Promise
    }, (err) => {
        logger.error('Failed to enroll user \'' + username + '\' due to error: ' +
        err.stack ? err.stack : err);
        throw new Error('Failed to enroll user \'' + username +
        '\' due to error: ' + err.stack ? err.stack : err);
    }).then((results) => {
        logger.debug(util.format('Join Channel R E S P O N S E : %j', results));
        if (results[0] && results[0][0] && results[0][0].response && results[0][0].response.status == 200) {
            logger.info(util.format(
                'Successfully joined peers in organization %s to the channel \'%s\'',
                org, channelName));
            closeConnections(true); // 断开allEventhubs中所有事件监听器到peer的连接
            let response = {
                success: true,
                message: util.format(
                    'Successfully joined peers in organization %s to the channel \'%s\'',
                    org, channelName)
            };
            return response;
        } else {
            logger.error(' Failed to join channel');
            closeConnections(); // 断开allEventhubs中所有事件监听器到peer的连接
            throw new Error('Failed to join channel');
        }
    }, (err) => {
        logger.error('Failed to join channel due to error: ' + err.stack ? err.stack :
            err);
        closeConnections(); // 断开allEventhubs中所有事件监听器到peer的连接
        throw new Error('Failed to join channel due to error: ' + err.stack ? err.stack :
            err);
    });
};
exports.joinChannel = joinChannel;
