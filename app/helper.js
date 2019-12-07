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
var log4js = require('log4js');
var logger = log4js.getLogger('Helper');
logger.setLevel('ERROR');

var path = require('path');
var util = require('util');
var fs = require('fs-extra');
var User = require('fabric-client/lib/User.js');
var crypto = require('crypto');
var FabricCAService = require('fabric-ca-client');
var config = require('../config.json');

var hfc = require('fabric-client');
if(config.enableTls){ // 配置fabric-client
	hfc.addConfigFile(path.join(__dirname, 'network-config-tls.json'));
}else{
	hfc.addConfigFile(path.join(__dirname, 'network-config.json'));
}
hfc.setLogger(logger);
var ORGS = hfc.getConfigSetting('network-config'); // 读取fabric-client配置

var clients = {}; // 各组织名称到fabric-client实例的映射
var channels = {}; // 各channel名称到channel实例的映射
var caClients = {}; // 各组织名称到fabric-ca-client实例的映射

// set up the client and channel objects for each org
// 初始化各组织的client实例、channel实例、peer实例、orderer实例、ca实例，并维护相互关系
for (let key in ORGS) { // 遍历fabric-client的配置
    if (key.indexOf('org') === 0) { // 如果配置项为组织
        let client = new hfc(); // 创建fabric-client实例

        let cryptoSuite = hfc.newCryptoSuite(); // 创建密码组件的实例
        cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({path: getKeyStoreForOrg(ORGS[key].name)}));
        client.setCryptoSuite(cryptoSuite); // 设置密码组件
        channels[key] = {};
        for (let index in config.channelsList) { // 遍历config.json中的channelsList
            let channelName = config.channelsList[index];
            let channel = client.newChannel(channelName); // 创建channel实例
            //Add all the orderers
            newOrderer(client, channel) // 将fabric-client的配置中的orderer节点添加到channel中
            clients[key] = client; // 缓存fabric-client实例
            channels[key][channelName] = channel; // 缓存channel实例

            setupPeers(channel, key, client); // 将fabric-client配置中的指定组织的peer节点添加到channel中
        }
        let caUrl = ORGS[key].ca; // 取组织的ca服务器的访问地址
        caClients[key] = new FabricCAService(caUrl, null /*defautl TLS opts*/, '' /* default CA */, cryptoSuite); // 创建fabric-ca-client实例
    }
}

/**
 * 将fabric-client配置中的指定组织的peer节点添加到channel中
 * @param {Object} channel channel实例
 * @param {string} org 组织名
 * @param {Object} client fabric-client实例
 */
function setupPeers(channel, org, client) {
	for (let key in ORGS[org]) { // 遍历fabric-client配置项的指定组织的配置内容
		if (key.indexOf('peer') === 0) { // 如果配置项为peer节点
            let peer
			if(config.enableTls){
                let data = fs.readFileSync(path.join(__dirname,"../", ORGS[org][key]['tls_cacerts'])); // 读取peer节点的证书文件
                peer = client.newPeer( // 创建peer实例
                    ORGS[org][key].requests,
                    {
                        pem: Buffer.from(data).toString(),
                        'ssl-target-name-override': ORGS[org][key]['server-hostname']
                    }
                );
			}else{
				peer = client.newPeer(
					ORGS[org][key].requests
				);
			}

			channel.addPeer(peer); // 将peer实例加入到channel中
		}
	}
}

/**
 * 将fabric-client的配置中的orderer节点添加到channel中
 * @param {Object} client fabric-client实例
 * @param {Object} channel channel实例
 */
function newOrderer(client, channel) {
	for (let index in ORGS['orderer']) { // 遍历fabric-client的配置项的orderer部分
        let newOrderer
		if(config.enableTls){
            let data = fs.readFileSync(path.join(__dirname,"../", ORGS.orderer[index]['tls_cacerts'])); // 读取orderer节点的证书文件
            newOrderer = client.newOrderer( // 创建orderer实例
                ORGS.orderer[index].url,
                {
                    pem: Buffer.from(data).toString(),
                    'ssl-target-name-override': ORGS.orderer[index]['server-hostname']
                }
            );
		}else{
			newOrderer = client.newOrderer(
				ORGS.orderer[index].url
			);
		}
		channel.addOrderer(newOrderer); // 将orderer添加到channel
	}
}

/**
 * 读取指定目录的全部文件
 * @param {PathLike}} dir 目录
 */
function readAllFiles(dir) {
	var files = fs.readdirSync(dir);
	var certs = [];
	files.forEach((file_name) => {
		let file_path = path.join(dir,file_name);
		let data = fs.readFileSync(file_path);
		certs.push(data);
	});
	return certs;
}

/**
 * 获取fabric-client配置项中指定组织的name属性
 * @param {Object} org 组织名称
 */
function getOrgName(org) {
	return ORGS[org].name;
}

/**
 * 获取制定组织的keyValueStore目录
 * @param {string} org 组织名称
 */
function getKeyStoreForOrg(org) {
	return config.keyValueStore + '_' + org;
}

/**
 * 创建指定访问地址的peer实例或EventHub实例
 * @param {Array<string>} urls peer节点访问地址
 * @param {boolean} forPeers 结果是否为peer实例，如果不是，则表示结果为EventHub实例
 * @param {string} userOrg 组织名称
 * @param {string} channelName channel名称，该参数没有用到
 */
function newRemotes(urls, forPeers, userOrg, channelName) {
	var targets = []; // 结果数组
	// find the peer that match the urls
	outer: // TODO:问题：这个语法是什么情况？
	for (let index in urls) { // 遍历urls
		let peerUrl = urls[index];

		let found = false;
		for (let key in ORGS) { // 遍历fabric-client配置
			if (key.indexOf('org') === 0) { // 配置项为组织
				// if looking for event hubs, an app can only connect to
				// event hubs in its own org
				if (!forPeers && key !== userOrg) { // 如果不是获取peer节点，且当前遍历的阻止不是userOrg
					continue;
				}

				let org = ORGS[key]; // 组织配置对象
				let client = getClientForOrg(key); // 获取当前遍历组织的fabric-client实例

				for (let prop in org) { // 遍历组织配置对象
					if (prop.indexOf('peer') === 0) { // 组织的peer配置
						if (org[prop]['requests'].indexOf(peerUrl) >= 0) { // peer的配置项的requests属性包含当前遍历的urls
							// found a peer matching the subject url
							if (forPeers) { // 如果是为了获取peer节点
								if(config.enableTls){
                                    let data = fs.readFileSync(path.join(__dirname,"../", org[prop]['tls_cacerts'])); // 读取peer节点的证书
                                    targets.push(client.newPeer('grpcs://' + peerUrl, { // 创建peer节点，并加入到结果数组中
                                        pem: Buffer.from(data).toString(),
                                        'ssl-target-name-override': org[prop]['server-hostname']
                                    }));
								}else{
									targets.push(client.newPeer('grpc://' + peerUrl));
								}

								continue outer; // 继续遍历urls中的下一个元素
							} else { // 如果不是为了获取peer节点
								let eh = client.newEventHub(); // 创建事件监听器
								if(config.enableTls){
                                    let data = fs.readFileSync(path.join(__dirname,"../", org[prop]['tls_cacerts'])); // 读取peer节点的证书
                                    eh.setPeerAddr(org[prop]['events'], { // 为事件监听器设置peer节点的地址
                                        pem: Buffer.from(data).toString(),
                                        'ssl-target-name-override': org[prop]['server-hostname']
                                    });
								}else{
									eh.setPeerAddr(org[prop]['events']);
								}
								targets.push(eh); // 将事件监听器加入到结果数组中

								continue outer;
							}
						}
					}
				}
			}
		}

		if (!found) { // 如果没有找到当前遍历的urls中的元素
			logger.error(util.format('Failed to find a peer matching the url %s', peerUrl));
		}
	}

	return targets; // 返回结果
}

//-------------------------------------//
// APIs
//-------------------------------------//
/**
 * 获取指定组织的指定channel的实例
 * @param {string} org 组织名称
 * @param {string} channelName channel名称，如果不指定，则取config.json中channelsList的第一个
 */
var getChannelForOrg = function(org, channelName) {
    if (channelName == undefined ) {
        channelName = config.channelsList[0];
    }
    return channels[org][channelName];
};

/**
 * 获取指定组织的fabric-client实例
 * @param {string} org 组织名
 */
var getClientForOrg = function(org) {
	return clients[org];
};

/**
 * 获取制定访问地址的peer节点的实例
 * @param {Array<string>} urls peer节点的访问地址
 * @param {string} channelName channel名称
 */
var newPeers = function(urls,channelName) {
	return newRemotes(urls, true,'',channelName);
};

/**
 * 获取指定组织的指定peer节点访问地址的EventHub实例
 * @param {Array<string>} urls peer节点的访问地址
 * @param {string} org 组织名称
 * @param {string} channelName channel名称
 */
var newEventHubs = function(urls, org,channelName) {
	return newRemotes(urls, false, org,channelName);
};

/**
 * 获取fabric-client的配置中指定组织的mspid
 * @param {string} org 组织名称
 */
var getMspID = function(org) {
	logger.debug('Msp ID : ' + ORGS[org].mspid);
	return ORGS[org].mspid;
};

/**
 * 获取config.json中的users配置项的第一个用户的User实例
 * TODO：没有处理config.json中没有users配置的情况
 * @param {string} userOrg 组织名称
 */
var getAdminUser = function(userOrg) {
	var users = config.users; // 获取config.json中的users配置项 TODO：没有该配置
	var username = users[0].username; // 取users第一个元素的用户名
	var password = users[0].secret; // 取users第一个元素的密码
	var member;
	var client = getClientForOrg(userOrg); // 获取userOrg的fabric-client实例

	return hfc.newDefaultKeyValueStore({ // 创建默认的KeyValueStore实例
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store); // 设置userOrg的fabric-client实例的状态存储实例
		// clearing the user context before switching
		client._userContext = null; // 清除上下文 TODO：问题：为何这里要清空用户上下文，如果user && user.isEnrolled()为true，那么这个属性是否会被重置？
		return client.getUserContext(username, true).then((user) => { // 异步获取指定用户的User实例
			if (user && user.isEnrolled()) { // 该用户已经注册
				logger.info('Successfully loaded member from persistence');
				return user;
			} else { // 该用户没有注册
				let caClient = caClients[userOrg]; // 获取userOrg组织的fabric-ca-client实例
				// need to enroll it with CA server
				return caClient.enroll({ // 在ca服务中注册用户
					enrollmentID: username,
					enrollmentSecret: password
				}).then((enrollment) => {
					logger.info('Successfully enrolled user \'' + username + '\'');
					member = new User(username); // 创建User实例
					member.setCryptoSuite(client.getCryptoSuite()); // 给User实例创建密码组件
					return member.setEnrollment(enrollment.key, enrollment.certificate, getMspID(userOrg)); // 给User实例设置登记实例
				}).then(() => {
					return client.setUserContext(member); // 设置fabric-client实例的用户上下文
				}).then(() => {
					return member;
				}).catch((err) => {
					logger.error('Failed to enroll and persist user. Error: ' + err.stack ?
						err.stack : err);
					return null;
				});
			}
		});
	});
};

/**
 * 获取已注册的指定用户,如果该用户没有注册,则以默认用户登录注册之
 * @param {string} username 用户名
 * @param {string} userOrg 组织名称
 * @param {boolean} isJson 返回结果是否为json,否,则返回User实例
 */
var getRegisteredUsers = function(username, userOrg, isJson) {
	var member;
	var client = getClientForOrg(userOrg); // 获取指定组织的fabric-client实例
	var enrollmentSecret = null;
	return hfc.newDefaultKeyValueStore({ // 创建默认的KeyValueStore实例 TODO:问题：为何每次取User实例时都需要创建KeyValueStore实例?
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store); // 设置userOrg的fabric-client实例的状态存储实例
		// clearing the user context before switching
		client._userContext = null; // 清除上下文
		return client.getUserContext(username, true).then((user) => { // 异步获取指定用户的User实例
			if (user && user.isEnrolled()) { // 该用户已经注册
				logger.info('Successfully loaded member from persistence');
				return user;
			} else { // 该用户没有注册
				let caClient = caClients[userOrg]; // 获取userOrg组织的fabric-ca-client实例
				return getAdminUser(userOrg).then(function(adminUserObj) { // 获取config.json中的users配置项的第一个用户的User实例，即用默认用户登录
					member = adminUserObj;
					return caClient.register({ // 注册新用户，并返回秘钥
						enrollmentID: username,
						affiliation: userOrg + '.department1'
					}, member);
				}).then((secret) => {
					enrollmentSecret = secret;
					logger.debug(username + ' registered successfully');
					return caClient.enroll({ // 登记新用户 TODO：问题：enroll和register的区别？
						enrollmentID: username,
						enrollmentSecret: secret
					});
				}, (err) => {
					logger.debug(username + ' failed to register');
					return '' + err;
					//return 'Failed to register '+username+'. Error: ' + err.stack ? err.stack : err;
				}).then((message) => {
					if (message && typeof message === 'string' && message.includes(
							'Error:')) {
						logger.error(username + ' enrollment failed');
						return message;
					}
					logger.debug(username + ' enrolled successfully');

					member = new User(username); // 创建User实例
					member._enrollmentSecret = enrollmentSecret; // 给User实例创建密码组件 TODO:为什么getAdminUser函数中没有这一步?
					return member.setEnrollment(message.key, message.certificate, getMspID(userOrg)); // 给User实例创建密码组件
				}).then(() => {
					client.setUserContext(member);
					return member;
				}, (err) => {
					logger.error(util.format('%s enroll failed: %s', username, err.stack ? err.stack : err));
					return '' + err;
				});;
			}
		});
	}).then((user) => {
		if (isJson && isJson === true) {
			var response = {
				success: true,
				secret: user._enrollmentSecret,
				message: username + ' enrolled Successfully',
			};
			return response;
		}
		return user;
	}, (err) => {
		logger.error(util.format('Failed to get registered user: %s, error: %s', username, err.stack ? err.stack : err));
		return '' + err;
	});
};

/**
 * 在fabric-client实例中创建并返回组织的admin用户，用户名格式为“'peer'+userOrg+'Admin'”
 * @param {string} userOrg 组织名称
 */
var getOrgAdmin = function(userOrg) {
	var admin = ORGS[userOrg].admin; // 从fabric-client的配置中获取指定组织的管理员配置对象
	var keyPath = path.join(__dirname,"../",admin.key); // 取管理员的key，当前项目中的某个文件
	var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString(); // 读取key文件
	var certPath = path.join(__dirname,"../",admin.cert); // 取管理员的证书，当前项目中的某个文件
	var certPEM = readAllFiles(certPath)[0].toString(); // 读取证书文件

	var client = getClientForOrg(userOrg); // 获取指定组织的fabric-client实例
	var cryptoSuite = hfc.newCryptoSuite(); // 创建密码组件的实例 TODO：在本模块最开始时已经创建密码组件实例，为何这里还需要创建？
	if (userOrg) {
		cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({path: getKeyStoreForOrg(getOrgName(userOrg))}));
		client.setCryptoSuite(cryptoSuite); // 设置密码组件
	}

	return hfc.newDefaultKeyValueStore({ // 创建键值存储实例 TODO:问题：为何每次取User实例时都需要创建KeyValueStore实例?
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store); // 设置键值存储实例

		return client.createUser({ // 创建用户，TODO：问题：为何每次操作都需要创建用户？
			username: 'peer'+userOrg+'Admin',
			mspid: getMspID(userOrg),
			cryptoContent: {
				privateKeyPEM: keyPEM,
				signedCertPEM: certPEM
			}
		});
	});
};

/**
 * 用config.json中的GOPATH配置设置node的环境变量GOPATH
 */
var setupChaincodeDeploy = function() {
	process.env.GOPATH = path.join(__dirname, config.GOPATH);
};

/**
 * 获取Logger实例
 * @param {string}} moduleName 模块名称
 */
var getLogger = function(moduleName) {
	var logger = log4js.getLogger(moduleName);
	logger.setLevel('ERROR');
	return logger;
};

/**
 * 获取fabric-client配置中指定组织的指定peer的访问地址
 * @param {string} org 组织名称
 * @param {string} peer peer名称
 */
var getPeerAddressByName = function(org, peer) {
	var address = ORGS[org][peer].requests; // 获取fabric-client配置中指定组织、指定peer的requests配置项
	if(config.enableTls){
        return address.split('grpcs://')[1];
	}
	return address.split('grpc://')[1];
};

/**
 * 获取fabric-client配置中的组织名列表
 */
var getOrgs=function(){
	let orgList=[]
    for (let key in ORGS) { // 遍历fabric-client配置
        if (key.indexOf('org') === 0) { // 组织
			orgList.push(key)
        }
    }
    return orgList
}

/**
 * 获取fabric-client配置中的指定组织的peer配置
 * @param {string} org 组织名
 */
var getPeersByOrg = function (org) {
    let peerList = []
    for (let key in ORGS[org]) {
        if (key.indexOf('peer') === 0) {
            peerList.push(key);
        }
    }
    return peerList;
};

exports.getChannelForOrg = getChannelForOrg;
exports.getClientForOrg = getClientForOrg;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getMspID = getMspID;
exports.ORGS = ORGS;
exports.newPeers = newPeers;
exports.newEventHubs = newEventHubs;
exports.getPeerAddressByName = getPeerAddressByName;
exports.getRegisteredUsers = getRegisteredUsers;
exports.getOrgAdmin = getOrgAdmin;
exports.getAdminUser=getAdminUser;
exports.getOrgs=getOrgs;
exports.getPeersByOrg=getPeersByOrg;
