const checksum_lib = require("./lib/checksum");
const axios = require("axios");
const https = require('https');
const router = require('express').Router();
var PaytmChecksum = require("./lib/PaytmChecksum");



function verifyTransaction(orderId, checksum) {
  return axios.post(process.env.PAYTM_URL + "/order/status", {
    MID: process.env.PAYTM_MID,
    ORDERID: orderId,
    CHECKSUMHASH: checksum
  });
}

function updateOrder(orderId, data) {
  return app.models.Order.findById(orderId).then(function (order) {
    return order.updateAttributes(data);
  });
}

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("G2G paytm api check.");
});

router.post("/generate_txn", function(request, response, next) {
    console.log(request.body);

    var paytmParams = {};

    var orderId = request.body.orderId;

    var amount = request.body.amount;
    var custId = request.body.custId;

    paytmParams.body = {

        /* for custom checkout value is 'Payment' and for intelligent router is 'UNI_PAY' */
        "requestType": "Payment",

        /* Find your MID in your Paytm Dashboard at https://dashboard.paytm.com/next/apikeys */
        "mid": process.env.PAYTM_MID,

        /* Find your Website Name in your Paytm Dashboard at https://dashboard.paytm.com/next/apikeys */
        "websiteName": process.env.NODE_ENV === "production" ? "DEFAULT" : "WEBSTAGING",

        "callbackUrl": process.env.NODE_ENV === "production" ? 'https://securegw.paytm.in/theia/paytmCallback?ORDER_ID=' + orderId : 'https://securegw-stage.paytm.in/theia/paytmCallback?ORDER_ID=' + orderId,
        /* Enter your unique order id */
        "orderId": orderId,

        /* Order Transaction Amount here */
        "txnAmount": {

            /* Transaction Amount Value */
            "value": amount,

            /* Transaction Amount Currency */
            "currency": "INR",
        },

        /* Customer Infomation here */
        "userInfo": {

            /* unique id that belongs to your customer */
            "custId": custId,
        },

    };

    /**
     * Generate checksum by parameters we have in body
     * Find your Merchant Key in your Paytm Dashboard at https://dashboard.paytm.com/next/apikeys 
     */
    PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), process.env.PAYTM_SECRET_KEY).then((checksum) => {
      
      paytmParams.head = {
        "signature"    : checksum
      };

      console.log("-------REQUEST------")
      console.log(paytmParams);

      var post_data = JSON.stringify(paytmParams);

      var options = {

        hostname: process.env.NODE_ENV === 'production'? 'securegw.paytm.in': 'securegw-stage.paytm.in',

        port: 443,
        path: `/theia/api/v1/initiateTransaction?mid=${process.env.PAYTM_MID}&orderId=${orderId}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': post_data.length
        }
      };

      var apiResponse = "";
      var post_req = https.request(options, function(post_res) {
          post_res.on('data', function (chunk) {
            apiResponse += chunk;
          });

          post_res.on('end', function(){
              console.log('Response: ', apiResponse);
              apiResponse = JSON.parse(apiResponse);
              response.send(apiResponse.body.txnToken);
              return 0;
          });
      });

      post_req.write(post_data);
      post_req.end();

      
    })
})


/*---------------------------------------
Generate checksum
--------------------------------------*/

router.get("/generate_checksum", function (req, res, next) {
  const paytmParams = {
    MID: process.env.PAYTM_MID,
    ORDER_ID: req.query["ORDER_ID"],
    CUST_ID: req.query["CUST_ID"],
    TXN_AMOUNT: req.query["TXN_AMOUNT"],
    CHANNEL_ID: req.query["CHANNEL_ID"],
    MOBILE_NO: req.query["MOBILE_NO"],
    WEBSITE: process.env.PAYTM_WEBSITE,
    INDUSTRY_TYPE_ID: "Retail109",
    CALLBACK_URL: "http://goodtogostore.com/express/paytm/verify_checksum"
  };
  console.log(paytmParams);
  checksum_lib.genchecksum(
    paytmParams,
    process.env.PAYTM_SECRET_KEY,
    function (err, checksum) {
      if (err) {
        console.error("Error generating checking for paytm");
        console.error(err);
      }
      /* for Staging */
      var url = process.env.PAYTM_URL + "/order/process";

      // console.log("======GENERATE CHECKSUM ========");
      // console.log(checksum);
      // console.log("==========================");
      /* for Production */
      // var url = "https://securegw.paytm.in/order/process";

      /* Prepare HTML Form and Submit to Paytm */
      res.writeHead(200, {
        "Content-Type": "text/html"
      });
      res.write("<html>");
      res.write("<head>");
      res.write("<title>Merchant Checkout Page</title>");
      res.write("</head>");
      res.write("<body>");
      res.write(
        "<center><h1>Please do not refresh this page...</h1></center>"
      );
      res.write(
        '<form method="post" action="' + url + '" name="paytm_form">'
      );
      for (var x in paytmParams) {
        res.write(
          '<input type="hidden" name="' +
          x +
          '" value="' +
          paytmParams[x] +
          '">'
        );
      }
      res.write(
        '<input type="hidden" name="CHECKSUMHASH" value="' + checksum + '">'
      );
      res.write("</form>");
      res.write('<script type="text/javascript">');
      res.write("document.paytm_form.submit();");
      res.write("</script>");
      res.write("</body>");
      res.write("</html>");
      res.end();
    }
  );
});

router.get("/payment_success", function (req, res, next) {
  res.sendFile(__dirname + "/payment_success.html");
});
router.get("/payment_failure", function (req, res, next) {
  res.sendFile(__dirname + "/payment_failure.html");
});
router.get("/payment_pending", function (req, res, next) {
  res.sendFile(__dirname + "/payment_pending.html");
});
router.post("/verify_checksum", function (req, res, next) {
  // console.log("======VERIFY CHECKSUM ========");
  // console.log(req.body);
  // console.log("==========================");
  var paytmParams = {};
  var paytmChecksum;
  for (var key in req.body) {
    if (key == "CHECKSUMHASH") {
      paytmChecksum = req.body[key];
    } else {
      paytmParams[key] = req.body[key];
    }
  }
  var isValidChecksum = checksum_lib.verifychecksum(
    paytmParams,
    process.env.PAYTM_SECRET_KEY,
    paytmChecksum
  );
  if (isValidChecksum) {
    console.log("Checksum Matched");
    const orderId = req.body.ORDERID;
    verifyTransaction(orderId, paytmChecksum)
      .then(function (verificationResponse) {
        if (verificationResponse.status == 200) {
          switch (verificationResponse.data.STATUS) {
            case "TXN_SUCCESS":
              res.redirect(
                "/express/paytm/payment_success"
              );
              break;
            case "PENDING":
              res.redirect(
                "/express/paytm/payment_pending"
              );
              break;
            case "TXN_FAILURE":
              res.redirect(
                "/express/paytm/payment_failure"
              );
              break;
          }
          return;
        }
      })
      .catch(function (err) {
        console.error(err);
      });
  } else {
    console.log("Checksum Mismatched");
    res.redirect(
      "/express/paytm/payment_failure"
    );
  }
});

module.exports = router;