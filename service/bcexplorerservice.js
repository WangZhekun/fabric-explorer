/*
 Copyright ONECHAIN 2018-2020 All Rights Reserved.

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

var bcconfig = require('../config.json'); // config.json中的配置项
var fabricservice = require('./fabricservice'); // fabric服务模块
var sql = require('../db/mysqlservice.js') // sql服务模块
var EventEmitter = require('events').EventEmitter; // node事件模块
var blockScanEvent = new EventEmitter(); // 创建node事件触发器实例
var blockListener = require('../listener/blocklistener.js').blockListener(); // 获取node事件触发器的blockListener实例
var ledgerMgr = require('../utils/ledgerMgr'); // 账本管理模块

var orgnamemap = initConfig(0); // 以组织的名称（name属性）为key，组织对象（config.json中组织的配置对象）为value
var orgmspidmap = initConfig(1); // 以组织的mspid为key，组织对象（config.json中组织的配置对象）为value
var orderers = bcconfig['orderer']; // config.json中的orderer配置
var other_org = {}; // 其他组织，推测是以组织名称为属性的对象，属性值为字符串标记 TODO：没有调用过该变量的set方法




/**
 * 获取config.json中的组织map，并初始化账本管理模块的当前组织名称
 * @param {number} types 0表示以组织名称为key，1表示以组织的mspid为key
 */
function initConfig(types) {

    let orgs = bcconfig['orgs']; // 获取config.json中的组织数组
    var orgnamemap = {};
    var peers = {};


    for (let ind = 0; ind < orgs.length; ind++) { // 遍历组织数组

        var peermap = {}; // peer节点的map，以peer节点名称（name属性）为key，peer节点为value
        let org = orgs[ind];
        let peers = org['peers']; // 组织的peer节点

        for (let pind = 0; pind < peers.length; pind++) { // 遍历peer节点

            let peer = peers[pind];
            peermap[peer['name']] = peer;
        }


        org['peernamemap'] = peermap; // 将peer节点的map保存到组织对象中


        if (types == 0) {
            let orgname = org['name'];
            orgnamemap[orgname] = org; // 以组织的名称（name属性）为key，组织对象为value
        } else if (types == 1) {

            let orgmspid = org['mspid'];
            orgnamemap[orgmspid] = org; // 以组织的mspid为key，组织对象为value

        }


        if(  ind == 0  && ledgerMgr.getCurrOrg() == ''  ) // 将第一个组织作为账本管理模块的当前组织
             ledgerMgr.changeCurrOrg ( org['name'] );


    }

    return orgnamemap;
}

/**
 * 监听syncData事件
 */
blockScanEvent.on('syncData', function (orgname) {
    setTimeout(function () {
        parserOrg(orgname)
    }, 1000)
});

/**
 * 监听syncBlockNow
 */
blockScanEvent.on('syncBlockNow', function (orgname) {
        //parserOrg(orgname);
        parserDefaultOrg();
});


/**
 * 设置其他组织列表
 * @param {Array} otherorg 其他组织列表 推测是以组织名称为属性的对象，属性值为字符串标记
 */
var setOtherOrg = ( otherorg )=>{

    other_org = otherorg;

}

/**
 * 获取其他组织列表
 * 推测other_org是以组织名称为属性的对象，属性值为字符串标记
 */
var getOtherOrg = ()=>{

    return other_org;
}

var  getPeer4Channelid = (channel_id)=> {

}


/**
 * 获取完整的peer节点的请求地址
 * @param {string} peerrequest peer节点的域名与端口
 */
var  getPeerRequest = (peerrequest)=> {

    if (bcconfig.enableTls) {
        return "grpcs://" + peerrequest;
    } else {

        return "grpc://" + peerrequest;
    }

}


/**
 * 根据组织的mspId获取组织中包含的所有Peer节点
 * @param orgmspid
 */
var getPeers4OrgMspId = function (orgmspid) {

    return orgmspidmap[orgmspid]['peers'];

}

/**
 * 根据组织名称（name属性）获取组织中包含的所有Peer节点
 * @param orgmspid
 */
var getPeers4Org = function (orgname) {

    return orgnamemap[orgname]['peers'];

}

/**
 * 获取当前组织的所有peer节点
 */
var getCurrOrgPeers = ()=>{

    let orgname = ledgerMgr.getCurrOrg(); // 获取当前组织的名称
    return getPeers4Org( orgname );

}


/**
 * 获取指定组织名称和peer名称的peer节点
 * @param orgname 组织名称
 * @param peername peer节点名称
 *
 */
var getPeer = function (orgname, peername) {

    return orgnamemap[orgname]['peernamemap'][peername];

}


/** ================  fabric service   ================**/


/**
 * 测试config.json中指定名称组织配置是否有效
 * @param {string} orgname 组织名称
 */
var testfunc = async (orgname) => {

    let org = orgnamemap[orgname]; // 获取组织
    let tempdir = bcconfig['keyValueStore']; // 从config.json中获取keyValueStore TODO：问题：这个目录是在哪的
    let adminkey = org['admin']['key']; // 取组织管理员的key地址
    let admincert = org['admin']['cert']; // 取组织管理员的证书地址

    fabricservice.inits(tempdir, adminkey, admincert); // 初始化fabric服务


    let peerrequest = { // 向peer节点发送请求的配置
        "requests": "grpc://192.168.23.212:7051",
        "serverhostname": "peer0.org1.robertfabrictest.com",
        "tls_cacerts": "/project/opt_fabric/fabricconfig/crypto-config/peerOrganizations/org1.robertfabrictest.com/peers/peer0.org1.robertfabrictest.com/tls/ca.crt"
    }



    /*let orderers = getOrdersRequestInfo(bcconfig['orderer']);

    let channelcontainorg = await fabricservice.getChannelConfing('roberttestchannel12',peerrequest,orderers) ;

    let channeljoinorgs = channelcontainorg['config']['channel_group']['groups']['map']['Application']['value']['groups']['map'];
    let join_groups = [];

    for( orgkey in channeljoinorgs ){
        join_groups.push(orgkey);
    }
*/

   /* let orderers = getOrdersRequestInfo(bcconfig['orderer']);
    let join_groups = await getChannelJoinOrg('roberttestchannel12',peerrequest,orderers,fabricservice)
    console.info( join_groups );*/

    let peerchannel = await fabricservice.getPeerChannel( peerrequest ); // 从fabric的指定peer节点查询加入的所有channel


    /*let blockchaininfo = await fabricservice.getBlockChainInfo('roberttestchannel', peerrequest);
    console.info(JSON.stringify(blockchaininfo));*/


    //for (let ind = 30; ind < 179; ind++) {



   /* let blockinfo = await fabricservice.getblockInfobyNum('roberttestchannel', peerrequest, 94);

    console.info(JSON.stringify(blockinfo['data']['data'][0]['payload']['header']['channel_header']['tx_id']));
    console.info(JSON.stringify(blockinfo['data']['data'][0]['payload']['header']['channel_header']['timestamp']));
    console.info(JSON.stringify(blockinfo['data']['data'][0]['payload']['data']['actions'][0]['payload']['action']['proposal_response_payload']['extension']));*/


    //console.info((JSON.stringify(getkeyset4Transaction(blockinfo['data']['data'][0]))));
    //console.info((JSON.stringify(getkeyset4Transaction(blockinfo['data']['data'][0]))));


    //}
    //let peerchannels = await fabricservice.getPeerChannel('grpc://192.168.23.212:7051');
    //let peerchannels = await fabricservice.getPeerChannel('grpc://172.16.10.186:7051');
    /*let peerchannels = await fabricservice.getPeerChannel('grpc://172.16.10.187:7051');
    console.info(  JSON.stringify( peerchannels) );*/
    //{"channels":[{"channel_id":"roberttestchannel"},{"channel_id":"roberttestchannelnew"}]}


   /* let installcc = await fabricservice.getPeerInstallCc(peerrequest);

    console.info(JSON.stringify(installcc));*/
    //let instancecc = await fabricservice.getPeerInstantiatedCc('roberttestchannel12','grpc://192.168.23.212:7051');


    //let transinfo = await fabricservice.getTransaction('roberttestchannel','grpc://192.168.23.212:7051','56f51f9a54fb4755fd68c6c24931234a59340f7c98308374e9991d276d7d4a96')

    //获取被调用chaincode  和 keyset 的代码
    //console.info(  JSON.stringify( transinfo['transactionEnvelope']['payload']['data']['actions'][0]['payload']['action']['proposal_response_payload']['extension']['results']['ns_rwset']) );

    //获取被调用chaincode背书节点的信息
    //console.info(  JSON.stringify( transinfo['transactionEnvelope']['payload']['data']['actions'][0]['payload']['action']['endorsements']) );


    //测试数据库

    /*let testsqlresult = await sql.saveRow('blocks',{
        'channelname':'roberttestchannel',
        'blocknum':
        'datahash':'ddddddddddd',
        'perhash':'dddddddd',
        'txcount':13,
        'remark':'ddd',
    });


    console.info(  JSON.stringify( testsqlresult) );*/


/*
    let channels = await sql.getRowsBySQl('select * from channel ','','');
    console.info(  JSON.stringify( channels) )
*/

    sql.closeconnection(); // 断开sql连接 TODO：这里不需要关闭，在之前没有用到sql

}


/**
 *
 * 获取加入名称为channelid的channel的组织名称列表
 * 返回结果确实是数组，但是否为组织名称，需要在确定TODO中的问题后才能确定
 *
 * @param {string} channelid channel名称
 * @param {Object} peer peer节点的请求参数
 * @param {Array<Object>} orderers orderer节点的请求参数的数组
 * @param {Object} fabricservice fabric服务
 * @returns {Promise<void>}
 *
 *
 */
var getChannelJoinOrg = async (channelid , peer , orderers ,fabricservice)=>{

    let channelcontainorg = await fabricservice.getChannelConfing(channelid,peer,orderers) ; // 获取channelid的channel的配置区块

    let channeljoinorgs = channelcontainorg['config']['channel_group']['groups']['map']['Application']['value']['groups']['map']; // TODO：无法从文档中获得channelcontainorg的完整结果
    let join_groups = [];

    for( orgkey in channeljoinorgs ){
        join_groups.push(orgkey);
    }


    return join_groups

}




/**
 * 根据config.js中组织的配置，将当前组织的在fabric中的peer、channel、区块、交易、keyset、chaincode，以及相关对应关系同步到数据库和内存
 */
var parserDefaultOrg = ()=>{

    let orgname = ledgerMgr.getCurrOrg(); // 获取当前组织名称
    parserOrg(orgname); // 根据config.js中组织的配置，将fabric中的peer、channel、区块、交易、keyset、chaincode，以及相关对应关系同步到数据库和内存

}

/**
 * 根据config.js中组织的配置，将fabric中的peer、channel、区块、交易、keyset、chaincode，以及相关对应关系同步到数据库和内存
 * @param {string} orgname 组织名称
 */
var parserOrg = async (orgname) => {


    let org = orgnamemap[orgname]; // 获取组织配置项
    let peers = org['peers']; // 获取peer节点
    let channelpeermap = {}; // channel名称到peer的映射
    let peerjoinchannels = []; // 包含加入到的channel列表的peer节点的数组
    let channelcontiantpeers = {}; // channel名称到以peer名称为key，peer为value的map的映射

    let tempdir = bcconfig['keyValueStore']; // 从config.json中获取keyValueStore TODO：问题：这个目录是在哪的
    let adminkey = org['admin']['key']; // 取组织管理员的key地址
    let admincert = org['admin']['cert']; // 取组织管理员的证书地址

    fabricservice.inits(tempdir, adminkey, admincert); // 初始化fabric服务


    for (let ind = 0; ind < peers.length; ind++) { // 遍历peer节点

        let peer = peers[ind];


        let currpeer = ledgerMgr.getCurrpeer(); // 获取当前peer节点的配置信息

        if(  ind == 0 && (currpeer == '' || currpeer == null) ) // 如果不存在当前peer，则将peers的第一个作为当前peer
            ledgerMgr.changeCurrPeer(peer);



        let peerchannel = await fabricservice.getPeerChannel(  getPeerRequestInfo(peer) ); // 获取包含peer节点加入到的channel的列表的应答对象

        //console.info(  JSON.stringify( peerchannels) );
        let peerchannels = peerchannel['channels']; // 获取peer节点加入到的channel的列表

        peer['channels'] = peerchannels; // 更新orgnamemap中的peer的缓存

        peerjoinchannels.push(peer);



        for (let cind = 0; cind < peerchannels.length; cind++) {// 遍历channel列表

            let channel_id = peerchannels[cind]['channel_id'];

            if (channelpeermap[channel_id] == null)
                channelpeermap[channel_id] = peer;

            let currentledg = ledgerMgr.getCurrChannel(); // 获取当前channel名称

            if(  cind == 0 && currentledg == ''  ) // 如果当前channel不存在，则将channel列表的第一个作为当前channel
                 ledgerMgr.changeChannel(channel_id);


            if( channelcontiantpeers[channel_id] == null  ){ // 更新channel名称到peer的映射关系

                  let peernamemap = {};
                  peernamemap[peer['name']] = peer;
                  channelcontiantpeers[channel_id] = peernamemap;

            }else{

                let peernamemap = channelcontiantpeers[channel_id];
                peernamemap[peer['name']] = peer;
                channelcontiantpeers[channel_id] = peernamemap;
            }



        }


    }

    var curr_channel = ledgerMgr.getCurrChannel(); // 获取当前channel名称

    ledgerMgr.changecurrchannelpeerma(channelpeermap); // 更新channel名称到peer的映射

    ledgerMgr.changeCurrchannelpeersmap(channelcontiantpeers); // 更新channel名称到以peer名称为key，peer为value的map的映射


    // 将 channel 以及  channel和peer的关系 保存到数据库
    await modifypeers(peerjoinchannels);

    // 从fabric获取每个peer上已安装的链，并将链保存到数据库
    await modifypeer_chaincode(peerjoinchannels, fabricservice);

    // 遍历channelpeermap的key，即channel，将这些channel的信息、channel上的区块信息、交易信息同步到数据库，并在其他组织列表中标记加入到这些channel中的组织
    await modify_channels(channelpeermap, fabricservice);


    // 将peerjoinchannels中每一个peer加入的channel上已实例化的chaincode的信息存入数据库
    await modify_peer_chaincode(peerjoinchannels, tempdir, adminkey, admincert);

    //console.info(  JSON.stringify( peerjoinchannels) );

    blockScanEvent.emit('syncData', orgname) // 触发syncData，表示同步orgname组织在fabric中的信息到数据库

    //sql.closeconnection();


}


/**
 * 从交易中获取写集合
 * TODO：问题：keyset的含义是什么？
 * @param {Object} transaction 从fabric中获取到的交易
 */
var getkeyset4Transaction = (transaction) => {


    let actions = transaction['payload']['data']['actions'];

    if (actions != null && actions[0]['payload'] != null) {

        let ns_rwset = transaction['payload']['data']['actions'][0]['payload']['action']['proposal_response_payload']['extension']['results']['ns_rwset'];

        //console.info(JSON.stringify(blockinfo['data']['data'][0]['payload']['data']['actions'][0]['payload']['action']['proposal_response_payload']['extension']['results']['ns_rwset'][1]['rwset']['writes']));


        let keyset = {}

        for (let ind = 0; ind < ns_rwset.length; ind++) {

            let keysettemp = ns_rwset[ind];

            let namespace = keysettemp['namespace'];


            if (namespace != 'lscc') {

                keyset = keysettemp;
                break;
            }

        }

        if (keyset != null && keyset['rwset'] != null)
            return {'chaincode': keyset['namespace'], 'writes': keyset['rwset']['writes']}
        else
            return {};


    } else
        return {};

}


/**
 * 从fabric获取每个peer上已安装的链，并将链保存到数据库
 * @param {Array<Object>} peers 包含channels的peer节点列表
 * @param {Object} fabricservice fabric服务
 */
var modifypeer_chaincode = async (peers, fabricservice) => {


    for (let ind = 0; ind < peers.length; ind++) {

        let peer = peers[ind];
        let requests = peer['requests'];
        let peer_request = getPeerRequest(requests); // 获取完整的peer节点的请求地址
        let peer_name = peer['name'];

        //peer['requests'] = getPeerRequest(peer['requests']);

        let installcc = await fabricservice.getPeerInstallCc(getPeerRequestInfo(peer)) // 查询指定peer节点已经安装的chaincode

        let installccs = installcc['chaincodes']; // 获取chaincode列表


        for (let iind = 0; iind < installccs.length; iind++) { // 遍历chaincode列表

            let installcctemp = installccs[iind];

            let name = installcctemp['name'];
            let version = installcctemp['version'];
            let path = installcctemp['path'];
            let escc = installcctemp['escc']; // TODO：问题：ESCC是什么东西？
            let vscc = installcctemp['vscc']; // TODO：问题：VSCC是什么东西？


            var chaincodes = {

                'peer_name': peer_name,
                'channelname': '',
                'name': name,
                'version': version,
                'path': path,
                'escc': escc,
                'vscc': vscc,
                'txcount': 0,
                'ccstatus': 0,
                'remark': '',

            };


            let installccheck = await sql.getRowByPkOne(` select id from chaincodes where peer_name = '${peer_name}' and  name = '${name}' and version = '${version}'  `)

            if (installccheck == null) {
                let installinserresult = await sql.saveRow('chaincodes', chaincodes); // 保存chaincode信息
            }


        }

        //console.info(  JSON.stringify( installcc['chaincodes']) );


    }

}

/**
 * 保存peers中的channel和与peer的对应关系到数据库
 * @param {Array<Object>} peers 包含channels的peer节点列表
 */
var modifypeers = async (peers) => {


    for (let ind = 0; ind < peers.length; ind++) {

        let peer = peers[ind];
        let channels = peer['channels'];

        let peer_name = peer['name'];


        for (let cind = 0; cind < channels.length; cind++) {

            let channel = channels[cind];

            let channel_id = channel['channel_id'];

            await save_channel(channel_id); // 将channel保存到数据库

            await save_peer_ref_channel(channel_id, peer_name); // 将channel和peer的对应关系保存到数据库


        }


    }


}

/**
 * 将channel保存到数据库
 * @param {string} channel_id channel名称
 */
var save_channel = async (channel_id) => {


    let channels = await sql.getRowByPkOne(` select id from channel where channelname = '${channel_id}' `)

    if (channels == null) {

        let channel = {
            'channelname': channel_id,
            'blocks': 0,
            'trans': 0,
            'remark': '',
        };

        await sql.saveRow('channel', channel);
    }


}

/**
 * 将peer和channel的对应关系保存到数据库
 * @param {string} channel_id channel名称
 * @param {string} peer_name peer名称
 */
var save_peer_ref_channel = async (channel_id, peer_name) => {


    let peerrefchannels = await sql.getRowByPkOne(` select id from peer_ref_channel where peer_name = '${peer_name}' and  channelname = '${channel_id}'  `)

    if (peerrefchannels == null) {

        let peer_ref_channel = {

            'peer_name': peer_name,
            'channelname': channel_id,

        };


        await sql.saveRow('peer_ref_channel', peer_ref_channel);

    }


}

/**
 * 遍历channelpeermap的key，即channel，将这些channel的信息、channel上的区块信息、交易信息同步到数据库，并在其他组织列表中标记加入到这些channel中的组织
 * @param {Object} channelpeermap channel名称到peer的映射
 * @param {Object} fabricservice fabric服务
 */
var modify_channels = async (channelpeermap, fabricservice) => {


    for (let key in channelpeermap) { // 遍历channelpeermap中的channel

        let channel_id = key;
        let peer = channelpeermap[channel_id];

        //peer['requests'] = getPeerRequest(peer['requests']);

        await modify_channel_block(channel_id, peer, fabricservice); // 将channel信息和该channel上的区块，以及区块中的交易存入数据库
        await modify_channel_contant_orgs(channel_id, peer, fabricservice); // 给（从getOtherOrg()获得的）其他组织列表中，加入channel_id channel的组织置标记


    }


}


/**
 * 给（从getOtherOrg()获得的）其他组织列表中，加入channel_id channel的组织置标记
 * @param {string} channel_id channel名称
 * @param {Object} peer peer配置信息
 * @param {Object} fabricservice fabric服务
 * @returns {Promise<void>}
 */
var modify_channel_contant_orgs = async ( channel_id, peer, fabricservice )=>{


    let otherorgs = getOtherOrg(); // 获取其他组织列表

    let ordererstemp = getOrdersRequestInfo(bcconfig['orderer']); // 获得orderer节点完整的请求参数
    let join_orgs = await getChannelJoinOrg(channel_id,getPeerRequestInfo(peer),ordererstemp,fabricservice); // 获取加入名称为channelid的channel的组织名称列表


    for ( let ind = 0 ; ind<join_orgs.length;ind++ ){ // 遍历加入channel_id channel的组织

        let orgmsp = join_orgs[ind];

        otherorgs[orgmsp] = '1'; // 给其他组织列表中，加入channel_id channel的组织置标记
    }



}

/**
 * 将channel信息和该channel上的区块，以及区块中的交易存入数据库
 * @param {string} channel_id channel名称
 * @param {Object} channelpeermap channel名称到peer的映射关系
 * @param {Object} fabricservice fabric服务
 */
var modify_channel_byId = async (channel_id, channelpeermap, fabricservice) => {

    let peer = channelpeermap[channel_id];
    await modify_channel_block(channel_id, peer, fabricservice); // 将channel信息和该channel上的区块，以及区块中的交易存入数据库


}


var modify_channel = async (channels) => {


}


/*var modify_channel_cc = async ( channel_id,peer,fabricservice )=> {


    let peer_request = getPeerRequest(peer['requests']);

    let instancecc = await fabricservice.getPeerInstantiatedCc(channel_id,peer_request);


    let channel = await  sql.getRowByPkOne(`  select * from channel where channelname = '${channel_id}'  `);
    //let channel = channels[0];

    let channelid = channel['id'];


}*/

/**
 * 将channel信息和该channel上的区块，以及区块中的交易存入数据库
 * @param {string} channel_id channel名称
 * @param {Object} peer peer配置信息
 * @param {Object} fabricservice fabric服务
 */
var modify_channel_block = async (channel_id, peer, fabricservice) => {


    //let peer_request = getPeerRequest(peer['requests']);
    let blockchaininfo = await fabricservice.getBlockChainInfo(channel_id, getPeerRequestInfo(peer)); // 从peer节点查询channel的信息

    let channel = await  sql.getRowByPkOne(`  select * from channel where channelname = '${channel_id}'  `); // 从数据库查询channel信息
    //let channel = channels[0];

    let channelid = channel['id'];

    let blockheight = blockchaininfo['height']['low']; // TODO: 问题height属性的值为数字，为何还要取low属性？

    let updageresult = await sql.updateBySql(` update channel set blocks = ${blockheight} where id = ${channelid}  `); // 更新数据库中channel的长度
    // console.info(JSON.stringify(blockchaininfo['height']['low']));


    let countblocks = channel['countblocks']; // 取数据库中的channel的区块数量


    while (blockheight > countblocks) { // 如果数据库中保存的channel的区块数量比channel的长度小，则更新区块信息


        let blockinfo = await fabricservice.getblockInfobyNum(channel_id, getPeerRequestInfo(peer), countblocks - 1); // 根据区块链的编号获取区块的详细信息

        let blocknum = blockinfo['header']['number']['low']; // 区块编号
        let datahash = blockinfo['header']['data_hash'];
        let perhash = blockinfo['header']['previous_hash'];

        let txcount = 0;

        let trans = blockinfo['data']['data']; // 交易列表

        if (trans != null) {
            txcount = trans.length;
        }


        let block = {
            'channelname': channel_id, // channel名称
            'blocknum': blocknum, // 区块编号
            'datahash': datahash,
            'perhash': perhash,
            'txcount': txcount, // 区块内的交易数
            'remark': '',
        };

        await sql.saveRow('blocks', block); // 将区块信息保存到数据库


        if( ledgerMgr.getCurrChannel() == channel_id  ){ // 遍历的channel为当前channel
            // 触发createBlock事件，表示有新区块入库
            blockListener.emit('createBlock', blockinfo );

        }


        await modify_channel_block_trans(channel_id, peer, blockinfo, fabricservice) // 将区块中的交易和keyset存入数据库
        // 新交易

        countblocks++;
        let updageresult = await sql.updateBySql(` update channel set countblocks = countblocks+1 where id = ${channelid}  `); // 更新数据库中的channel的区块数量


    }
    blockListener.emit('txIdle'); // 触发txIdle事件 TODO：问题：这个事件表示区块信息变更？


}

/**
 * 将区块中的交易和keyset存入数据库
 * @param {string} channel_id channel名称
 * @param {Object}} peer peer配置信息
 * @param {Object} blockinfo 从fabric中获取的区块信息
 * @param {Object}} fabricservice fabric服务
 */
var modify_channel_block_trans = async (channel_id, peer, blockinfo, fabricservice) => {


    let trans = blockinfo['data']['data']; // 获取区块中的交易

    if (trans != null) {


        let blocknum = blockinfo['header']['number']['low']; // 获取区块编号
        let blockhash = blockinfo['header']['data_hash'];
        //let perhash =  blockinfo['header']['previous_hash'];


        for (let ind = 0; ind < trans.length; ind++) { // 遍历交易


            let transaction = trans[ind];

            let txhash = transaction['payload']['header']['channel_header']['tx_id']; // 交易编号
            let timestamp = transaction['payload']['header']['channel_header']['timestamp']; // 交易时间戳
            let keyset = getkeyset4Transaction(transaction); // 从交易中获取写集合

            let chaincodename = '';

            if (keyset != null)
                chaincodename = keyset['chaincode'];


            let transactions = {

                'channelname': channel_id,
                'blocknum': blocknum,
                'blockhash': blockhash,
                'txhash': txhash,
                //'txcreatedt':timestamp,
                'chaincodename': chaincodename,
                'remark': ''
            };

            let transcheck = await sql.getRowByPkOne(` select id from transaction where txhash = '${txhash}' and  channelname = '${channel_id}'  `)
            if (transcheck == null)
                await sql.saveRow('transaction', transactions); // 将交易存入数据库

            let keyset_writer = keyset['writes']; // keyset中的写集合

            if (keyset_writer != null) {

                for (let kind = 0; kind < keyset_writer.length; kind++) { // 遍历写集合，将keyset存入数据库


                    let keysettemp = keyset_writer[kind];
                    let keyname = keysettemp['key'];
                    let is_delete = keysettemp['is_delete'];
                    let value = keysettemp['value'];

                    let is_delete_v = 0;

                    if (is_delete)
                        is_delete_v = 1;


                    let keyset = {

                        'channelname': channel_id,
                        'blocknum': blocknum,
                        'blockhash': blockhash,
                        'transactionhash': txhash,
                        'keyname': keyname,
                        'isdelete': is_delete_v,
                        'chaincode': chaincodename,
                        'trandtstr':timestamp,
                        'valuess':value,
                        'remark': ''
                    };


                    let keysetcheck = await sql.getRowByPkOne(` select id from keyset where keyname = '${keyname}' and  channelname = '${channel_id}' and  chaincode = '${chaincodename}' `)

                    // 将keyset信息写入数据库
                    if (keysetcheck == null) {

                        let keysetresult = await sql.saveRow('keyset', keyset);

                    }else{

                        let updatesql = ` update keyset set valuess = '${value}' , trandtstr = '${timestamp}' where keyname = '${keyname}' and  channelname = '${channel_id}' and  chaincode = '${chaincodename}'  `;
                        let updateresult = await sql.updateBySql(updatesql);


                    }


                    var keyset_history = {

                        'channelname':channel_id,
                        'blocknum':blocknum,
                        'blockhash':blockhash,
                        'transactionhash':txhash,
                        'keyname':keyname,
                        'valuess':value,
                        'trandtstr':timestamp,
                        'chaincode': chaincodename,
                        'remark':''
                    };

                    let keysetresult1 = await sql.saveRow( 'keyset_history' , keyset_history ); // 保存keyset变更历史



                }


            }


        }


    }

}


var modify_keyset = () => {


}

/**
 * 将每一个peer加入的channel上已实例化的chaincode的信息存入数据库
 * @param {Array<Object>} peers peer配置信息列表，每个数组元素包含peer加入到的channel列表
 * @param {string} tempdir keyValueStore路径
 * @param {*} adminkey 组织管理员的key路径
 * @param {*} admincert 组织管理员的证书路径
 */
var modify_peer_chaincode = async (peers, tempdir, adminkey, admincert) => {


    for (let ind = 0; ind < peers.length; ind++) { // 遍历peer

        let peer = peers[ind];
        let channels = peer['channels'];

        let peer_name = peer['name'];
        let peer_request = getPeerRequest(peer['requests']); // 获取完整的peer节点的请求地址

        for (let cind = 0; cind < channels.length; cind++) { // 遍历peer加入到的channel

            let channel = channels[cind];
            let channel_id = channel['channel_id'];

            let fabricservice1 = require('./fabricservice');
            fabricservice1.inits(tempdir, adminkey, admincert); // 初始化fabric服务


            //peer['requests'] = getPeerRequest(peer['requests']);
            let instancecc = await fabricservice1.getPeerInstantiatedCc(channel_id, getPeerRequestInfo(peer)); // 查询channel_id channel中已经实例化的Chaincode


            let instanceccs = instancecc['chaincodes']; // 获取chaincode列表


            for (let iind = 0; iind < instanceccs.length; iind++) { // 遍历chaincode列表

                let instancecctemp = instanceccs[iind];

                let name = instancecctemp['name'];
                let version = instancecctemp['version'];
                let path = instancecctemp['path'];
                let escc = instancecctemp['escc'];
                let vscc = instancecctemp['vscc'];


                let updatecc = ` update  chaincodes set channelname = '${channel_id}' , ccstatus = 1  ,escc = '${escc}' , vscc = '${vscc}'   where peer_name = '${peer_name}' and  name = '${name}' and version = '${version}'  `;

                let installccheck = await sql.updateBySql(updatecc); // 将chaincode存入数据库


            }

            //console.info(JSON.stringify(instancecc));


        }


    }


}


/**
 * 获取当前组织的fabric服务
 */
var getCurrOrgFabricservice = ()=>{

    let orgname = ledgerMgr.getCurrOrg(); // 获取当前组织
    return getFabricService4OrgName(orgname); // 获取orgname组织的fabric服务

}

/**
 * 获取指定组织名称的fabric服务
 * @param {string} orgname 组织名称
 */
var getFabricService4OrgName = (orgname)=>{

    let org = orgnamemap[orgname]; // 获取config.json中，orgname组织的配置对象

    let tempdir = bcconfig['keyValueStore']; // 从config.json中获取keyValueStore
    let adminkey = org['admin']['key']; // 取组织管理员的key地址
    let admincert = org['admin']['cert']; // 取组织管理员的证书地址


    let currrogservice = require('./fabricservice');
    currrogservice.inits(tempdir, adminkey, admincert); // 初始化fabric服务

    return currrogservice;
}

/**
 * 获取peer节点的完整的配置对象
 * @param {Object} peer peer配置对象
 */
function getPeerRequestInfo(peer) {

    let peerurl = getPeerRequest(peer['requests']); // 获取完整的peer节点的请求地址

    return {

        "requests":peerurl,
        "events":peer['events'],
        "serverhostname":peer['serverhostname'],
        "tls_cacerts":peer['tls_cacerts']

    };


}


/**
 * 获取orderer节点的完整的配置对象
 * @param {Object}} orderer orderer配置对象
 */
function getOrderRequestInfo(orderer) {

    let orderurl = getPeerRequest(orderer['url']); // 获取完整的orderer节点的请求地址

    return {
        "url":orderurl,
        "serverhostname":orderer['serverhostname'],
        "tls_cacerts":orderer['tls_cacerts']
    };


}

/**
 * 获得传入的orderer节点完整的请求参数
 * @param {Array<Object>} orderers orderer节点的配置信息的数组
 */
function getOrdersRequestInfo(orderers) {


    let requestorderers = [];

    for ( let ind = 0 ; ind<orderers.length ; ind++ ){

        let orderer = orderers[ind];

        let orderurl = getPeerRequest(orderer['url']); // // 获取完整的orderer节点的请求地址

        let orderertemp =  {
            "url":orderurl,
            "serverhostname":orderer['serverhostname'],
            "tls_cacerts":orderer['tls_cacerts']
        };

        requestorderers.push(orderertemp);

    }


    return requestorderers;

}

/**
 * 查询当前peer节点加入的所有channel的数量
 */
var getCurrPeerJoinChannels =  async ()=> {


    let currp = ledgerMgr.getCurrpeer();
    let peername = currp['name'];

    let sqlresult = await sql.getRowsBySQl( ` select count(*) as nums from peer_ref_channel ` ,{'peer_name' : peername},'');

    return sqlresult[0]['nums'];


}

/**
 * 查询当前peer节点创建的链的数量
 */
var getCurrPeerContaitCc = async ()=> {

    let currp = ledgerMgr.getCurrpeer();
    let peername = currp['name'];

    let sqlresult = await sql.getRowsBySQl( ` select count(distinct(name)) as nums from chaincodes ` ,{'peer_name' : peername},'');

    return sqlresult[0]['nums'];


}


/**
 * 获取当前组织的统计信息
 */
var getOrgStatus  = async ()=>{

    let currorg = ledgerMgr.getCurrOrg(); // 获得当前组织
    let peers = getCurrOrgPeers(); // 获取当前组织的所有peer节点

    let searchSql = `select id from channel `;
    let channelss = await sql.getRowsBySQlNoCondtion(searchSql); // 查询数据库中的所有channel

    let searchCcSql = ' select count(distinct(name)) as nums from chaincodes ';
    let chaincodess = await sql.getRowsBySQlNoCondtion( searchCcSql ); // 查询所有chaincode的数量


    let peer_num = peers.length;
    let channel_num = channelss.length;
    let chaincode_num = chaincodess[0]['nums'];



    return { 'peerCount':peer_num , 'channelCount':channel_num , 'latestBlock':0 , 'chaincodeCount':chaincode_num , 'txCount':0 };

}


var getChannelStatus = ()=>{



}


/**
 * 查询当前peer的统计数据
 */
var getPeerStatus = async ()=>{



    let currp = ledgerMgr.getCurrpeer(); // 获取当前peer节点的配置信息
    let peername = currp['name'];

    let searchSql = `select id from channel where channelname in ( select channelname from peer_ref_channel where peer_name = '${peername}' ) `;
    let rows = await sql.getRowsBySQlNoCondtion(searchSql); // 查询当前peer节点加入的channel

    let searchsql1 = ` select id from chaincodes where peer_name in ( select peer_name from peer_ref_channel where peer_name = '${peername}' )  `;
    let chaincodelist  = await sql.getRowsBySQlNoCondtion( searchsql1 ); // 查询当前peer节点安装的chaincode


    let channels = rows.length;
    let chaincodess = chaincodelist.length;

    return {'peerCount':0,'channelCount':channels,'latestBlock':0,'chaincodeCount':chaincodess,'txCount':0};

}




exports.getPeerStatus = getPeerStatus;
exports.getOrgStatus = getOrgStatus;

exports.getCurrPeerJoinChannels = getCurrPeerJoinChannels;
exports.getCurrPeerContaitCc = getCurrPeerContaitCc;

exports.getCurrOrgPeers = getCurrOrgPeers;
exports.getOtherOrg = getOtherOrg;
exports.setOtherOrg = setOtherOrg;
exports.getPeerRequestInfo = getPeerRequestInfo;
exports.parserDefaultOrg = parserDefaultOrg;
exports.getCurrOrgFabricservice = getCurrOrgFabricservice;
exports.getFabricService4OrgName = getFabricService4OrgName;
exports.testfunc = testfunc;
exports.getPeers4Org = getPeers4Org;
exports.getPeer = getPeer;
exports.ORGNAMEMAP = orgnamemap;
exports.parserOrg = parserOrg;
exports.blockScanEvent = blockScanEvent;
exports.getPeer4Channelid = getPeer4Channelid;
exports.getPeerRequest = getPeerRequest;
exports.orderers=orderers;

