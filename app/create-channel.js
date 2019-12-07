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
var fs = require('fs');
var path = require('path');
var config = require('../config.json');
var helper = require('./helper.js');
var logger = helper.getLogger('Create-Channel');
//Attempt to send a request to the orderer with the sendCreateChain method
/**
 * 新建channel
 * @param {string} channelName channel名称
 * @param {string} channelConfigPath channel配置文件的路径，该路径是当前项目中的某文件的路径，该配置文件由configtxgen工具生成
 * @param {string} username 用户名
 * @param {string} orgName 组织名
 */
var createChannel = function(channelName, channelConfigPath, username, orgName) {
	logger.debug('\n====== Creating Channel \'' + channelName + '\' ======\n');
	var client = helper.getClientForOrg(orgName); // 取指定组织的fabric-client实例
	var channel = helper.getChannelForOrg(orgName); // 获取指定组织的默认channel的channel实例

	// read in the envelope for the channel config raw bytes
	var envelope = fs.readFileSync(path.join(__dirname, channelConfigPath)); // 读取channel的配置文件
	console.info(envelope.toString())
	// extract the channel config bytes from the envelope to be signed
	var channelConfig = client.extractChannelConfig(envelope); // 从envelope中提取ConfigUpdate实例

	//Acting as a client in the given organization provided with "orgName" param
	return helper.getOrgAdmin(orgName).then((admin) => { // 创建orgName的用户
		logger.debug(util.format('Successfully acquired admin user for the organization "%s"', orgName));
		// sign the channel config bytes as "endorsement", this is required by
		// the orderer's channel creation policy
		let signature = client.signChannelConfig(channelConfig); // 对ConfigUpdate实例签名

		let request = {
			config: channelConfig,
			signatures: [signature],
			name: channelName,
			orderer: channel.getOrderers()[0],
			txId: client.newTransactionID()
		};

		// send to orderer
		return client.createChannel(request); // 访问orderer节点，创建channel
	}, (err) => {
		logger.error('Failed to enroll user \''+username+'\'. Error: ' + err);
		throw new Error('Failed to enroll user \''+username+'\'' + err);
	}).then((response) => {
		logger.debug(' response ::%j', response);
		if (response && response.status === 'SUCCESS') {
			logger.debug('Successfully created the channel.');
			let response = {
				success: true,
				message: 'Channel \'' + channelName + '\' created Successfully'
			};
		  return response;
		} else {
			logger.error('\n!!!!!!!!! Failed to create the channel \'' + channelName +
				'\' !!!!!!!!!\n\n');
			throw new Error('Failed to create the channel \'' + channelName + '\'');
		}
	}, (err) => {
		logger.error('Failed to initialize the channel: ' + err.stack ? err.stack :
			err);
		throw new Error('Failed to initialize the channel: ' + err.stack ? err.stack : err);
	});
};

exports.createChannel = createChannel;
