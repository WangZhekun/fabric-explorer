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

var bcservice=require('./bcservice.js')
var sql=require('../db/mysqlservice.js')
var co=require('co')
var helper = require('../app/helper.js');
var logger = helper.getLogger('metricservice');

//==========================query counts ==========================
/**
 * 从数据库查询指定channel上的chaincode的数量
 * @param {string} channelName channel名称
 */
function getChaincodeCount(channelName){
    return sql.getRowsBySQlCase(`select count(1) c from chaincodes where channelname='${channelName}' `)
}

/**
 * 从数据库查询指定channel上的交易数量
 * @param {string} channelName channel名称
 */
function getTxCount(channelName){
    return sql.getRowsBySQlCase(`select count(1) c from transaction where channelname='${channelName}'`)
}
 
/**
 * 从数据库查询指定channel上的区块数量
 * @param {string} channelName channel名称
 */
function getBlockCount(channelName){
    return sql.getRowsBySQlCase(`select max(blocknum) c from blocks where channelname='${channelName}'`)
}

/**
 * 获取fabric-client配置项中所有peer节点的数量
 */
function getPeerCount(){
    return bcservice.getallPeers().length // 获取fabric-client配置项中的所有peer节点的请求地址
}

/**
 * 从数据库查询指定channel的chaincode
 * @param {string} channelName channel名称
 */
function* getTxPerChaincodeGenerate(channelName){
    let txArray=[]
    var c = yield sql.getRowsBySQlNoCondtion(`select c.channelname as channelname,c.name as chaincodename,c.version as version,c.path as path ,txcount  as c from chaincodes c where  c.channelname='${channelName}' `);
    c.forEach((item,index)=>{
        txArray.push({'channelName':item.channelname,'chaincodename':item.chaincodename,'path':item.path,'version':item.version,'txCount':item.c})
    })
    return txArray

}

/**
 * 从数据库查询指定channel的chaincode
 * @param {string} channelName channel名称
 * @param {function} cb 回调函数
 */
function getTxPerChaincode(channelName,cb) {
    co(getTxPerChaincodeGenerate,channelName).then(txArray=>{
        cb(txArray)
    }).catch(err=>{
        logger.error(err)
        cb([])
    })
}

/**
 * 获取指定channel的统计信息，包括chaincode数量、交易数量、区块数量、peer节点数量
 * @param {string} channelName channel名称
 */
function* getStatusGenerate(channelName){
    var chaincodeCount=yield  getChaincodeCount(channelName) // 从数据库查询指定channel上的chaincode的数量
    var txCount=yield  getTxCount(channelName) // 从数据库查询指定channel上的交易数量
    var blockCount=yield  getBlockCount(channelName) // 从数据库查询指定channel上的区块数量
    blockCount.c=blockCount.c ? blockCount.c: 0
    var peerCount=  getPeerCount(channelName) // 获取fabric-client配置项中所有peer节点的数量
    return {'chaincodeCount':chaincodeCount.c,'txCount':txCount.c,'latestBlock':blockCount.c,'peerCount':peerCount}
}

/**
 * 获取指定channel的统计信息，包括chaincode数量、交易数量、区块数量、peer节点数量
 * @param {string} channelName channel名称
 * @param {function} cb 回调函数
 */
function getStatus(channelName ,cb){
    co(getStatusGenerate,channelName).then(data=>{
        cb(data)
    }).catch(err=>{
        logger.error(err)
    })
}

/*
getStatus('mychannel',function (data) {
    console.info(data)
})
*/

/*getTxPerChaincode('mychannel',function (data) {
    console.info(data)
})*/

exports.getStatus=getStatus
exports.getTxPerChaincode=getTxPerChaincode
