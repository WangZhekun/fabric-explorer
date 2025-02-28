import 'jif-dashboard/dashboard-core';
import 'jif-dashboard/dashboard-util';
import 'jif-dashboard/dashboard-template';

(function () {
  var tour = new Tour({ // bootstrap-tour 用户引导插件
    debug: false,
    //storage: false,
    backdrop: true,
    container: "body",
    backdropContainer: "body",
    onEnd: function () {
      //for autostart
      window.localStorage.setItem('tourEnded', true); // 置缓存中的用户引导程序结束标志
    },

    steps: [].concat([
      {
        element: "div.tower-logo-container",
        title: "Welcome to the Hyperledger Explorer!",
        content: "Let's start with a brief tour",
        container: ".tower-navigation",
        backdropContainer: ".tower-navigation",
        onShow: function () { },
      },
      {
        element: "div.dropdown.settings",
        title: "Select Channel",
        content: "Click to Select Channel to show",
        placement: "left",
        container: ".tower-navigation",
        backdropContainer: ".tower-navigation",
        onShow: function () { },
      },
      {
        element: ".tower-sidebar ul",
        content: "This is the main navigation menu, where you can access the other parts of the tool",
        onShow: function () {
          $(".tower-navigation").css({ "z-index": 1100 });
        },
        onHide: function () {
          $(".tower-navigation").css({ "z-index": 10000 });
        },
      },
    ]).concat([
      //------------------------------------------------------------------------
      // CONSOLE
      {
        element: "#organization",
        title: "Channel",
        content: "You can see all the information in the organization, including peers , channel, chaincodes",
        backdropContainer: ".tower-sidebar",
        onShow: showMenuStep("#console"),
        onHide: hideMenuStep,
      },
      {
        element: "#heads-up",
        content: "Here are some simple metrics which are always available, such as number of connected peers, chaincode number and chancodes count",
        placement: "bottom",
        onShow: showMenuStep("#organization"),
        onHide: hideMenuStep,
      },
      {
        element: "#grounds",
        content: "Here are Network architecture diagram",
        placement: "bottom",
        onShow: showMenuStep("#organization"),
        onHide: hideMenuStep,
      }
    ]).concat([
      //------------------------------------------------------------------------
      // CONSOLE
      {
        element: "#channel",
        title: "Channel",
        content: "You're currently looking at the channel Console, which gives you an overview of the blockchain node running on the local system",
        backdropContainer: ".tower-sidebar",
        onShow: showMenuStep("#console"),
        onHide: hideMenuStep,
      },
      {
        element: "#showTitle",
        content: "current channel name",
        placement: "bottom",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: "#showSelect",
        content: "select other channel in current Organization",
        placement: "bottom",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: "#heads-up",
        content: "Here are some simple metrics which are always available, such as number of connected peers, current block number,  transaction count and chancodes count",
        placement: "bottom",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: "#grounds",
        content: "This is the main application area and is composed of a number of widgets. They can be reordered and resized as needed",
        placement: "top",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.blockinfo",
        content: "This shows the detailed headers stored with each block and contains links to any transactions that were committed in the block as well",
        placement: "bottom",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.blockinfo .show_bock_detailorgin",
        content: "click to show block's detail  ",
        placement: "bottom",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.blocklist",
        content: "List of Blocks, in reverse chronological order. This list will update in realtime",
        placement: "bottom",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.blockview",
        content: "Search for a block or transaction",
        placement: "bottom",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.txdetail",
        content: "This show tx's detail",
        placement: "top",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: "#button_showtxjson",
        content: "click to show tx's JSON  ",
        placement: "top",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.peerlist",
        content: " nodes in channel",
        placement: "top",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.metrix_txn_sec",
        content: "Transactions committed per second",
        placement: "top",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.metrix_txn_min",
        content: "Transactions committed per minute",
        placement: "top",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.metrix_block_min",
        content: "Blocks generated per minute",
        placement: "top",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.chaincodelist",
        content: "show all chaincodes in channel",
        placement: "top",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.keyset",
        content: "show all keys in channel",
        placement: "top",
        onShow: showMenuStep("#channel"),
        onHide: hideMenuStep,
      },
    ]).concat([
      //------------------------------------------------------------------------
      // CONSOLE
      {
        element: "#peers",
        title: "Peers",
        content: "You can see all the information in the peer, including channel , chaincodes",
        backdropContainer: ".tower-sidebar",
        onShow: showMenuStep("#console"),
        onHide: hideMenuStep,
      },
      {
        element: "#showTitle",
        content: "current peer",
        placement: "bottom",
        onShow: showMenuStep("#peers"),
        onHide: hideMenuStep,
      },
      {
        element: "#showSelectTitle",
        content: "select peer in Organization",
        placement: "bottom",
        onShow: showMenuStep("#peers"),
        onHide: hideMenuStep,
      },
      {
        element: "#heads-up",
        content: "Here are some simple metrics which are always available, such as number of  channels, chaincode, ",
        placement: "bottom",
        onShow: showMenuStep("#peers"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.channellist4peer",
        content: "show all channel in peer",
        placement: "top",
        onShow: showMenuStep("#peers"),
        onHide: hideMenuStep,
      },
      {
        element: ".widget-shell.chaincodelist4peer",
        content: "show all chaincode in peer",
        placement: "top",
        onShow: showMenuStep("#chaincodelist4peer"),
        onHide: hideMenuStep,
      }
    ]).concat([
      //------------------------------------------------------------------------
      // API DOCS
      {
        element: "#api",
        title: "API Documentation",
        content: "This dashboard and all related tools are built using a set of RESTful APIs. These APIs provide a friendly interface for interacting with the blockchain and abstract away some of the complexity",
        backdropContainer: ".tower-sidebar",
        onShow: showMenuStep("#api"),
        onHide: hideMenuStep,
      },
    ])
  });

  function loadWidget(tab, widget, click_sel) {
    return function () {
      return new Promise(function (resolve, reject) {
        showMenuStep(tab)();
        if ($(".widget-shell." + widget).length !== 0) {
          return resolve();
        }
        // load it
        $(document).on("WidgetInternalEvent", function (e, action) {
          if (action === "widget|rendered|" + widget) {
            resolve();
            $(document).off(e);
          }
        });
        $(click_sel).click();
      });
    };
  }

  function showMenuStep(id) {
    return function () {
      return new Promise(function (resolve, reject) {
        if (!$(id).hasClass("active")) {
          $(id).click();
        }
        $(".tower-navigation").css({ "z-index": 1100 });
        $(".tower-sidebar").css({ "z-index": 1100 });
        resolve();
      });
    };
  }

  function hideMenuStep() {
    $(".tower-navigation").css({ "z-index": 10000 });
    $(".tower-sidebar").css({ "z-index": 9999 });
  }

  // Initialize the tour 初始化用户引导程序
  tour.init();


  var loaded = false;
  // $(document).on("WidgetInternalEvent", function(e, action) {
  $(document).on("StartTour", function (e, action) { // 监听document的StartTour事件
    //if (action === "node-status|announce" && loaded === false) {
    Tower.tour = tour;
    window.localStorage.setItem("tour_current_step", 0); // always reset to 0 重置当前引导步骤为0
    tour.start(); // 开始用户引导程序
    loaded = true;
    //}
  });

})();
