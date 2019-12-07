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
'use strict';
var path = require('path');
var fs = require('fs');
var util = require('util');
var hfc = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('invoke-chaincode');
var EventHub = require('fabric-client/lib/EventHub.js');
hfc.addConfigFile(path.join(__dirname, 'network-config.json'));
var ORGS = hfc.getConfigSetting('network-config');

/**
 * 在指定组织的指定channel上执行chaincode
 * @param {Array<string>} peersUrls 各peer节点的访问地址
 * @param {string} channelName channel名称
 * @param {string} chaincodeName chaincode名称
 * @param {string} fcn 交易提交成功后执行的chaincode中函数的名称
 * @param {Array<string>} args 交易提交成功后执行的chaincode中函数的参数列表
 * @param {string} username 用户名
 * @param {string} org 组织名
 */
var invokeChaincode = function(peersUrls, channelName, chaincodeName, fcn, args, username, org) {
    logger.debug(util.format('\n============ invoke transaction on organization %s ============\n', org));
    var client = helper.getClientForOrg(org); // 获取指定组织的fabric-client实例
    var channel = helper.getChannelForOrg(org, channelName); // 获取指定组织的指定channel的实例
    var targets = helper.newPeers(peersUrls); // 获取指定peer访问地址的peer实例
    var tx_id = null;

    return helper.getRegisteredUsers(username, org).then((user) => { // 取已注册的指定用户username,如果该用户没有注册,则以默认用户登录注册之
        tx_id = client.newTransactionID(); // 创建TransactionID实例
        logger.debug(util.format('Sending transaction "%j"', tx_id));
        // send proposal to endorser
        var request = {
            targets: targets,
            chaincodeId: chaincodeName,
            fcn: fcn,
            args: args,
            chainId: channelName,
            txId: tx_id
        };
        return channel.sendTransactionProposal(request); // 发送交易提案
    }, (err) => {
        logger.error('Failed to enroll user \'' + username + '\'. ' + err);
        throw new Error('Failed to enroll user \'' + username + '\'. ' + err);
    }).then((results) => {
        var proposalResponses = results[0];
        var proposal = results[1];
        var header = results[2];
        var all_good = true;
        for (var i in proposalResponses) { // 遍历各peer节点的应答
            let one_good = false;
            if (proposalResponses && proposalResponses[0].response && // 这里只判断了proposalResponses的第一个元素 TODO：有问题
                proposalResponses[0].response.status === 200) {
                one_good = true;
                logger.info('transaction proposal was good');
            } else {
                logger.error('transaction proposal was bad');
            }
            all_good = all_good & one_good;
        }
        if (all_good) { // 所有peer节点的应答都成功
            logger.debug(util.format(
                'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
                proposalResponses[0].response.status, proposalResponses[0].response.message,
                proposalResponses[0].response.payload, proposalResponses[0].endorsement
                    .signature));
            var request = {
                proposalResponses: proposalResponses,
                proposal: proposal,
                header: header
            };
            // set the transaction listener and set a timeout of 30sec
            // if the transaction did not get committed within the timeout period,
            // fail the test
            var transactionID = tx_id.getTransactionID(); // 获取交易ID
            var sendPromise = channel.sendTransaction(request); // 发送交易

            var eventPromises = [];

            var eventhubs = helper.newEventHubs(peersUrls, org); // 创建多个peer节点的事件监听器
            for (let key in eventhubs) { // 遍历事件监听器实例
                let eh = eventhubs[key];
                eh.connect(); // 事件监听器连接到peer节点

                let txPromise = new Promise((resolve, reject) => {
                    let handle = setTimeout(() => { // 30秒后断开事件监听器与peer节点的连接
                        eh.disconnect();
                        reject();
                    }, 30000);

                    eh.registerTxEvent(transactionID, (tx, code) => { // 注册当指定交易被提交到区块的回调函数
                        clearTimeout(handle); // 清除计时器
                        eh.unregisterTxEvent(transactionID); // 注销deployId交易ID的事件监听
                        eh.disconnect(); // 断开事件监听器与peer节点的连接

                        if (code !== 'VALID') {
                            logger.error(
                                'The balance transfer transaction was invalid, code = ' + code);
                            reject();
                        } else {
                            logger.info(
                                'The balance transfer transaction has been committed on peer ' +
                                eh._ep._endpoint.addr);
                            resolve();
                        }
                    });
                });
                eventPromises.push(txPromise);
            };

            return Promise.all([sendPromise].concat(eventPromises)).then((results) => { // 处理发送交易和事件监听的Promise
                logger.debug(' event promise all complete and testing complete');
                return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
            }).catch((err) => {
                logger.error(
                    'Failed to send transaction and get notifications within the timeout period.'
                );
                return 'Failed to send transaction and get notifications within the timeout period.';
            });
        } else {
            logger.error(
                'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...'
            );
            return 'Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...';
        }
    }, (err) => {
        logger.error('Failed to send proposal due to error: ' + err.stack ? err.stack :
            err);
        return 'Failed to send proposal due to error: ' + err.stack ? err.stack :
            err;
    }).then((response) => {
        if (response.status === 'SUCCESS') {
            logger.info('Successfully sent transaction to the orderer.');
            return tx_id.getTransactionID();
        } else {
            logger.error('Failed to order the transaction. Error code: ' + response.status);
            return 'Failed to order the transaction. Error code: ' + response.status;
        }
    }, (err) => {
        logger.error('Failed to send transaction due to error: ' + err.stack ? err
            .stack : err);
        return 'Failed to send transaction due to error: ' + err.stack ? err.stack :
            err;
    });
};

exports.invokeChaincode = invokeChaincode;