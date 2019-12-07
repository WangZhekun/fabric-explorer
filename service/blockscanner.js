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
 * 该文件的使用部分被注释
 */

var sql=require('../db/mysqlservice.js')
var query=require('../app/query.js')
var helper=require('../app/helper.js')
var co=require('co')
var stomp=require('../socket/websocketserver.js').stomp()
var logger = helper.getLogger('blockscanner');
var EventEmitter = require('events').EventEmitter;
var blockScanEvent = new EventEmitter(); // 创建node事件触发器实例

var blockListener=require('../listener/blocklistener.js').blockListener();


blockScanEvent.on('syncBlock',function (channelName) { // 监听syncBlock事件
    setTimeout(function () {
        syncBlock(channelName)
    },1000)
})

blockScanEvent.on('syncChaincodes',function (channelName) { // 监听syncChaincodes事件
    setTimeout(function () {
        syncChaincodes(channelName)
    },1000)
})


/**
 * 同步指定channel在fabric和数据库中的数据（区块）
 * @param {string} channelName channel名称
 */
function  syncBlock(channelName) {
    let maxBlockNum
    let curBlockNum
    Promise.all([
        getMaxBlockNum(channelName), // 从fabric查询指定channel的长度
        getCurBlockNum(channelName) // 从数据库查询指定cahnnel的最高的区块的索引
    ]).then(datas=>{
        maxBlockNum=parseInt(datas[0]) // channel的长度
        curBlockNum=parseInt(datas[1])+1 // 最高的区块的索引 + 1 = 区块的数量
        co(saveBlockRange,channelName,curBlockNum,maxBlockNum).then(()=>{ // 从fabric同步从curBlockNum到maxBlockNum-1的区块信息到数据库
            blockScanEvent.emit('syncBlock', channelName) // 触发syncBlock事件，循环执行同步过程
        }).catch(err=>{
            logger.error(err)
        })
    }).catch(err=>{
        logger.error(err)
    })


}

/**
 * 从fabric同步从start到end-1的区块信息到数据库
 * @param {string} channelName channel名称
 * @param {number} start 待同步区块起始位置
 * @param {number} end 待同步区块结束位置的下一个位置
 */
function* saveBlockRange(channelName,start,end){
    while(start<end){ // 从fabric同步从start到end-1的区块信息到数据库
        let block=yield query.getBlockByNumber('peer1',channelName,start,'admin','org1') // 在peer1节点查询指定channel的start编号的区块的信息
        blockListener.emit('createBlock',block) // 触发createBlock事件
        yield sql.saveRow('blocks', // 将查询到的区块信息保存到数据库
            {
                'blocknum':start,
                'channelname':channelName,
                'prehash':block.header.previous_hash,
                'datahash':block.header.data_hash,
                'txcount':block.data.data.length
            })
        //push last block
        stomp.send('/topic/block/all',{},start) // 通过websocket向客户端发送新同步的区块编号
        start++

        //////////tx/////////////////////////
        let txLen=block.data.data.length
        for(let i=0;i<txLen;i++){ // 遍历新同步的区块的交易
            let tx=block.data.data[i]
            let chaincode
            try{
                chaincode=tx.payload.data.actions[0].payload.action.proposal_response_payload.extension.results.ns_rwset[1].namespace // 获取新同步区块的chaincode
            }catch(err) {
                chaincode=""
            }
            yield sql.saveRow('transaction', // 保存交易
                {
                    'channelname':channelName,
                    'blockid':block.header.number.toString(),
                    'txhash':tx.payload.header.channel_header.tx_id,
                    'createdt':new Date(tx.payload.header.channel_header.timestamp),
                    'chaincodename':chaincode
                })
            yield sql.updateBySql(`update chaincodes set txcount =txcount+1 where name = '${chaincode}' and channelname='${channelName}' `) // 更新chaincode中的交易数量
        }

    }
    // stomp.send('/topic/metrics/txnPerSec',{},JSON.stringify({timestamp:new Date().getTime()/1000,value:0}))
    blockListener.emit('txIdle') // 触发txIdle事件，通过websocket向客户端发送时间戳
}

/**
 * 从fabric查询指定channel的长度
 * @param {string} channelName channel名称
 */
function getMaxBlockNum(channelName){
    return query.getChannelHeight('peer1',channelName,'admin','org1').then(data=>{ // 在peer1节点查询指定cahnnel的链的长度
        return data
    }).catch(err=>{
        logger.error(err)
    })
}

/**
 * 从数据库查询指定cahnnel的最高的区块的索引
 * @param {string} channelName channel名称
 */
function getCurBlockNum(channelName){
    let curBlockNum
    return sql.getRowsBySQlCase(`select max(blocknum) as blocknum from blocks  where channelname='${channelName}'`).then(row=>{
        if(row.blocknum==null){
            curBlockNum=-1
        }else{
            curBlockNum=parseInt(row.blocknum)
        }

    }).then(()=>{
        return curBlockNum
    }).catch(err=>{
        logger.error(err)
    })
}

// syncBlock('mychannel')

// ====================chaincodes=====================================
/**
 * 从fabric同步指定channel已安装的chaincode到数据库
 * @param {string} channelName channel名称
 */
function* saveChaincodes(channelName){
    let chaincodes=yield query.getInstalledChaincodes('peer1',channelName,'installed','admin','org1') // 从peer1查询，指定channel安装的chaincode
    let len=chaincodes.length
    if(typeof chaincodes ==='string'){
        logger.debug(chaincodes)
        return
    }
    for(let i=0;i<len;i++){ // 遍历chaincode列表
        let chaincode=chaincodes[i]
        chaincode.channelname=channelName
        // 从数据库中获取指定chaincode的数量
        let c= yield sql.getRowByPkOne(`select count(1) as c from chaincodes where name='${chaincode.name}' and version='${chaincode.version}' and path='${chaincode.path}' and channelname='${channelName}' `)
        if(c.c==0){ // 如果数据库中不存在该chaincode
            yield sql.saveRow('chaincodes',chaincode) // 保存chaincode到数据库
        }
    }

}

/**
 * 从fabric同步指定channel已安装的chaincode到数据库
 * @param {string} channelName channel名称
 */
function syncChaincodes(channelName){
    co(saveChaincodes,channelName).then(()=>{
        blockScanEvent.emit('syncChaincodes', channelName) // 触发syncChaincodes事件，循环执行同步过程
    }).catch(err=>{
        logger.error(err)
    })
}

// syncChaincodes('mychannel')

exports.syncBlock=syncBlock
exports.syncChaincodes=syncChaincodes
exports.blockScanEvent=blockScanEvent;

/*
exports.setBlockListener=function(blisten){
    blockListener=blisten
}*/
