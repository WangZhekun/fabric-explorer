import $ from 'jquery';

import 'bootstrap';
import 'd3'; // 数据可视化库
import 'bootstrap-tour'; // 用户引导插件
import 'jquery-ui';
import 'epoch-charting-ie-patched'; // epoch是一个图表库，依赖于d3
import moment from 'moment'; // 日期处理类库

import 'jif-dashboard/dashboard-core' // jif-dashboard是一个仪表盘框架
import 'jif-dashboard/dashboard-util'
import 'jif-dashboard/dashboard-template'

// import this first because it sets a global all the rest of the widgets need
import './widgets/widget-root'; // widget是jif-dashboard的概念

import common from './common';

import './vendor/stomp.min' // stomp是websocket库
import './vendor/client' // websocket连接（stomp的使用），和ajax的post接口，增加window.Client对象
import utils from './utils';
import './tour';

window.utils = utils;
window.moment = moment;


window.Tower = { // Tower对象
	ready: false, // 是否就绪标志
	current: null, // 当前section
	status: {}, // 当前section的状态数据

    // Tower Control becomes ready only after the first status is received from the server
    /**
     * 置ready状态为true，并开始用户引导程序
     */
	isReady: function() {
		Tower.ready = true;

		// let everyone listening in know
		Dashboard.Utils.emit('tower-control|ready|true'); // 控制台应用触发tower-control|ready|true事件

        if (window.localStorage.getItem('tourEnded') === null) {
            //first time, activate tour automatically
            $(document).trigger('StartTour'); // 触发document的StartTour事件
            Tower.tour.start(true); // 强制开始用户引导程序 TODO：问题：在document的StartTour事件中已经调用了tour.start方法，为何要重复调用？
        }

		return true;
	},

    /**
     * 初始化控制台应用
     */
	init: function() {
		//set options for the Dashboard 设置控制台应用的配置
		Dashboard.setOptions({
			'appName': 'onechain fabricexplorer' // 应用名称
		});

        Dashboard.preregisterWidgets({ // 注册widget（工具）

            'keyset': require('./widgets/keyset'),
            'chaincodelist': require('./widgets/chaincodelist'),
            'channellist': require('./widgets/channellist'),
            'network': require('./widgets/network'),
            //'metrix_choc_tx'	: require('./widgets/metrix_choc_tx'),
            'metrix_block_min': require('./widgets/metrix_block_min'),
            'metrix_txn_sec': require('./widgets/metrix_txn_sec'),
            'metrix_txn_min': require('./widgets/metrix_txn_min'),
            'peerlist': require('./widgets/peerlist'),
            'blockview': require('./widgets/blockview'),
            'blocklist': require('./widgets/blocklist'),
            'blockinfo': require('./widgets/blockinfo'),
            'txdetail': require('./widgets/txdetail'),

            'chaincodelist4peer': require('./widgets/chaincodelist4peer'),
            'channellist4peer': require('./widgets/channellist4peer'),
        });

		//initialize the Dashboard, set up widget container 初始化控制台应用
		Dashboard.init()

        // Adding event for hash changes 监听window的hashchange事件
        $(window).on('hashchange', this.processHash);

        this.processHash();

        // Reusing socket from cakeshop.js 重用websocket连接服务
        Tower.stomp = Client.stomp;
        Tower.stomp_subscriptions = Client._stomp_subscriptions;

		// open first section - channel 打开默认setcion —— channel TODO：问题：默认section应该是org？
		Tower.section['default']();
	},

    processHash: function() {
        if (window.location.hash) { // 页面地址的hash部分存在
            const params = {}; // 页面地址的hash部分解析出的参数
            const hash = window.location.hash.substring(1, window.location.hash.length); // 取页面地址的hash部分（#key1=value1&key2=value2 格式）

            _.each(hash.split('&'), function(pair) { // 解析hash参数
                pair = pair.split('=');
                params[pair[0]] = decodeURIComponent(pair[1]);
            });

            /**
             * 根据hash中的参数，调整展示内容
             */
            var werk = function() {
                if (params.section) { // 如果hash参数中包含section，触发对应section节点的点击事件
                    $('#' + params.section).click();
                }

                if (params.data) { // 如果hash参数中包含data，则将其值转化为对象
                    try {
                        params.data = JSON.parse(params.data);
                    } catch (err) {}
                }

                if (params.widgetId) { // 如果hash参数中包含widgetId，则展示指定的widget
                    Dashboard.show({ // 展示id为params.widgetId的widget
                        widgetId: params.widgetId,
                        section: params.section ? params.section : Tower.current,
                        data: params.data, 
                        refetch: true,
                    });
                }
            };

            // do when ready 如果Tower准备就绪，则执行werk函数（根据hash中的参数，调整展示内容）
            if (!Tower.ready) {
                Dashboard.Utils.on(function(ev, action) { // 监听控制台应用的事件
                    if (action.indexOf('tower-control|ready|') === 0) {
                        werk(); // 根据hash中的参数，调整展示内容
                    }
                });
            } else {
                werk(); // 根据hash中的参数，调整展示内容
            }
        }
    },

	// define the sections 定义section
	section: {

		'default':function () { // 默认section

            showSection('org'); // 修改服务端的当前section为org
            syncStatus(function (response) { // 从服务端查询当前section的状态，各section的状态数据几乎一样，仅当section为channel时，没有channelCount，即channel数量
                statusUpdate(response); // 缓存和展示当前section的状态数据
            });

            utils.subscribe('/topic/metrics/status', statusUpdate); // websocket持续监听/topic/metrics/status响应，更新当前section的状态

		},

        'organization': function () {
            showSection('org'); // 修改服务端的当前section为org
            // data that the widgets will use
            var data = {
                'numUser': 4,
                'appName': 'sample app',
                'url': 'hello.com',
                'description': 'this is a description of the app.'
            };

            var widgets = [
                {widgetId: 'network', data: data,refetch: true},
            ];

            utils.showHead(["default-channels","default-peers","default-chaincode"]); // 更新HTML #heads-up内展示的section

            Dashboard.showSection('organization', widgets);
        },

		'channel': function() {
            showSection('channel');
			// data that the widgets will use
			var data = {
				'numUser': 4,
				'appName': 'sample app',
				'url': 'hello.com',
				'description': 'this is a description of the app.'
			}

			var latestBlock;
            syncStatus(function (response) {
                latestBlock=response.latestBlock;
            });

			// the array of widgets that belong to the section,
			// these were preregistered in init() because they are unique

			var widgets = [

				{ widgetId: 'blockinfo',data: {bocknum: latestBlock},refetch: true},
				{ widgetId: 'blocklist' ,data: latestBlock,refetch: true},
				{ widgetId: 'blockview' ,data: data,refetch: true},
				{ widgetId: 'txdetail'  ,data: {txid:'0'},refetch: true},
				{ widgetId: 'peerlist'  ,data: data,refetch: true},
				{ widgetId: 'metrix_txn_sec' ,data: data,refetch: true},
				{ widgetId: 'metrix_txn_min' ,data: data,refetch: true},
				{ widgetId: 'metrix_block_min' ,data: data,refetch: true},
				//{ widgetId: 'metrix_choc_tx' ,data: data},
				{ widgetId: 'chaincodelist' ,data: data,refetch: true},
				{ widgetId: 'keyset' ,data: data,refetch: true},

			];

            //show current channel
            $.when(
                utils.load({ url: 'curChannel' })
            ).done(function(data) {
                var channelName=data.currentChannel;
                $('#showTitle').html($('<span>', {html: channelName}));
            });


            utils.showHead(["default-peers","default-chaincode","default-blocks","default-txn"]);

			// opens the section and pass in the widgets that it needs
			Dashboard.showSection('channel', widgets);
		},

        'peers': function () {
            showSection('peer');
            // data that the widgets will use
            var data = {
                'numUser': 4,
                'appName': 'sample app',
                'url': 'hello.com',
                'description': 'this is a description of the app.'
            }


            var widgets = [
                {widgetId: 'channellist4peer', data: data,refetch: true},
                {widgetId: 'chaincodelist4peer', data: data,refetch: true},
            ];

            //show current peer
            $.when(
                utils.load({ url: 'curPeer' })
            ).done(function(data) {
                var peerName=data.currentPeer;
                $('#showTitle').html($('<span>', {html: peerName}));
            });

            utils.showHead(["default-channels","default-chaincode"]);
            Dashboard.showSection('peers', widgets);
        },

        'api': function() {
            var widgets = [
                { widgetId: 'doc-frame' ,refetch: true}
            ];

            utils.showHead([]);
            Dashboard.showSection('api', widgets);
        }

	},


	debug: function(message) {
		var _ref;
		return typeof window !== 'undefined' && window !== null ? (_ref = window.console) !== null ? _ref.log(message) : void 0 : void 0;
	}
};

/**
 * 缓存和展示当前section的状态数据
 * @param {Object} response当前section的状态数据
 */
var statusUpdate = function(response) {
    var status = response;

    // 更新DOM节点的数据
    utils.prettyUpdate(Tower.status.peerCount, status.peerCount, $('#default-peers'));
    utils.prettyUpdate(Tower.status.latestBlock, status.latestBlock, $('#default-blocks'));
    utils.prettyUpdate(Tower.status.txCount, status.txCount, $('#default-txn'));
    utils.prettyUpdate(Tower.status.chaincodeCount, status.chaincodeCount, $('#default-chaincode'));
    utils.prettyUpdate(Tower.status.channelCount, status.channelCount, $('#default-channels'));

    Tower.status = status; // 缓存当前section的状态数据

    // Tower Control becomes ready only after the first status is received from the server
    if (!Tower.ready) { // 如果Tower为就绪，则置为就绪
        Tower.isReady();
    }

    Dashboard.Utils.emit('node-status|announce'); // 触发控制台应用的node-status|announce事件
};

/**
 * 修改服务端的当前section为sectionName
 * @param {string} sectionName section名称
 */
function showSection(sectionName) {

    utils.load({ url: 'showSection' ,data:{'sectionName':sectionName},async:false}); // 发送 POST showSection请求，修改服务端的当前section为sectionName
}

/**
 * 从服务端查询当前section的状态
 * @param {function} cb 回调函数
 */
function syncStatus(cb) {
    $.ajax({
        type: "post",
        url: "api/status/get", // 查询当前section的状态
        cache:false,
        async:false,
        dataType: "json",
        success: function(response){
            cb(response);

        },
        error:function(err){
            statusUpdate({ // 缓存和展示当前section的状态数据
                peerCount: 'n/a',
                latestBlock: 'n/a',
                txCount: 'n/a',
                chaincodeCount: 'n/a',
                channelCount: 'n/a'
            });
        }

    });
}

$(function() {
	$(window).on('scroll', function(e) {
		if ($(window).scrollTop() > 50) {
			$('body').addClass('sticky');
		} else {
			$('body').removeClass('sticky');
		}
	});


	// logo handler
	$("a.tower-logo").click(function(e) {
		e.preventDefault();
		$("#channel").click();
	});

	// Menu (burger) handler
	$('.tower-toggle-btn').on('click', function() {
		$('.tower-logo-container').toggleClass('tower-nav-min');
		$('.tower-sidebar').toggleClass('tower-nav-min');
		$('.tower-body-wrapper').toggleClass('tower-nav-min');
	});


	$('#reset').on('click', function() {
		Dashboard.reset();
	})


    // Navigation menu handler
    $('.tower-sidebar li').click(function(e) {
        var id = $(this).attr('id');
        if (id === 'help') {
            $(document).trigger('StartTour');
            Tower.tour.start(true);
            return;
        }

        e.preventDefault();

        Tower.current = id;

        $('.tower-sidebar li').removeClass('active');
        $(this).addClass('active');

        Tower.section[Tower.current]();

        $('#showTitle').html($('<span>', {html: $(this).find('.tower-sidebar-item').html()}));
        utils.showSelet(Tower.current);
    });


	// ---------- INIT -----------
	Tower.init();

	// Setting 'peers' as first section
	$('.tower-sidebar li').first().click();
});
