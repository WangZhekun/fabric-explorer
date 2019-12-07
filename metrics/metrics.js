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
var Stats = require('fast-stats').Stats; // 数据集分析库
var bcconfig = require('../config');
/*
var helper = require('../app/helper.js');
var logger = helper.getLogger('metrics');
*/
var log4js = require('log4js');
var logger = log4js.getLogger('metrics');
logger.setLevel(bcconfig.loglevel);

class Metrics {
    constructor(size=10){
        this.size=size // 数据集最大条数
        this.stats=new Stats() // 创建实例
    }

    push(n){
        while(this.stats.data.length>this.size){
            this.stats.shift()
        }
        this.stats.push(n)
    }

    sum(){
        logger.debug(this.stats.range())
        return this.stats.sum // 将数据集做加和
    }

    clean(){
        this.stats.reset() // 清空数据集
    }
}

var txMetrics=new Metrics(2) // 交易数据统计
var blockMetrics=new Metrics(2) // 区块数据统计
var txnPerSecMeter=new Metrics(2)

exports.Metrics=Metrics
exports.txMetrics=txMetrics
exports.blockMetrics=blockMetrics
exports.txnPerSecMeter=txnPerSecMeter