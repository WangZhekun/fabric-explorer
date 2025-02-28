export default {
    /**
     * 发送ajax请求，默认method为POST
     * @param {Object} opts ajax请求配置项
     */
    load: function (opts) {
        var config = {
            type: opts.method ? opts.method : 'POST',
            url: opts.url,
            contentType: opts.type ? opts.type : 'application/json',
            cache: false,
            async: opts.async ? opts.async : true,
            timeout: opts.timeout ? opts.timeout : 30000
        };

        if (opts.data) {
            config.data = JSON.stringify(opts.data);
        }

        if (opts.complete) {
            config.complete = opts.complete;
        }

        return $.ajax(config);
    },

    subscribe: Client.subscribe,

    /**
     * 更新el节点的数据
     * @param {Object} oldValue 旧数据
     * @param {Object} newValue 新数据
     * @param {jQuery(Element)} el DOM节点
     */
    prettyUpdate: function (oldValue, newValue, el) {
        if (oldValue !== newValue) {
            el.css({
                'opacity': 0
            });

            setTimeout(function () {
                el.html($('<span>', { // TODO:问题：这个语法是什么意思？
                    html: newValue
                }));

                el.css({
                    'opacity': 1
                });
            }, 500);
        }
    },
    /**
     * 更新HTML #heads-up内展示的section
     * @param {Array<string>} targets 待展示的section对应的HTML节点的ID
     */
    showHead: function (targets) {
        $("#heads-up > div").hide(); // 隐藏#heads-up > div节点
        $("#heads-up > div").removeClass(); // 清空#heads-up > div的class
        var l = 12 / targets.length
        _.each(targets, function (target) {
            $("#" + target).parent().parent().addClass("col-lg-" + l + " col-xs-6"); // 按照targets重置相应的#heads-up > div节点的class
            $("#" + target).parent().parent().show(); // 按照targets展示相应的#heads-up > div节点
        })
    },
    showSelet: function (target) {
        $('#showSelect').hide();
        $('#showSelectContent').off('click','li a',clkChannelFunc);
        $('#showSelectContent').off('click','li a',clkPeerFunc);
        $("#showSelectContent").empty();

        var clkChannelFunc=function (e) {
            e.preventDefault();
            var channelName=$(e.target).html();
            $('#showTitle').html($('<span>', {html: channelName}));

            $.when(
                utils.load({ url: 'changeChannel' ,data: { 'channelName':channelName  }})
            ).done(function(data) {
                Tower.section[Tower.current]();
            });
        };
        var clkPeerFunc=function (e) {
            e.preventDefault();
            var peerName=$(e.target).html();
            $('#showTitle').html($('<span>', {html: peerName}));

            $.when(
                utils.load({ url: 'changePeer' ,data: { 'peerName':peerName  }})
            ).done(function(data) {
                Tower.section[Tower.current]();
            });
        };

        var targets = [
            {name: 'channel', showText: "Channels", url: 'channellist',cb:function (data) {
                $("#showSelectContent").empty();
                _.each(data.channelList, function (item) {
                    $("#showSelectContent").append('<li><a href="#">' + item.channelname + '</a></li>')
                })
            },clcFunc:clkChannelFunc},
            {name: 'peers', showText: "Peers", url: 'peerselectlist',cb:function (data) {
                $("#showSelectContent").empty();
                _.each(data.peerlist, function (item) {
                    $("#showSelectContent").append('<li><a href="#">' + item.name + '</a></li>')
                })
            },clcFunc:clkPeerFunc}
        ];

        var selected = _.where(targets, {name: target});

        _.each(selected, function (ele) {
            $("#showSelectTitle").html('Select ' + ele.name + '<b class="caret"></b>');

            $('#showSelectContent').on('click', 'li a',ele.clcFunc);

            $.when(
                utils.load({url: ele.url})
            ).done(function (data) {
                ele.cb(data);
            });

            $('#showSelect').show();
        });

    }
};

