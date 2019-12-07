/**
 * Copyright 2017 ONECHAIN All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
var path = require('path');
var fs = require('fs');
var util = require('util');
var hfc = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('Query');

var peerFailures = 0; // 重试次数 TODO：这个需要被优化到局部
/**
 * 查询chaincode，即执行chaincode的指定函数
 * TODO：问题：这里的fcn可以随意指定，为何该函数名称要定义为queryChaincode？
 * @param {string} peer peer名称
 * @param {string} channelName channel名称
 * @param {string} chaincodeName chaincode名称
 * @param {string} fcn 提案发送成功后，执行chaincode的函数名称
 * @param {Array<string>} args 提案发送成功后，执行chaincode的函数参数列表
 * @param {string} username 用户名
 * @param {string} org 组织名
 */
var queryChaincode = function(peer, channelName, chaincodeName, fcn, args, username, org) {
    var channel = helper.getChannelForOrg(org, channelName); // 获取指定组织的指定channel的实例
    var client = helper.getClientForOrg(org, channelName); // 获取指定组织的fabric-client实例

    var target = buildTarget(peer, org); // 获取指定组织的指定peer节点的Peer实例
    //Let Cahnnel use second peer added
    if (peerFailures > 0) {
        let peerToRemove = channel.getPeers()[0]; // 获取channel的第一个peer
        channel.removePeer(peerToRemove); // 从channel删除peerToRemove TODO：问题：这里是为什么？
				channel.addPeer(peerToRemove); // 将peerToRemove加入channel 
				// TODO：问题：这个接口跟joinChannel有什么区别？
				// 答：通过该接口加入到channel实例中的peer实例，是作为sendInstantiateProposal(), sendUpgradeProposal(), sendTransactionProposal等接口调用时的targets
    }

    return helper.getRegisteredUsers(username, org).then((user) => { // 获取已注册的username用户,如果该用户没有注册,则以默认用户登录注册之
        tx_id = client.newTransactionID(); // 创建TransactionID实例
        // send query
        var request = {
            chaincodeId: chaincodeName,
            txId: tx_id,
            fcn: fcn,
            args: args
        };
        return channel.queryByChaincode(request, target); // 发送一个提案，执行chaincode的fcn方法 TODO：问题：这里为何要指定target，而上文处理的是channel.getPeers()[0]？
    }, (err) => {
        logger.info('Failed to get submitter \'' + username + '\'');
        return 'Failed to get submitter \'' + username + '\'. Error: ' + err.stack ? err.stack :
            err;
    }).then((response_payloads) => {
        var isPeerDown = response_payloads[0].toString().indexOf('Connect Failed') > -1 || response_payloads[0].toString().indexOf('REQUEST_TIMEOUT') > -1 // TODO：问题：这里为何只判断第一个结果？
        if (isPeerDown && peerFailures < 3) { // 向peer发送请求失败，且重试次数小于3次
            peerFailures++; // 重试次数加一
            logger.debug(' R E T R Y - ' + peerFailures);
            queryChaincode('peer2', channelName, chaincodeName, fcn, args, username, org); // 向peer2重新发送提案
        } else {
            if (isPeerDown) { // 向peer发送请求失败，且试次数大于等于3次
                return 'After 3 retries, peer couldn\' t recover '
            }
            if (response_payloads) { // 如果存在各peer节点的应答
                peerFailures = 0;
                for (let i = 0; i < response_payloads.length; i++) { // 遍历各peer节点的响应
                    logger.info('Query Response ' + response_payloads[i].toString('utf8'));
                    return response_payloads[i].toString('utf8'); // 实际只返回了response_payloads[0]的结果
                }
            } else {
                logger.error('response_payloads is null');
                return 'response_payloads is null';
            }
        }
    }, (err) => {
        logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
            err);
        return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
    }).catch((err) => {
        logger.error('Failed to end to end test with error:' + err.stack ? err.stack :
            err);
        return 'Failed to end to end test with error:' + err.stack ? err.stack :
            err;
    });
};

/**
 * 在指定peer节点查询指定channel的指定编号的区块
 * @param {string} peer 发送查询请求的peer节点的名称
 * @param {string} channelName channel名称
 * @param {number} blockNumber 区块编号
 * @param {string} username 用户名
 * @param {string} org 组织名
 */
var getBlockByNumber = function(peer,channelName, blockNumber, username, org) {
	var target = buildTarget(peer, org); // 获取指定组织的指定peer节点的Peer实例
	var channel = helper.getChannelForOrg(org,channelName); // 获取指定组织的指定channel的实例

	return helper.getRegisteredUsers(username, org).then((member) => { // 获取已注册的username用户,如果该用户没有注册,则以默认用户登录注册之
		return channel.queryBlock(parseInt(blockNumber), target); // 查询指定编号的区块
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response_payloads) => {
		if (response_payloads) {
			//logger.debug(response_payloads);
			// logger.debug(response_payloads);
			return response_payloads; //response_payloads.data.data[0].buffer;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};

/**
 * 在指定peer节点查询指定channel的指定ID的交易
 * @param {string} peer 发送查询请求的peer节点的名称
 * @param {string} channelName channel名称
 * @param {string} trxnID 交易ID
 * @param {string} username 用户名
 * @param {string} org 组织名
 */
var getTransactionByID = function(peer,channelName, trxnID, username, org) {
	var target = buildTarget(peer, org); // 获取指定组织的指定peer节点的Peer实例
	var channel = helper.getChannelForOrg(org,channelName); // 获取指定组织的指定channel的实例

	return helper.getRegisteredUsers(username, org).then((member) => { // 获取已注册的username用户,如果该用户没有注册,则以默认用户登录注册之
		return channel.queryTransaction(trxnID, target); // 查询指定id的交易
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response_payloads) => {
		if (response_payloads) {
			 logger.debug(response_payloads);
			return response_payloads;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};

/**
 * 在指定peer节点查询指定channel的指定hash的区块
 * @param {string} peer 发送查询请求的peer节点的名称
 * @param {string} hash 区块的hash值
 * @param {string} username 用户名
 * @param {string} org 组织名
 */
var getBlockByHash = function(peer, hash, username, org) {
	var target = buildTarget(peer, org); // 获取指定组织的指定peer节点的Peer实例
	var channel = helper.getChannelForOrg(org); // 获取指定组织的指定channel的实例

	return helper.getRegisteredUsers(username, org).then((member) => { // 获取已注册的username用户,如果该用户没有注册,则以默认用户登录注册之
		return channel.queryBlockByHash(new Buffer(hash,"hex"), target); // 查询指定hash的区块
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response_payloads) => {
		if (response_payloads) {
			// logger.debug(response_payloads);
			return response_payloads;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};

/**
 * 在指定peer节点查询指定channel的信息
 * @param {string} peer 发送查询请求的peer节点的名称
 * @param {string} channelName channel名称
 * @param {string} username 用户名
 * @param {string} org 组织名
 */
var getChainInfo = function(peer,channelName, username, org) {
	var target = buildTarget(peer, org); // 获取指定组织的指定peer节点的Peer实例
	var channel = helper.getChannelForOrg(org,channelName); // 获取指定组织的指定channel的实例

	return helper.getRegisteredUsers(username, org).then((member) => { // 获取已注册的username用户,如果该用户没有注册,则以默认用户登录注册之
		return channel.queryInfo(target); // 查询channel的信息
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((blockchainInfo) => {
		if (blockchainInfo) {
			// FIXME: Save this for testing 'getBlockByHash'  ?
			logger.debug('===========================================');
			logger.debug(blockchainInfo.currentBlockHash);
			logger.debug('===========================================');
			//logger.debug(blockchainInfo);
			return blockchainInfo;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};

/**
 * 查询指定channel的配置区块
 * @param {string} org 组织名
 * @param {string} channelName channel名称
 */
var getChannelConfig=function(org,channelName){
    var channel = helper.getChannelForOrg(org,channelName); // 获取指定组织的指定channel的实例

    return helper.getOrgAdmin(org).then((member) => { // 在fabric-client实例中创建并返回组织的admin用户，用户名格式为“'peer'+userOrg+'Admin'”
        return channel.getChannelConfig() // 查询配置区块
    }).then((response) => {
        return response
    }).catch((err) => {
        logger.error(err)
    });

}

/**
 * 查询指定peer节点上的已安装/已实例化的chaincode
 * @param {string} peer 发送查询请求的peer节点的名称
 * @param {string} channelName channel名称
 * @param {string} type 查询类型，'installed'表示已安装的，否则表示已实例化的
 * @param {string} username 用户名
 * @param {string} org 组织名
 */
var getInstalledChaincodes = function(peer,channelName, type, username, org) {
	var target = buildTarget(peer, org); // 获取指定组织的指定peer节点的Peer实例
	var channel = helper.getChannelForOrg(org,channelName); // 获取指定组织的指定channel的实例
	var client = helper.getClientForOrg(org); // 获取指定组织的fabric-client实例

	return helper.getOrgAdmin(org).then((member) => { // 在fabric-client实例中创建并返回组织的admin用户，用户名格式为“'peer'+userOrg+'Admin'”
		if (type === 'installed') {
			return client.queryInstalledChaincodes(target); // 查询peer节点上已安装的chaincode
		} else {
			return channel.queryInstantiatedChaincodes(target); // 查询channel上已实例化的chaincode
		}
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response) => {
		if (response) {
			if (type === 'installed') {
				logger.debug('<<< Installed Chaincodes >>>');
			} else {
				logger.debug('<<< Instantiated Chaincodes >>>');
			}
			var details = [];
			for (let i = 0; i < response.chaincodes.length; i++) {
				let detail={}
				logger.debug('name: ' + response.chaincodes[i].name + ', version: ' +
					response.chaincodes[i].version + ', path: ' + response.chaincodes[i].path
				);
        detail.name=response.chaincodes[i].name
				detail.version=response.chaincodes[i].version
				detail.path=response.chaincodes[i].path
        details.push(detail);
			}
			return details;
		} else {
			logger.error('response is null');
			return 'response is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};

/**
 * 查询指定peer节点上的所有channel
 * @param {string} peer 发送查询请求的peer节点的名称
 * @param {string} username 用户名
 * @param {string} org 组织名
 */
var getChannels = function(peer, username, org) {
	var target = buildTarget(peer, org); // 获取指定组织的指定peer节点的Peer实例
	var channel = helper.getChannelForOrg(org); // 获取指定组织的指定channel的实例
	var client = helper.getClientForOrg(org); // 获取指定组织的fabric-client实例

	return helper.getRegisteredUsers(username, org).then((member) => { // 获取已注册的username用户,如果该用户没有注册,则以默认用户登录注册之
		//channel.setPrimaryPeer(targets[0]);
		return client.queryChannels(target); // 查询指定peer节点的所有channel
	}, (err) => {
		logger.info('Failed to get submitter "' + username + '"');
		return 'Failed to get submitter "' + username + '". Error: ' + err.stack ?
			err.stack : err;
	}).then((response) => {
		if (response) {
			logger.debug('<<< channels >>>');
			var channelNames = [];
			for (let i = 0; i < response.channels.length; i++) {
				channelNames.push('channel id: ' + response.channels[i].channel_id);
			}
			logger.debug(channelNames);
			return response;
		} else {
			logger.error('response_payloads is null');
			return 'response_payloads is null';
		}
	}, (err) => {
		logger.error('Failed to send query due to error: ' + err.stack ? err.stack :
			err);
		return 'Failed to send query due to error: ' + err.stack ? err.stack : err;
	}).catch((err) => {
		logger.error('Failed to query with error:' + err.stack ? err.stack : err);
		return 'Failed to query with error:' + err.stack ? err.stack : err;
	});
};

/**
 * 在指定peer节点查询指定channel的长度
 * @param {string} peer 发送查询请求的peer节点的名称
 * @param {string} channelName channel名称
 * @param {string} username 用户名
 * @param {string} org 组织名
 */
var getChannelHeight=function(peer,channelName,username,org){
	return getChainInfo(peer,channelName,username,org).then(response=>{ // 在指定peer节点查询指定channel的信息
		if(response){
			logger.debug('<<<<<<<<<< channel height >>>>>>>>>')
			logger.debug(response.height.low)
			return response.height.low.toString() // 返回channel的长度
		}
	})
}

/**
 * 获取指定组织的指定peer节点的Peer实例
 * @param {string} peer peer名称
 * @param {string} org 组织名
 */
function buildTarget(peer, org) {
	var target = null;
	if (typeof peer !== 'undefined') {
		let targets = helper.newPeers([helper.getPeerAddressByName(org, peer)]); // 创建peer节点的实例
		if (targets && targets.length > 0) target = targets[0];
	}

	return target;
}

exports.queryChaincode = queryChaincode;
exports.getBlockByNumber = getBlockByNumber;
exports.getTransactionByID = getTransactionByID;
exports.getBlockByHash = getBlockByHash;
exports.getChainInfo = getChainInfo;
exports.getInstalledChaincodes = getInstalledChaincodes;
exports.getChannels = getChannels;
exports.getChannelHeight=getChannelHeight;
exports.getChannelConfig=getChannelConfig;