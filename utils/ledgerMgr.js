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
 * 该模块包含账本各元素（组织、channel、peer、section、peer，以及channel和peer的对应关系）的当前名称，和channel列表的查询
 */

var EventEmitter = require('events').EventEmitter; // Node的事件触发器
var ledgerEvent = new EventEmitter(); // 创建事件触发器实例
var config = require('../config.json'); // 配置文件
var sql = require('../db/mysqlservice.js'); // sql服务

var channels = config.channelsList; // config.json中的channel列表
var currchannelpeerma = {};
//var currChannel=channels[0]
var currchannelpeersmap = {};
var currOrg = '';
var currChannel = '';
var currpeer;
var currSection;

/**
 * 修改当前channel名称
 * 触发channgelLedger事件
 * @param {string} channelName channel名称
 */
function changeChannel(channelName) {
    currChannel = channelName;
    ledgerEvent.emit('channgelLedger'); // 触发channgelLedger事件
}

/**
 * 获取当前channel名称
 */
function getCurrChannel() {
    return currChannel
}

/**
 * 从数据库中查询所有channel
 */
async function getChannellist() {
    let rows = await sql.getRowsBySQlNoCondtion('select channelname from channel ')
    return rows;
}

/**
 * 查询当前peer加入的所有channel
 */
async function getChannellist4CurrPeer() {

    let currp = ledgerMgr.getCurrpeer(); // TODO：ledgerMgr未定义
    let peername = currp['name'];
    let rows = await sql.getRowsBySQlNoCondtion(`select channelname from channel where peer_name in ( select peer_name from peer_ref_channel where peer_name = '${peername}' ) `)
    return rows;
}

/**
 * 获取当前组织名称
 */
function getCurrOrg() {
    return currOrg;
}

/**
 * 修改当前组织名称
 * @param {string} orgname 组织名称
 */
function changeCurrOrg(orgname) {

    currOrg = orgname;

}

/**
 * 获取channel名称到peer的映射
 */
var getcurrchannelpeerma = () => {

    return currchannelpeerma;
}

/**
 * 修改channel名称到peer的映射
 * @param {Object} currchannelmap channel名称到peer的映射
 */
var changecurrchannelpeerma = (currchannelmap) => {

    currchannelpeerma = currchannelmap;

}

/**
 * 获取channel名称到以peer名称为key，peer为value的map的映射
 */
var getCurrchannelpeersmap = () => {

    return currchannelpeersmap;
}

/**
 * 修改channel名称到以peer名称为key，peer为value的map的映射
 * @param {Object} currchannelmap channel名称到以peer名称为key，peer为value的map的映射
 */
var changeCurrchannelpeersmap = (currchannelmap) => {

    currchannelpeersmap = currchannelmap;

}

/**
 * 获取当前peer节点的配置信息
 */
var getCurrpeer = () => {

    return currpeer;
}

/**
 * 修改当前peer节点的配置信息
 */
var changeCurrPeer = (peer) => {

    currpeer = peer;
}

/**
 * 修改当前section
 * @param {string} sectionName section名称
 */
function changeSection(sectionName) {
    currSection = sectionName;
}

/**
 * 获取当前section
 */
function currSection() {
    return currSection;
}


exports.changeCurrPeer = changeCurrPeer;
exports.getCurrpeer = getCurrpeer;
exports.changeCurrchannelpeersmap = changeCurrchannelpeersmap;
exports.getCurrchannelpeersmap = getCurrchannelpeersmap;
exports.getcurrchannelpeerma = getcurrchannelpeerma;
exports.changecurrchannelpeerma = changecurrchannelpeerma;

exports.getCurrChannel = getCurrChannel;
exports.changeChannel = changeChannel;
exports.ledgerEvent = ledgerEvent;
exports.getChannellist = getChannellist;

exports.getCurrOrg = getCurrOrg;
exports.changeCurrOrg = changeCurrOrg;

exports.currSection = currSection;
exports.changeSection = changeSection;

exports.getChannellist4CurrPeer = getChannellist4CurrPeer;