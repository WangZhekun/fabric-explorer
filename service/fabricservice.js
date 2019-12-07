/**
 * 该模块为fabric client的封装，负责与fabric集群交互
 */

var path = require('path');
var fs = require('fs');
var fsansyc = require('fs-extra');
var util = require('util');
var hfc = require('fabric-client');
var Peer = require('fabric-client/lib/Peer.js');
var EventHub = require('fabric-client/lib/EventHub.js');
var User = require('fabric-client/lib/User.js');
var crypto = require('crypto');

var ledgerMgr=require('../utils/ledgerMgr.js')
//svar FabricCAService = require('fabric-ca-client');

var hfc = require('fabric-client');
var log4js = require('log4js');
var logger = log4js.getLogger('Helper');
logger.setLevel('ERROR');

//var channelid = "roberttestchannel12";

//var tempdir = "/project/ws_nodejs/fabric_sdk_node_studynew/fabric-client-kvs";
var tempdir = ""; // keyValueStore目录
var admin_key = ""; // 组织管理员的key目录
var admin_sert = ""; // 组织管理员的证书目录

var client = new hfc(); // fabric client实例

var channelmap = {}; // channel名称到channel实例的映射
var peermap = {}; // peer的requests到peer实例的映射
var channelpeer = {}; // 以channel_id和peer['requests']组成的字符串为key，以peer为value的map
var orderermap = {}; // orderer的url到orderer实例的映射
var channelorderer = {}; // 以channel_id和orderer['url']组成的字符串为key，orderer实例为value的map

/*
var channel = getchannel(channelid
;var order = client.newOrderer('grpc://192.168.23.212:7050');
channel.addOrderer(order);

var  peer = client.newPeer('grpc://192.168.23.212:7051');
setupchannel(channel,peer,channelid,peerRequest);
*/

/*var  peer188 = client.newPeer('grpc://172.16.10.188:7051');
channel.addPeer(peer188);*/


/**
 * 初始化fabric服务
 * @param {string} _tempdir keyValueStore目录
 * @param {string} _admin_key 组织管理员的key目录
 * @param {string} _admin_sert 组织管理员的证书目录
 */
var inits = function ( _tempdir , _admin_key , _admin_sert ) {
    tempdir  = _tempdir;
    admin_key = _admin_key;
    admin_sert = _admin_sert;
}


/**
 * 从指定peer节点查询channel的信息
 * @param {string} channelid channel名称
 * @param {Object} peerRequest peer配置信息
 * @returns {Promise<TResult>}
 */
var getBlockChainInfo = function( channelid , peerRequest ){

    let channel = getchannel(channelid); // 获取channel实例
    let  peer = getpeer(peerRequest); // 获取peer实例

    setupchannel(channel,peer,channelid,peerRequest); // 将peer加入到channel中，并在channelpeer中缓存

    return getOrgUser4Local().then((user)=>{

         return channel.queryInfo(peer); // 从指定peer节点查询channel的信息

     } ,(err)=>{

         console.log( 'error' , err );
    } )

}

/**
 * 获取指定编号的区块的详细信息
 * @param {string} channelid channel名称
 * @param {Object} peerRequest peer配置对象
 * @param {number} blocknum 区块编号
 */
var getblockInfobyNum = function (channelid , peerRequest ,blocknum) {

    let channel = getchannel(channelid); // 获取channel实例
    let  peer = getpeer(peerRequest); // 获取peer实例


    setupchannel(channel,peer,channelid,peerRequest); // 将peer加入到channel中，并在channelpeer中缓存


    return getOrgUser4Local().then((user)=>{

        return channel.queryBlock(blocknum, peer,null); // 查询指定编号的区块的信息

    } ,(err)=>{
        console.log( 'error' , err);
    } )

}

/**
 * 获取指定hash的区块的详细信息
 * @param {string} channelid channel名称
 * @param {Object} peerRequest peer配置对象
 * @param {byte[]} blockHash 区块的hash值
 */
var getblockInfobyHash = function ( channelid , peerRequest , blockHash ) {

    let channel = getchannel(channelid); // 获取channel实例

    let  peer = getpeer(peerRequest); // 获取peer实例

    setupchannel(channel,peer,channelid,peerRequest); // 将peer加入到channel中，并在channelpeer中缓存

    return getOrgUser4Local().then(( user )=>{

        return channel.queryBlockByHash(new Buffer(blockHash,"hex"),peer) // 查询指定hash的区块的信息

    } ,(err)=>{

        console.log('error', err);

    } )

}



/**
 * 查询peer加入的所有channel
 * @param {Object} peerRequest peer配置对象
 */
var getPeerChannel = function ( peerRequest  ) {


    let  peer = getpeer(peerRequest); // 获取peer实例


    return getOrgUser4Local().then(( user )=>{

        return client.queryChannels(peer) // 查询peer加入的所有channel

    } ,(err)=>{

        console.log('error', err);
    } )

}

/**
 * 查询peer节点已经安装的chaincode
 * @param {Object} peerRequest peer配置对象
 */
var getPeerInstallCc = function (  peerRequest  ) {

    let  peer = getpeer(peerRequest); // 获取peer实例
    //let  peer1 = client.newPeer("grpc://192.168.23.212:7051");

    return getOrgUser4Local().then(( user )=>{

        return client.queryInstalledChaincodes(peer) // 查询peer节点已经安装的chaincode

    } ,(err)=>{

        console.log('error', err);
    } )

}



/**
 * 查询指定channel中已经实例化的Chaincode
 * 返回值为包含Chaincode列表的应答对象
 * @param {string} channelid channel名称
 * @param {Object} peerRequest peer请求参数
 */
var getPeerInstantiatedCc = function ( channelid , peerRequest ) {

    let channel = getchannel(channelid);
    let  peer = getpeer(peerRequest);
    setupchannel(channel,peer,channelid,peerRequest);

    return getOrgUser4Local().then(( user )=>{

        return channel.queryInstantiatedChaincodes( peer )

    } ,(err)=>{

        console.log('error', err);

    } )

}


/**
 *
 *  获取指定cahnnel名称的channel的配置区块
 *
 *  @param {string} channelid channel名称
 *  @param {Object} peerRequest peer节点的请求参数
 *  @param {Array<Object>} orderers 包含orderer节点请求参数的数组
 *  @returns {Promise.<TResult>}
 *
 */
var getChannelConfing = function ( channelid , peerRequest , orderers ) {


    let channel = getchannel(channelid); // 获取channel实例
    let  peer = getpeer(peerRequest); // 获取peer实例

    setupchannel(channel,peer,channelid,peerRequest); // 将peer加入到channel中
    setupchannel4Orderer(channel,channelid,orderers); // 将orderers中表示的所有orderer节点，加入到channel1中


    return getOrgUser4Local().then(( user )=>{

        return channel.getChannelConfig(); // 获取channel的配置区块 TODO：无法在文档中获得该API的返回值的完整结构

    } ,(err)=>{

        console.log('error', err);

    } )

}


/**
 * 查询指定id的交易
 * @param {string} channelid channel名称
 * @param {Object} peerRequest peer节点的请求参数
 * @param {string} transhash 交易id
 */
var  getTransaction = function (channelid , peerRequest ,transhash) {

    let channel = getchannel(channelid); // 获取channel实例
    let  peer = getpeer(peerRequest); // 获取peer实例
    setupchannel(channel,peer,channelid,peerRequest); // 将peer加入到channel中

    return getOrgUser4Local().then( (user)=>{

        return channel.queryTransaction(transhash, peer); // 根据交易id查询交易

    },(err)=>{
        console.log('error',err);
    })

}




/**
 * 发送一个chaincodeid 链上的提案（proposal）
 * 该方法已废弃
 * @param {string} chaincodeid 链ID
 * @param {string} func 回调的chaincode中的函数的名称
 * @param {Array<string>} chaincode_args func的参数列表
 */
var queryCc = function (chaincodeid , func , chaincode_args ) {


    return getOrgUser4Local().then(( user )=>{



        tx_id = client.newTransactionID(); // 创建一个TransactionID实例
        var request = {
            chaincodeId: chaincodeid,
            txId: tx_id,
            fcn: func,
            args: chaincode_args
        };

        return   channel.queryByChaincode( request , peer ); // 发送一个提案到peer节点 TODO:这个peer应该是被注释掉的全局peer

    } ,(err)=>{

        console.log('error', err);

    } ).then(( sendtransresult )=>{

        return sendtransresult;

    },(err)=>{
        console.log('error', err);
    });


}


/**
 * 发送一个交易
 * 该方法已废弃
 * @param {string} chaincodeid 链ID
 * @param {string} func 回调的chaincode中的函数的名称
 * @param {Array<string>} chaincode_args func的参数列表
 */
var sendTransaction = function ( chaincodeid , func , chaincode_args   ) {


    var tx_id = null;

    return getOrgUser4Local().then((user)=>{

        tx_id = client.newTransactionID(); // 创建一个TransactionID实例
        var request = {

            chaincodeId: chaincodeid,
            fcn: func,
            args: chaincode_args,
            chainId: channelid, // TODO：这个channelid应该是被注释掉的全局channelid
            txId: tx_id
        };


        return channel.sendTransactionProposal(request); // 发送一个交易提案（transaction proposal）

    } ,(err)=>{

        console.log('error', err);

    } ).then((chaincodeinvokresult )=>{


        var proposalResponses = chaincodeinvokresult[0]; // 各peer节点的应答
        var proposal = chaincodeinvokresult[1]; // 原始提案对象
        var header = chaincodeinvokresult[2];
        var all_good = true;


        for (var i in proposalResponses) { // 判断应答是否成功

            let one_good = false;
            if (proposalResponses && proposalResponses[0].response &&
                proposalResponses[0].response.status === 200) { // 这里只检查了第一个应答
                one_good = true;
                console.info('transaction proposal was good');
            } else {
                console.error('transaction proposal was bad');
            }
            all_good = all_good & one_good;
        }


        if (all_good) {

            console.info(util.format(

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
            var transactionID = tx_id.getTransactionID();

            return channel.sendTransaction(request); // 发送交易


        }



    },(err)=>{

        console.log('error', err);
    }).then(( sendtransresult )=>{

        return sendtransresult;

    },(err)=>{
        console.log('error', err);
    });

}


/**
 * 创建User实例，并持久化，即登录功能
 */
function getOrgUser4Local() {

    //测试通过CA命令行生成的证书依旧可以成功的发起交易
    /*let keyPath = "/project/opt_fabric/fabricconfig/crypto-config/peerOrganizations/org1.robertfabrictest.com/users/Admin@org1.robertfabrictest.com/msp/keystore";
    let keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
    let certPath = "/project/opt_fabric/fabricconfig/crypto-config/peerOrganizations/org1.robertfabrictest.com/users/Admin@org1.robertfabrictest.com/msp/signcerts";
    let certPEM = readAllFiles(certPath)[0].toString();
*/
    let keyPath = admin_key; // 组织管理员的key目录
    let keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
    let certPath = admin_sert; // 组织管理员的证书目录
    let certPEM = readAllFiles(certPath)[0].toString();

    let mspid = ledgerMgr.getCurrOrg();


    return hfc.newDefaultKeyValueStore({ // 创建一个KeyValueStore实例

        path:tempdir

    }).then((store) => {
        client.setStateStore(store); // 设置KeyValueStore实例作为client的状态存储，用来持久化User实例，避免调用接口时反复传入证书和私钥

        return client.createUser({ // 创建User实例
            username: 'Admin', // 用户名
            mspid: mspid, // mspid TODO：问题：mspid是什么
            cryptoContent: {
                privateKeyPEM: keyPEM, // 私钥的PEM串
                signedCertPEM: certPEM // 证书的PEM串 TODO：问题：PEM是什么？
            }
        });
    });
};


/**
 * 读取目录下的全部文件
 * @param {string} dir 目录
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
 * 获取channelmap中指定channel名称的channel对象
 * @param {string} channel_id channel名称
 */
function getchannel( channel_id ) {


    if( channelmap[channel_id] == null){ // 如果channelmap中不存在channel_id的channel，那么创建之
        let channel = client.newChannel(channel_id);
        channelmap[channel_id]=channel;
    }

    return channelmap[channel_id];
}

/**
 * 获取指定参数的peer节点对象
 * @param {Object} peerRequest peer节点的请求参数
 */
function getpeer(peerRequest) {

    let requesturl = peerRequest['requests'];
    //let requesturl_pro = getpeer

    if( peermap[requesturl] == null){ // 如果peermap中不存在peerRequest表示的peer，那么创建之


        let  peer ;

        if( requesturl.indexOf("grpc://") === 0 ){

            peer = client.newPeer(requesturl);

        }else if( requesturl.indexOf("grpcs://") === 0 ){

            let tls_cacerts_content = fsansyc.readFileSync(peerRequest['tls_cacerts']);

            let opt = {
                pem: Buffer.from(tls_cacerts_content).toString(),
                'ssl-target-name-override': peerRequest['serverhostname']
            }
            peer = client.newPeer(requesturl,opt);


        }



        peermap[requesturl]=peer;
    }

    return peermap[requesturl];

}

/**
 * 获取指定的orderer节点对象
 * @param {Object} orderer orderer节点的请求参数
 */
function getOrderer( orderer ) {

    let orderurl = orderer['url'];

    if( orderermap[orderurl] == null){

        let order;

        if( orderurl.indexOf("grpc://") === 0 ){

            order = client.newOrderer(orderurl);


        }else if(orderurl.indexOf("grpcs://") === 0 ){

            let tls_cacerts_content = fsansyc.readFileSync(orderer['tls_cacerts']);

            let opt = {
                         pem: Buffer.from(tls_cacerts_content).toString(),
                        'ssl-target-name-override': orderer['serverhostname']
                    }
            order = client.newOrderer(orderurl,opt);


        }



        orderermap[orderurl]=order;
    }

    return orderermap[orderurl];



}

/**
 * 将peer加入到channel1中，并在channelpeer中缓存
 * channelpeer为以channel_id和peer['requests']组成的字符串为key，以peer为value的map
 * @param {Object} channel1 channel实例
 * @param {Object} peer peer实例
 * @param {string} channel_id channel名称
 * @param {Object} peer_request peer节点请求参数
 */
function setupchannel( channel1, peer , channel_id , peer_request ) {

    let pkey = channel_id + peer['requests'];

    if( channelpeer[pkey] == null ){
        channel1.addPeer(peer);
        channelpeer[pkey] = peer;
    }


}

/**
 * 将orderers中表示的所有orderer节点，加入到channel1中，并在channelorderer中缓存
 * channelorderer为以channel_id和orderer['url']组成的字符串为key，orderer实例为value的map
 * @param {Object} channel1 channel实例
 * @param {string} channel_id channel名称
 * @param {Array<Object>} orderers orderer节点请求参数的数组
 */
function setupchannel4Orderer( channel1 , channel_id , orderers ) {


    for( let ind = 0 ; ind<orderers.length ; ind++ ){

        let orderer = orderers[ind];
        let pkey = channel_id + orderer['url'];


        if(  channelorderer[pkey] == null ){
            let fabricorderer = getOrderer(orderer);
            channel1.addOrderer(fabricorderer);
            channelorderer[pkey] = fabricorderer;

        }
    }

}


exports.inits = inits;
exports.getBlockChainInfo = getBlockChainInfo;
exports.getblockInfobyNum = getblockInfobyNum;
exports.getblockInfobyHash = getblockInfobyHash;
exports.getPeerChannel = getPeerChannel;
exports.getPeerInstallCc = getPeerInstallCc;
exports.getPeerInstantiatedCc = getPeerInstantiatedCc;
exports.getTransaction = getTransaction;
exports.sendTransaction = sendTransaction;
exports.queryCc = queryCc;
exports.getChannelConfing = getChannelConfing;