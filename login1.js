
var isshowmiddle = document.getElementById("middle");
var isshowright = document.getElementById("right");
$(document).ready(function() {
    init();
    initHead();
    initSendButton();
    initShow();
    var timer;
    var hasClick = false;
    $(".wechat").on('click', function (e) {
        if(!hasClick) {
            $("#ewcode").addClass("show").removeClass("hide");
            $("#qrCode").attr('src',qrCodeUrl);
            timer = setInterval(loginRequest, 2000);
            hasClick = true;
        } else {
            $("#ewcode").removeClass("show").addClass("hide");
            $("#qrCode").attr('src',"");
            clearInterval(timer);
            hasClick = false;
        }
    });

    $(".wechat2").on('click', function (e) {
        clearInterval(timer);
        $("#ewcode3").removeClass('show');
        $("#ewcode3").hide();
        $("#qrCode3").attr('src',"");
        if($("#ewcode2").hasClass('show')) {
            $("#ewcode2").removeClass('show');
            $("#qrCode2").attr('src',"");
            $("#ewcode2").hide();
            clearInterval(timer);
        } else {
            $("#ewcode2").addClass('show');
            $("#qrCode2").attr('src',qrCodeUrl);
            $("#ewcode2").show();
            timer = setInterval(loginRequest, 2000);
        }
    });

    // $(".wechat2").on('click', function (e) {
    //     if(!hasClick) {
    //         $("#ewcode2").addClass("show").removeClass("hide");
    //         $("#qrCode2").attr('src',qrCodeUrl);
    //         timer = setInterval(loginRequest, 2000);
    //         hasClick = true;
    //     } else {
    //         $("#ewcode2").removeClass("show").addClass("hide");
    //         $("#qrCode2").attr('src',"");
    //         clearInterval(timer);
    //         hasClick = false;
    //     }
    // });

    $(".weibo").on('click', function (e) {
        clearInterval(timer);
        $("#ewcode2").removeClass('show');
        $("#ewcode2").hide();
        $("#qrCode2").attr('src',"");
        if($("#ewcode3").hasClass('show')) {
            $("#ewcode3").removeClass('show');
            $("#qrCode3").attr('src',"");
            $("#ewcode3").hide();
            clearInterval(timer);
        } else {
            $("#ewcode3").addClass('show');
            $("#qrCode3").attr('src',qrCodeUrl);
            $("#ewcode3").show();
            timer = setInterval(loginRequest, 2000);
        }
    });

    // $(".weibo").on('click', function (e) {
    //     if(!hasClick) {
    //         $("#ewcode3").addClass("showApp").removeClass("hide");
    //         $("#qrCode3").attr('src',qrCodeUrl);
    //         timer = setInterval(loginRequest, 2000);
    //         hasClick = true;
    //     } else {
    //         $("#ewcode3").removeClass("showApp").addClass("hide");
    //         $("#qrCode3").attr('src',"");
    //         clearInterval(timer);
    //         hasClick = false;
    //     }
    // });

    $(".wechat2").on("mouseover", function (e) {
        $(".wechat2 .hint").removeClass("none").addClass("tip1");
        $("#wechat_change").attr("src","themes/sudy_jkdnew/images/wechat_change.png");
    });
    $(".wechat2").on("mouseout", function (e) {
        $(".wechat2 .hint").removeClass("tip1").addClass("none");
        $("#wechat_change").attr("src","themes/sudy_jkdnew/images/wechat.png");
    });

    $(".qq").on("mouseover", function (e) {
        $(".qq .hint").removeClass("none").addClass("tip1");
        $("#qq_change").attr("src","themes/sudy_jkdnew/images/qq_change.png");
    });
    $(".qq").on("mouseout", function (e) {
        $(".qq .hint").removeClass("tip1").addClass("none");
        $("#qq_change").attr("src","themes/sudy_jkdnew/images/qq.png");
    });

    $(".qq").on('click', function (e) {
        toqqLogin();
    });

    $(".weibo").on("mouseover", function (e) {
        $(".weibo .hint").removeClass("none").addClass("tip");
        $("#weibo").attr("src","themes/sudy_jkdnew/images/app_change.png");
    });
    $(".weibo").on("mouseout", function (e) {
        $(".weibo .hint").removeClass("tip").addClass("none");
        $("#weibo").attr("src","themes/sudy_jkdnew/images/app.png");
    });


});
function init() {
    if (document.getElementById("qqimg")) {
        document.getElementById("qqimg").title = "qq账号";
    }
    if (document.getElementById("weiboimg")) {
        document.getElementById("weiboimg").title = "微博账号";
    }
    if (!document.getElementById("qqimg") && !document.getElementById("weiboimg")) {
        document.getElementById("otherway").style.display = "none";
    }



    if (!$("#remark_text").text()) {
        $(".remark").hide();
    }
    if (!document.getElementById("msg1")) {
        if (document.getElementById("swiSpan1")) {
            document.getElementById("swiSpan1").style.display = "";
        }
    }
    if (!document.getElementById("msg2")) {
        if (document.getElementById("swiSpan2")) {
            document.getElementById("swiSpan2").style.display = "";
        }
    }
    //var timer;
    $('.left').on('click', function(event) {
        clearInterval(timer);
        event.preventDefault();
        $(this).addClass("active");
        $('.right').removeClass("active");
        $('.middle').removeClass("active");
        $('.left-login').show();
        $("#fm1").show();
        $("#fm2").hide();
        $('.qr-code').hide();
        document.getElementById("swiSpan1").style.display = "";
        if (document.getElementById("msg1")) {
            document.getElementById("msg1").style.display = "none";
        }
    });
    if (isshowmiddle) {
        $('.middle').on('click', function(event) {
            clearInterval(timer);
            event.preventDefault();
            $(this).addClass("active");
            $('.right').removeClass("active");
            $('.left').removeClass("active");
            $('.left-login').show();
            $("#fm2").show();
            $("#fm1").hide();
            $('.qr-code').hide();
            document.getElementById("swiSpan2").style.display = "";
            document.getElementById("msg2").style.display = "none";
        });
    }

    $('.right').on('click', function(event) {
        event.preventDefault();
        $(this).addClass("active");
        $('.left').removeClass("active");
        $('.middle').removeClass("active");
        $('.left-login').hide();
        $('.qr-code').show();
        $("#qrCode").attr('src', qrCodeUrl);
        timer = setInterval(loginRequest, 2000);
    });
}

function initHead() {
    if (isshowmiddle && isshowright) {
        $("#fm2").hide();
        $('.qr-code').hide();
    } else if (!isshowmiddle && isshowright) {
        $("#fm2").hide();
        $('.qr-code').hide();
    } else if (isshowmiddle && !isshowright) {
        $("#fm2").hide();
        $('.qr-code').hide();
    } else {
        $("#headid").hide();
    }

}

function initSendButton() {
    var send_obj = $('#send_button');
    send_obj.click(function() {
        if (send_obj.hasClass("disable")) {
            return
        }
        var $username = $("#request_username");
        var username = $username.val().replace(/\s/gi, "");
        if (isValid(username)) {//
            $.ajax({
                type: "post",
                url: contextPath + "/smsLogin/sendSms",
                dataType: "json",
                data: {
                    "request_username": username
                },
                success: function(result) {
                    if (result.success) {
                        start_sms_button(send_obj);
                    }
                    else {
                        alert(result.errormsg);
                        $username.focus();
                    }
                }
            });
        } else {
            alert("请输入绑定的手机号或者邮箱！");
            $username.focus();
        }
    });
}

function initShow() {
    if (isSmsLogin) {
        $('.middle').css({
            'border-bottom': '3px solid #fff',
            'color': '#fff'
        });
        $('.right').css({
            'border-bottom': '1px solid #b8b8b8',
            'color': '#b8b8b8'
        });
        $('.left').css({
            'border-bottom': '1px solid #b8b8b8',
            'color': '#b8b8b8'
        });
        $('.left-login').show();
        $("#fm2").show();
        $("#fm1").hide();
        $('.qr-code').hide();
    }
}

function isValid(obj) {
    return obj != null && obj != '';
}

function isMobile(obj) {
    var regex = /^1(3|4|5|7|8)\d{9}$/;
    return regex.test(obj);
}

function start_sms_button(obj) {
    var count = 0;
    var sum = 60;
    obj.addClass("disable").text(parseInt(sum - count) + '秒');
    var i = setInterval(function() {
        count++;
        if (count >= 60) {
            obj.text('获取验证码').removeClass("disable");
            clearInterval(i);
        } else {
            obj.text(parseInt(sum - count) + '秒');
        }
    }, 1000);
}

function loginRequest() {
    $.post(ajaxLoginUrl, {}, function(result) {
        if (result == "success") {
            document.location.href=document.location.href;
            //window.location.reload();
        } else if (result == "userlimit") {
            // alert("not one user login");
            // window.location.reload();
        }
    }, "text");
}

function refreshCaptcha(captcah) {
    var tmp = contextPath + "/captcha.jpg?tt=" + Math.random();
    captcah.src = tmp;
}

function checkDynamicLogin() {
    var request_username = $("#request_username").val();
    if (request_username == null || request_username == '') {
        var placeholder = $("#request_username").attr("placeholder");
        alert("请输入您绑定的" + placeholder + "!");
        return false;
    }
    var smscode = $("#smscode").val();
    if (smscode == null || smscode == '') {
        alert("请输入您收到动态验证码!");
        return false;
    }
    return true;
}

function checkPassLogin() {
    var username = $("#username").val();
    if (username == null || username == '') {
        alert("请输入用户名!");
        return false;
    }
    var password = $("#password").val();
    if (password == null || password == '') {
        alert("请输入用户密码!");
        return false;
    }
    if (document.getElementById("authcode")) {
        var authcode = $("#authcode").val();
        if (authcode == null || authcode == '') {
            alert("请输入验证码!");
            return false;
        }
    }
    setCookieUserInfo(username, password);
    if(document.getElementById("encrypted")) {
        var thisPwd = document.getElementById("password").value;
        if(thisPwd.length != 256){
            RSAUtils.setMaxDigits(131);
            var key = RSAUtils.getKeyPair("010001", '', "008aed7e057fe8f14c73550b0e6467b023616ddc8fa91846d2613cdb7f7621e3cada4cd5d812d627af6b87727ade4e26d26208b7326815941492b2204c3167ab2d53df1e3a2c9153bdb7c8c2e968df97a5e7e01cc410f92c4c2c2fba529b3ee988ebc1fca99ff5119e036d732c368acf8beba01aa2fdafa45b21e4de4928d0d403");
            var result = RSAUtils.encryptedString(key, thisPwd);
            $("#password").val(result);
        }
    }
    return true;
}

function toqqLogin()
{
    var iHeight = 400;
    var iWidth = 800;
    var iTop = (window.screen.height - 30 - iHeight) / 2; //获得窗口的垂直位置;
    var iLeft = (window.screen.width - 10 - iWidth) / 2; //获得窗口的水平位置;
    //以下为按钮点击事件的逻辑。注意这里要重新打开窗口
    //否则后面跳转到QQ登录，授权页面时会直接缩小当前浏览器的窗口，而不是打开新窗口
    var A = window.open(qqAuthorizeURL, "TencentLogin",
        "width=" + iWidth + ",height=" + iHeight + ",top=" + iTop + ",left=" + iLeft + ",menubar=0,scrollbars=1,resizable=1,status=1,titlebar=0,toolbar=0,location=1");
}

function toweiboLogin()
{
    var iHeight = 400;
    var iWidth = 800;
    var iTop = (window.screen.height - 30 - iHeight) / 2; //获得窗口的垂直位置;
    var iLeft = (window.screen.width - 10 - iWidth) / 2; //获得窗口的水平位置;
    //以下为按钮点击事件的逻辑。注意这里要重新打开窗口
    //否则后面跳转到QQ登录，授权页面时会直接缩小当前浏览器的窗口，而不是打开新窗口
    var A = window.open(wbAuthorizeURL, "weiboLogin",
        "width=" + iWidth + ",height=" + iHeight + ",top=" + iTop + ",left=" + iLeft + ",menubar=0,scrollbars=1,resizable=1,status=1,titlebar=0,toolbar=0,location=1");
}
