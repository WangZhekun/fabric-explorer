/**
 *
 * Created by shouhewu on 6/8/17.
 *
 */
var express = require("express");
var path = require('path');
var app = express();
var http= require('http').Server(app);
var bodyParser = require('body-parser');

require('./socket/websocketserver.js').init(http) // 创建websocket服务端连接

var timer=require('./timer/timer.js')
timer.start() // 启动定时器，定时向客户端发送统计数据


var query=require('./app/query.js'); // 区块链查询接口
var ledgerMgr=require('./utils/ledgerMgr.js')

var statusMertics=require('./service/metricservice.js') // 数据库chaincodes、transaction、blocks表查询服务

var channelsRouter=require('./router/channels.js'); // channel相关的应答接口

var keyset=require('./service/keysetService.js'); // 数据库keyset表查询服务

var bcexplorerservice = require('./service/bcexplorerservice');


app.use(express.static(path.join(__dirname,'explorer_client'))); // 添加静态资源
app.use(bodyParser.json()); // 请求体解析，解析application/json
app.use(bodyParser.urlencoded({ extended: true })); // 请求体解析，解析经urlencoded编码的参数
app.use('/apis',channelsRouter) // 引入channel相关的应答接口


var sql=require('./db/mysqlservice.js') // 数据库操作服务

var config = require('./config.json'); // 配置项
var host = process.env.HOST || config.host; // 本服务的域名
var port = process.env.PORT || config.port; // 本服务的端口


// =======================   controller  ===================

/**
 * 根据交易ID查询交易信息
 */
app.post("/api/tx/getinfo", async function(req, res) {

    let  txid = req.body.txid // 交易ID
    if( txid != '0' ){

    let fabricservice = bcexplorerservice.getCurrOrgFabricservice(); // 获取当前组织的fabricService实例
    let curr_channel = ledgerMgr.getCurrChannel(); // 获取当前channel
    let channelpeermap = ledgerMgr.getcurrchannelpeerma(); // 获取当前的channel到peer的map
    let peer = channelpeermap[curr_channel]; // 获取当前channel的peer节点

    //let peerRequest = bcexplorerservice.getPeerRequest(peer['requests']);

    //peer['requests'] = bcexplorerservice.getPeerRequest(peer['requests']);

    let response_payloads = await fabricservice.getTransaction(curr_channel , bcexplorerservice.getPeerRequestInfo(peer) ,txid); // 查询指定交易ID的信息

    var header = response_payloads['transactionEnvelope']['payload']['header'] // 交易的基础信息
    var data = response_payloads['transactionEnvelope']['payload']['data'] // 交易的内容
    var signature = response_payloads['transactionEnvelope']['signature'].toString("hex") // 交易的签名


    let otherorgs = bcexplorerservice.getOtherOrg(); // 获取其他组织


    res.send({
        'tx_id':header.channel_header.tx_id, // 交易ID
        'timestamp':header.channel_header.timestamp, // 时间戳
        'channel_id':header.channel_header.channel_id, // channel ID
        'type':header.channel_header.type, // 交易类型
    })


    /*query.getTransactionByID('peer1',ledgerMgr.getCurrChannel(),txid,'admin','org1').then(response_payloads=>{

        var header = response_payloads['transactionEnvelope']['payload']['header']
        var data = response_payloads['transactionEnvelope']['payload']['data']
        var signature = response_payloads['transactionEnvelope']['signature'].toString("hex")

        res.send({
            'tx_id':header.channel_header.tx_id,
            'timestamp':header.channel_header.timestamp,
            'channel_id':header.channel_header.channel_id,
            'type':header.channel_header.type,
        })
    })*/

    }else{
        res.send({ })
    }


});

/**
 * 根据交易ID查询完整交易信息
 */
app.post("/api/tx/json", async function(req, res) {

    let  txid = req.body.number



    if( txid != '0' ){



        let fabricservice = bcexplorerservice.getCurrOrgFabricservice(); // 获取当前组织的fabricService实例
        let curr_channel = ledgerMgr.getCurrChannel(); // 获取当前channel
        let channelpeermap = ledgerMgr.getcurrchannelpeerma(); // 获取当前的channel到peer的map
        let peer = channelpeermap[curr_channel]; // 获取当前channel的peer节点

        let peerRequest = bcexplorerservice.getPeerRequest(peer['requests']);

        //peer['requests'] = bcexplorerservice.getPeerRequest(peer['requests']);

        let response_payloads = await fabricservice.getTransaction( curr_channel , bcexplorerservice.getPeerRequestInfo(peer)  , txid ); // 查询指定交易ID的信息


        var header = response_payloads['transactionEnvelope']['payload']['header'];
        var data = response_payloads['transactionEnvelope']['payload']['data'];
        var signature = response_payloads['transactionEnvelope']['signature'].toString("hex");

        var blockjsonstr = JSON.stringify(response_payloads['transactionEnvelope']); // 获取交易信息和签名信息

        res.send(blockjsonstr);

        /*query.getTransactionByID('peer1',ledgerMgr.getCurrChannel(),txid,'admin','org1').then(response_payloads=>{

            var header = response_payloads['transactionEnvelope']['payload']['header']
            var data = response_payloads['transactionEnvelope']['payload']['data']
            var signature = response_payloads['transactionEnvelope']['signature'].toString("hex")

            var blockjsonstr = JSON.stringify(response_payloads['transactionEnvelope'])

            res.send(blockjsonstr)

        })
        */
    }else{

        res.send({ })

    }

});

/**
 * 查询指定区块编号的完整区块信息
 */
app.post("/api/block/json", async function(req, res) {

    let number=req.body.number // 区块编号

    let fabricservice = bcexplorerservice.getCurrOrgFabricservice(); // 获取当前组织的fabricService实例
    let curr_channel = ledgerMgr.getCurrChannel(); // 获取当前channel
    let channelpeermap = ledgerMgr.getcurrchannelpeerma(); // 获取当前的channel到peer的map
    let peer = channelpeermap[curr_channel]; // 获取当前channel的peer节点

    let peerRequest = bcexplorerservice.getPeerRequest(peer['requests']);

    //peer['requests'] = bcexplorerservice.getPeerRequest(peer['requests']);

    //let response_payloads = await fabricservice.getTransaction(curr_channel , peerRequest ,txid);
    let blockinfo = await fabricservice.getblockInfobyNum( curr_channel , bcexplorerservice.getPeerRequestInfo(peer)  , parseInt(number) ); // 在指定peer上，查询指定区块编号的区块信息

    var blockjsonstr = JSON.stringify(blockinfo);

    res.send(blockjsonstr);

    /*query.getBlockByNumber('peer1',ledgerMgr.getCurrChannel(),parseInt(number),'admin','org1').then(block=>{

        var blockjsonstr = JSON.stringify(block)

        res.send(blockjsonstr)
    })*/

});

/**
 * 查询指定区块编号的区块信息
 */
app.post("/api/block/getinfo", async function(req, res) {



    let number=req.body.number // 区块编号

    let fabricservice = bcexplorerservice.getCurrOrgFabricservice(); // 获取当前组织的fabricService实例
    let curr_channel = ledgerMgr.getCurrChannel(); // 获取当前channel
    let channelpeermap = ledgerMgr.getcurrchannelpeerma(); // 获取当前的channel到peer的map
    let peer = channelpeermap[curr_channel]; // 获取当前channel的peer节点

    let peerRequest = bcexplorerservice.getPeerRequest(peer['requests']);

    //let response_payloads = await fabricservice.getTransaction(curr_channel , peerRequest ,txid);

    //peer['requests'] = bcexplorerservice.getPeerRequest(peer['requests']);


    let blockinfo = await fabricservice.getblockInfobyNum( curr_channel , bcexplorerservice.getPeerRequestInfo(peer)  , parseInt(number) ); // 在指定peer上，查询指定区块编号的区块信息
    let blockjsonstr = JSON.stringify(blockinfo);

    let low = blockinfo['header']['number']['low'];
    /*let previous_hash = blockinfo['header']['previous_hash'];
    let data_hash = blockinfo['header']['data_hash'];
    let transactions = blockinfo['header']['number']['low'];
    */

    res.send({
        'number':low,
        'previous_hash':blockinfo['header']['previous_hash'],
        'data_hash':blockinfo['header']['data_hash'],
        'transactions':blockinfo['data']['data']
    })



    /*let number=req.body.number
    query.getBlockByNumber('peer1'']',ledgerMgr.getCurrChannel(),parseInt(number),'admin','org1').then(block=>{
        res.send({
            'number':block.header.number.toString(),
            'previous_hash':block.header.previous_hash,
            'data_hash':block.header.data_hash,
            'transactions':block.data.data
        })
    })*/


});

/*app.post("/api/block/get", function(req, res) {
    let number=req.body.number
    query.getBlockByNumber('peer1',ledgerMgr.getCurrChannel(),parseInt(number),'admin','org1').then(block=>{
        res.send({
            'number':number,
            'txCount':block.data.data.length
        })
    })
});*/
/**
 * 从数据库中查询指定区块编号的交易数量
 */
app.post("/api/block/get", function(req, res) {
    let number=req.body.number // 区块编号
    sql.getRowByPkOne(`select blocknum ,txcount from blocks where channelname='${ledgerMgr.getCurrChannel()}' and blocknum='${number}'`).then(row=>{
        if(row){
            res.send({
                'number':row.blocknum,
                'txCount':row.txcount
            })
        }
    })

});

/**
 * 查询当前section的状态
 */
app.post("/api/status/get", function(req, res) {
    let sectionName=ledgerMgr.currSection();
    if (sectionName=='channel'){
        statusMertics.getStatus(ledgerMgr.getCurrChannel(),function(status){ // 从数据库查询，当前channel的peerCount peer数、latestBlock最后一个区块、chaincodeCount链数、txCount交易数
            res.send(status)
        })
    } else if(sectionName=='org'){
        bcexplorerservice.getOrgStatus().then(status=>{ // 从数据库查询，当前组织的peerCount peer数、channelCount channel数、latestBlock最后一个区块、chaincodeCount链数、txCount交易数
            res.send(status)
        });

    } else if(sectionName=='peer'){
        bcexplorerservice.getPeerStatus().then(status=>{ // 从数据库查询，当前peer节点的peerCount peer数、channelCount channel数、latestBlock最后一个区块、chaincodeCount链数、txCount交易数
            res.send(status)
        });
    }

});

/**
 * 查询当前channel的所有链
 */
app.post('/chaincodelist',function(req,res){
    statusMertics.getTxPerChaincode(ledgerMgr.getCurrChannel(),function (data) { // 从数据库查询，当前chennal的所有链，包括channelName channel名称、chaincodename链名称、path、version版本、txCount交易数
        res.send(data)
    })
})

/**
 * 修改当前channel名称
 */
app.post('/changeChannel',function(req,res){
    let channelName=req.body.channelName // channel名称
    ledgerMgr.changeChannel(channelName) // 修改当前channel名称，触发channgelLedger事件
    res.send({'a':ledgerMgr.getCurrChannel()})
})

/**
 * 获取当前channel名称
 */
app.post('/curChannel',function(req,res){
    res.send({'currentChannel':ledgerMgr.getCurrChannel()})
})

/**
 * 获取所有channel名称
 */
app.post('/channellist',function(req,res){
    ledgerMgr.getChannellist().then(channelList=>{ // 从数据库查询，获取所有channel名称
        res.send({'channelList':channelList});
    }).catch(err=>{
        res.send({'channelList':[ledgerMgr.getCurrChannel()]}); // 异常状态下，返回仅包含当前channel名称的数组
    })
})

/**
 * 获取当前peer节点的名称
 */
app.post('/curPeer',function(req,res){
    res.send({'currentPeer':ledgerMgr.getCurrpeer()['name']})
})

/**
 * 获取当前组织的所有peer节点
 */
app.post('/peerselectlist',function(req,res){
    let peerlist=bcexplorerservice.getCurrOrgPeers(); // 获取当前组织的所有peer节点，包含config.json中peer节点的信息
    res.send({'peerlist':peerlist});
})

/**
 * 修改当前组织的当前peer节点
 */
app.post('/changePeer',function(req,res){
    let peerName=req.body.peerName // peer节点名称
    let currorg = ledgerMgr.getCurrOrg();
    let peer = bcexplorerservice.getPeer(ledgerMgr.getCurrOrg(),peerName); // 从config.json文件中，从当前组织获取指定peer节点名称的peer信息
    ledgerMgr.changeCurrPeer(peer) // 修改当前peer
    res.send({'a':ledgerMgr.getCurrpeer()})
})

/**
 * 修改当前section
 */
app.post('/showSection',function(req,res){
    let sectionName=req.body.sectionName;
    ledgerMgr.changeSection(sectionName);
    res.send({'a':ledgerMgr.currSection()});
})

/**
 * 查询keyset
 */
app.post('/getKeyset',function(req,res){
    keyset.getKeyset().then(rows=>{ // 从数据库查询，查询全部的keyset，包含channelname channel名称、blocknum 区块编号、blockhash 区块hash值、transactionhash 交易hash值、keyname、isdelete 删除标志、chaincode 链
        res.send(rows);
    })
})



/**
 * 查询当前peer节点的所有channel，包括channel上的链数、交易数、keyset数统计
 */
app.post('/channellist4peer', async function(req,res){


    let currp = ledgerMgr.getCurrpeer(); // 获取当前peer节点
    let peername = currp['name']; // 获取当前peer节点的名称

    let searchSql = `select * from channel where channelname in ( select channelname from peer_ref_channel where peer_name = '${peername}' ) `;


    let chaincodesmap = await sql.getSQL2Map( ` select channelname , count(distinct(name)) as nums from chaincodes  where peer_name = '${peername}'  group by  channelname  `,'channelname'); // 从数据库查询，指定peer节点，在不同channel上的链的数量，返回以channel名称为key，行为value的map
    let channeltransmap  = await sql.getSQL2Map( ` select channelname , count(*) as nums from transaction group by  channelname `,'channelname'); // 从数据库查询，各channel上的交易的数量，返回以channel名称为key，行为value的map


    let keysetmap  = await sql.getSQL2Map( ` select channelname , count(*) as nums from keyset group by  channelname `,'channelname'); // 从数据库查询，各channel上的keyset数量，返回以channel名称为key，行为value的map



    let rows = await sql.getRowsBySQlNoCondtion(searchSql); // 查询当前peer节点的所有channel的信息

    for( let ind = 0 ; ind < rows.length ; ind++ ){

        let cc = rows[ind];
        let channelname = cc['channelname'];

        cc['ccnums'] = chaincodesmap.get(channelname)['nums'] // 链数
        cc['tranmums'] = channeltransmap.get(channelname)['nums'] // 交易数
        cc['keynums'] = keysetmap.get(channelname)['nums'] // keyset数


    }




    res.send(rows);


})

/**
 * 查询当前peer节点上的所有链
 */
app.post('/chaincodelist4peer',async function(req,res){


    let currp = ledgerMgr.getCurrpeer(); // 获取当前peer节点
    let peername = currp['name']; // 获取当前peer节点的名称

    let searchsql = ` select * from chaincodes where peer_name in ( select peer_name from peer_ref_channel where peer_name = '${peername}' )  order by  ccstatus desc `;
    let chaincodelist  = await sql.getRowsBySQlNoCondtion( searchsql ); // 从数据库查询，查询指定peer节点的所有链



    for( let ind = 0 ; ind < chaincodelist.length ; ind++ ){

        let cc = chaincodelist[ind];

        if( cc['ccstatus'] == 0  )
                cc['ccstatus_commit'] = 'Install';
        else
                cc['ccstatus_commit'] = 'Instantiated';

    }

    res.send(chaincodelist);

})



/**
 * 查询当前channel的所有peer节点
 */
app.post('/peerlist', async function(req,res){


    let curr_channel = ledgerMgr.getCurrChannel(); // 获取当前channel名称
    let curr_channel_peermap = ledgerMgr.getCurrchannelpeersmap()[curr_channel]; // 获取当前channel的所有peer节点的map
    let curr_channel_peers = []; // 当前channel的所有peer节点

    for (let key in curr_channel_peermap) {
        let peer = curr_channel_peermap[key];
        curr_channel_peers.push(peer);

    }


    /* let orgs = await bcexplorerservice.getOrgStatus();
    let peerstatus = await bcexplorerservice.getPeerStatus();
    */

    //let currp = ledgerMgr.getCurrpeer();
    let currpeerjoinchannel = await bcexplorerservice.getCurrPeerJoinChannels(); // 从数据库查询，查询当前peer节点加入的所有channel的数量 TODO：没用
    let currpeerconCc = await  bcexplorerservice.getCurrPeerContaitCc(); // 从数据库查询，查询当前peer节点创建的链的数量 TODO：没用

    res.send(curr_channel_peers);

    /*keyset.getKeyset().then(rows=>{
        console.info(JSON.stringify(rows))
        res.send(rows);
    })*/
})

/**
 * 查询节点网络，包含一个orderer节点、一个或多个组织节点和当前组织的所有peer节点
 */
app.post('/network',function(req,res){


    let curr_channel = ledgerMgr.getCurrChannel(); // 获取当前channel名称
    let curr_org = ledgerMgr.getCurrOrg(); // 获取当前组织名称
    let curr_peers = bcexplorerservice.getPeers4Org(curr_org); // 从config.json文件中，获取当前组织的所有peer节点
    let curr_orderer = bcexplorerservice.orderers[0]; // 从config.json文件中，获取第一个orderer节点
    let other_org = bcexplorerservice.getOtherOrg(); // 获取其他组织 TODO：set方法没有被调用

    let currorgobj = bcexplorerservice.ORGNAMEMAP[curr_org]; // 从config.json文件中，获取当前组织的配置信息
    let currmspid = currorgobj['mspid']; // 获取当前组织的mspid

    /*{id: 1, label: 'CA', font:{size:30}, shape: 'circle'},
    {id: 2, label: 'Orderer' , font:{size:30}, shape: 'ellipse' },
    {id: 3, label: 'Org1Msp' ,font:{size:30}, shape: 'ellipse' },*/

    let nodearr = []; // 网络节点数组
    let ledag = []; // 各网络节点中组织节点到orderer节点指向数组

    let ordererdata = {id: 1, label: 'Orderer', font:{size:30}, shape: 'ellipse'}; // orderer节点
    let currmsp = {id: 2, label: `${currmspid}`, font:{size:30}, shape: 'box'}; // 组织节点

    nodearr.push(ordererdata); // 将orderer节点加入到网络数组中
    nodearr.push(currmsp); // 将组织节点加入到网络数组中


    let ind = 3; // 其他组织节点的第一个索引

    let peerind = 3; // 节点id

    for( let key in other_org   ){ // 遍历其他组织

        if(  key == currmspid ) // 跳过当前组织
            continue;
        let orgmsp = other_org[key];
        let temp =  {id: peerind , label:  `${key}`  , font:{size:30}, shape: 'box'}; // 创建组织节点
        nodearr.push(temp); // 将组织节点加入到网络数组中

        peerind ++; // 节点id加一
    }

    for(  let index2 = peerind ;  index2< curr_peers.length+peerind ; index2++   ){ // 遍历当前组织的所有peer节点

        let peertemp = curr_peers[index2-peerind]; // 取peer节点配置信息
        let temp1 =  {id: index2 , label:  `${peertemp['name']}`  , font:{size:30,color:'white'}, shape: 'database',color:'DarkViolet'}; // 创建peer节点
        nodearr.push(temp1); // 将peer节点加入到网络数组中

    }


    ledag.push({from: 2, to: 1, arrows:'to'}); // 添加从当前组织节点到orderer节点的指向

    for ( let index5 = ind-1 ; index5<peerind-1;index5++ ){ // 遍历网络数组中的其他组织节点

        let nodetemp = nodearr[index5]; // 取其他组织节点
        let nodeid = nodetemp['id'];
        ledag.push({from: nodeid , to: 1, arrows:'to'}); // 添加其他组织节点到orderer节点的指向

    }



    for( let index6 = peerind-1 ; index6<nodearr.length ; index6++){ // 遍历网络数组中的当前组织的peer节点


        let nodetemp = nodearr[index6]; // 取peer节点
        let nodeid = nodetemp['id'];
        ledag.push({from: nodeid , to: 2 , arrows:'to'}); // 添加peer节点到当前组织节点的指向

    }


    let result = {
        "nodearr":nodearr, "edgesarr":ledag


    }


    //{from: 3, to: 2, arrows:'to'},


    res.send(result);




    /*keyset.getKeyset().then(rows=>{
        console.info(JSON.stringify(rows))
        res.send(rows);
    })*/



})

// ============= start server =======================

var server = http.listen(port, function() {
    console.log(`Please open Internet explorer to access ：http://${host}:${port}/`);
});





//注册异常处理器
process.on('unhandledRejection', function (err) {
    console.error(err.stack);
});

process.on(`uncaughtException`, console.error);

