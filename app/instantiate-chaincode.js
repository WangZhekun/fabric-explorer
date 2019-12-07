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
var EventHub = require('fabric-client/lib/EventHub.js');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('instantiate-chaincode');
hfc.addConfigFile(path.join(__dirname, 'network-config.json'));
var ORGS = hfc.getConfigSetting('network-config');
var tx_id = null;
var eh = null;

/**
 * 在指定组织的默认channel上实例化chaincode
 * @param {string} channelName channel名称
 * @param {string} chaincodeName chaincode名称
 * @param {string} chaincodeVersion chaincode的版本
 * @param {string} functionName 交易提交成功后执行的chaincode中函数的名称
 * @param {Array<string>} args 交易提交成功后执行的chaincode中函数的参数列表
 * @param {string} username 用户名 TODO: 这个参数并没有用处，channel.sendInstantiateProposal接口需要admin用户
 * @param {string} org 组织名
 */
var instantiateChaincode = function(channelName, chaincodeName, chaincodeVersion, functionName, args, username, org) {
    logger.debug('\n============ Instantiate chaincode on organization ' + org +
        ' ============\n');

    var channel = helper.getChannelForOrg(org); // 获取指定组织的默认channel的实例
    var client = helper.getClientForOrg(org); // 获取指定组织的fabric-client实例

    return helper.getOrgAdmin(org).then((user) => { // 获取组织的admin用户 TODO：问题：这里是否应该先判断username是否为admin用户？
        // read the config block from the orderer for the channel
        // and initialize the verify MSPs based on the participating
        // organizations
        return channel.initialize(); // 初始化channel
    }, (err) => {
        logger.error('Failed to enroll user \'' + username + '\'. ' + err);
        throw new Error('Failed to enroll user \'' + username + '\'. ' + err);
    }).then((success) => {
        tx_id = client.newTransactionID(); // 创建TransactionID实例
        // send proposal to endorser
        var request = {
            chaincodeId: chaincodeName,
            chaincodeVersion: chaincodeVersion,
            fcn: functionName, // TODO: 问题：functionName这个回调函数是在提案被提交后执行，还是交易被提交之后执行？有没有可能存在提案和交易的时间点，回调函数的执行基础不一致？
            args: args,
            txId: tx_id
        };
        return channel.sendInstantiateProposal(request); // 发送chaincode实例化提案
    }, (err) => {
        logger.error('Failed to initialize the channel');
        throw new Error('Failed to initialize the channel');
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
                logger.info('instantiate proposal was good');
            } else {
                logger.error('instantiate proposal was bad');
            }
            all_good = all_good & one_good;
        }
        if (all_good) { // 所有peer节点的应答都成功
            logger.info(util.format(
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
            var deployId = tx_id.getTransactionID(); // 获取交易ID

            eh = client.newEventHub(); // 创建事件监听器
            let data = fs.readFileSync(path.join(__dirname, ORGS[org]['peer1'][ // 读取org组织的peer1节点的证书文件
                'tls_cacerts'
                ]));
            eh.setPeerAddr(ORGS[org]['peer1']['events'], { // 监听peer1节点的事件
                pem: Buffer.from(data).toString(),
                'ssl-target-name-override': ORGS[org]['peer1']['server-hostname']
            });
            eh.connect(); // 连接peer节点

            let txPromise = new Promise((resolve, reject) => {
                let handle = setTimeout(() => { // 30秒后断开事件监听器与peer的连接
                    eh.disconnect();
                    reject();
                }, 30000);

                eh.registerTxEvent(deployId, (tx, code) => { // 注册当指定交易被提交到区块的回调函数
                    logger.info(
                        'The chaincode instantiate transaction has been committed on peer ' +
                        eh._ep._endpoint.addr);
                    clearTimeout(handle); // 清除计时器
                    eh.unregisterTxEvent(deployId); // 注销deployId交易ID的事件监听
                    eh.disconnect(); // 断开事件监听器与peer的连接

                    if (code !== 'VALID') {
                        logger.error('The chaincode instantiate transaction was invalid, code = ' + code);
                        reject();
                    } else {
                        logger.info('The chaincode instantiate transaction was valid.');
                        resolve();
                    }
                });
            });

            var sendPromise = channel.sendTransaction(request); // 发送chaincode实例化的交易
            return Promise.all([sendPromise].concat([txPromise])).then((results) => { // 处理发送交易和事件监听的Promise
                logger.debug('Event promise all complete and testing complete');
                return results[0]; // the first returned value is from the 'sendPromise' which is from the 'sendTransaction()' call
            }).catch((err) => {
                logger.error(
                    util.format('Failed to send instantiate transaction and get notifications within the timeout period. %s', err)
                );
                return 'Failed to send instantiate transaction and get notifications within the timeout period.';
            });
        } else {
            logger.error(
                'Failed to send instantiate Proposal or receive valid response. Response null or status is not 200. exiting...'
            );
            return 'Failed to send instantiate Proposal or receive valid response. Response null or status is not 200. exiting...';
        }
    }, (err) => {
        logger.error('Failed to send instantiate proposal due to error: ' + err.stack ?
            err.stack : err);
        return 'Failed to send instantiate proposal due to error: ' + err.stack ?
            err.stack : err;
    }).then((response) => {
        if (response.status === 'SUCCESS') {
            logger.info('Successfully sent transaction to the orderer.');
            return 'Chaincode Instantiation is SUCCESS';
        } else {
            logger.error('Failed to order the transaction. Error code: ' + response.status);
            return 'Failed to order the transaction. Error code: ' + response.status;
        }
    }, (err) => {
        logger.error('Failed to send instantiate due to error: ' + err.stack ? err
            .stack : err);
        return 'Failed to send instantiate due to error: ' + err.stack ? err.stack :
            err;
    });
};
exports.instantiateChaincode = instantiateChaincode;
