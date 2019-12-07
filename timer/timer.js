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

var Metrics=require('../metrics/metrics.js')
var blockListener=require('../listener/blocklistener.js').blockListener();
var blockScanEvent=require('../service/bcexplorerservice.js').blockScanEvent;


var blockPerMinMeter=Metrics.blockMetrics
var txnPerSecMeter=Metrics.txnPerSecMeter
var txnPerMinMeter=Metrics.txMetrics

var stomp=require('../socket/websocketserver.js').stomp()

var statusMertics=require('../service/metricservice.js')
var bcexplorerservice = require('../service/bcexplorerservice');

var ledgerMgr=require('../utils/ledgerMgr.js')

var ledgerEvent=ledgerMgr.ledgerEvent
ledgerEvent.on('channgelLedger',function(){ // 监听channgelLedger事件，清理状态
    blockPerMinMeter.clean()
    txnPerSecMeter.clean()
    txnPerMinMeter.clean()
})

/**
 * 启动计时器，定时向客户端发送统计数据
 */
function start() {

    
    setInterval(function () { // 每500毫秒向Metrics数据集中加入0
        blockPerMinMeter.push(0)
        txnPerSecMeter.push(0)
        txnPerMinMeter.push(0)
    },500)

    /*
    * /topic/metrics/txnPerSec
    * /topic/block/all
    * /topic/transaction/all
    */
    //pushTxnPerMin pushBlockPerMin /topic/metrics/
    setInterval(function () { // 每秒通过websocket向客户端发送时间戳
        stomp.send('/topic/metrics/blockPerMinMeter',{},JSON.stringify({timestamp:new Date().getTime()/1000,value:blockPerMinMeter.sum()}))
        stomp.send('/topic/metrics/txnPerMinMeter',{},JSON.stringify({timestamp:new Date().getTime()/1000,value:txnPerMinMeter.sum()}))
    },1000)

    //push status
    setInterval(function () { // 每秒通过websocket向客户端发送统计数据
        let sectionName=ledgerMgr.currSection(); // 获取当前section
        if (sectionName=='channel'){
            statusMertics.getStatus(ledgerMgr.getCurrChannel(),function (status) { // 获取指定channel的统计信息
                stomp.send('/topic/metrics/status',{},JSON.stringify(status))
            })
        } else if(sectionName=='org'){
            let status=bcexplorerservice.getOrgStatus().then(status=>{ // 获取当前组织的统计信息
                stomp.send('/topic/metrics/status',{},JSON.stringify(status))
            });
        } else if(sectionName=='peer'){
            bcexplorerservice.getPeerStatus().then(status=>{ // 查询当前peer的统计数据
                stomp.send('/topic/metrics/status',{},JSON.stringify(status))
            });
        }
    },1000)

    //push chaincode per tx
 /*   setInterval(function(){
        statusMertics.getTxPerChaincode(ledgerMgr.getCurrChannel(),function(txArray){
            stomp.send('/topic/metrics/txPerChaincode',{},JSON.stringify(txArray))
        })
    },1000)*/

    //同步区块
    // blockScanEvent.emit('syncChaincodes', ledgerMgr.getCurrChannel())
    // blockScanEvent.emit('syncBlock', ledgerMgr.getCurrChannel())
    blockScanEvent.emit('syncBlockNow', 'org1') // 触发syncBlockNow事件，在bcexplorerservice.js中监听该事件，同步当前组织的信息

}


exports.start=start

