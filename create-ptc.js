var Nightmare = require('nightmare');
var fs = require('fs');
var chalk = require('chalk');
var request = require('request');
var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/accGen";
var config = require('./config');


var showWindow = true;
var username = 'habakuk';
var debug = true;


if (config.useAutoCatcha)
    showWindow = false;

var outputFile = "accounts.csv";
var outputFormat = "ptc,%NICK%,%PASS%,%UN%\r\n";

var url_ptc = "https://club.pokemon.com/us/pokemon-trainer-club/sign-up/";
var nightmare_opts = {
    show: showWindow,
    waitTimeout: 10000,
    gotoTimeout: 5000,
    loadTimeout: 5000
};


var nightmare = Nightmare(nightmare_opts);
nightmare.useragent("Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36");

createAccount(config.start);

function handleError(err) {
    if (debug) {
        console.log("[DEBUG] Error:" + JSON.stringify(err));
    }
    return err;
}
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function getRandomNumbers(length) {
    return Math.random().toString().substr(2, length);
}

function getRandomSymbols(length) {
    var str = "";

    for (var i = 0; i < length; i++) {
        var symbols = ["#", "?", "!", "@", "$", "%", "^", "&", ">", "<", "+", "`", "*", "(", ")", "-", "[", "]"];
        str += symbols[getRandomInt(0, symbols.length - 1)];
    }

    return str;
}
function randomPassword() {
    return (Math.random().toString(36) + '00000000000000000').slice(2, 8) + getRandomNumbers(3) + getRandomSymbols(3) + "ABC";
}


/**
 * Account erstellung starten
 * @param ctr
 */
function createAccount(ctr) {
    console.log("Creating account " + ctr + " of " + config.end);

    handleFirstPage(ctr);
}


/**
 * Erste Seite initialisieren
 * @param ctr
 */
function handleFirstPage(ctr) {
    if (debug) {
        console.log("[DEBUG] Erste Seite #" + ctr);
    }

    nightmare.goto(url_ptc)
        .evaluate(evaluateDobPage)
        .then(function(validated) {
            if (!validated) {
                // Missing form data, loop over itself
                console.log("[" + ctr + "] Kann PTC loginpage nicht aufrufen");
                return function() {
                    nightmare.wait(500).refresh().wait();
                    handleFirstPage(ctr);
                };
            } else {
                return function() {
                    fillFirstPage(ctr);
                };
            }
        })
        .then(function(next) {
            return next();
        })
        .catch(handleError)
        .then(function(err) {
            if (typeof err !== "undefined") {
                return handleFirstPage(ctr);
            }
        });
}

/**
 * Erste Seite ausfüllen
 * @param ctr
 */
function fillFirstPage(ctr) {
    if (debug) {
        console.log("[DEBUG] Erste Seite ausfüllen #" + ctr);
    }

    nightmare.evaluate(function(data) {
        var dob = new Date((new Date()).getTime() - (Math.random() * (new Date()).getTime()) - 18 * 365 * 24 * 60 * 60 * 1000);
        document.getElementById("id_dob").value = dob.getFullYear() + "-" + (dob.getMonth() + 1) + "-" + dob.getDate();

        var els = document.getElementsByName("country");
        for (var i = 0; i < els.length; i++) {
            els[i].value = data.country;
        }

        return document.getElementById("id_dob").value;
    }, {
        country: 'DE'
    })
        .click("form[name='verify-age'] [type=submit]")
        .wait("#id_username")
        .then(function() {
            console.log('GoTo SignUp');
            handleSignupPage(ctr);
        })
        .catch(handleError)
        .then(function(err) {
            if (typeof err !== "undefined") {
                return handleFirstPage(ctr);
            }
            console.log('Catch');
        });
}

/**
 * Zweite Seite Initialisieren
 * @param ctr
 */
function handleSignupPage(ctr) {
    if (debug) {
        console.log("[DEBUG] Zweite Seite #" + ctr);
    }

    nightmare.evaluate(evaluateSignupPage)
        .then(function(validated) {
            if (!validated) {
                // Missing form data, loop over itself
                console.log("[" + ctr + "] Kann PTC loginpage nicht aufrufen");
                return function() {
                    nightmare.wait(500).refresh().wait();
                    handleFirstPage(ctr);
                };
            } else {
                return function() {
                    fillSignupPage(ctr);
                };
            }
        }).then(function(next) {
        return next();
    })
        .catch(handleError)
        .then(function(err) {
            if (typeof err !== "undefined") {
                return handleSignupPage(ctr);
            }
        });
}

/**
 * Zweite Seite ausfüllen
 * @param ctr
 */
function fillSignupPage(ctr) {
    if (debug) {
        console.log("[DEBUG] Zweite Seite ausfüllen #" + ctr);
    }

    var _pass = randomPassword();
    var _nick = config.username + ctr;

    if (config.useAutoCatcha) {
        nightmare.evaluate(function(data) {
            document.getElementById("id_password").value = data.pass;
            document.getElementById("id_confirm_password").value = data.pass;
            document.getElementById("id_email").value = data.email_user === "" ? data.nick + "@" + data.email_domain : data.email_user + "+" + data.nick + "@" + data.email_domain;
            document.getElementById("id_confirm_email").value = data.email_user === "" ? data.nick + "@" + data.email_domain : data.email_user + "+" + data.nick + "@" + data.email_domain;
            document.getElementById("id_screen_name").value = data.nick;
            document.getElementById("id_username").value = data.nick;
            window.scrollTo(0, document.body.scrollHeight);
        }, {
            "pass": _pass,
            "nick": _nick,
            "email_user": config.email_user,
            "email_domain": config.email_domain
        })
            .check("#id_terms");


        nightmare.evaluate(function() {
            return document.getElementsByClassName("g-recaptcha")[0].getAttribute('data-sitekey');
        }).then(function(result) {
            console.log("Start recaptcha solving");

            request('http://2captcha.com/in.php?key=' + config.captchaApiKey + '&method=userrecaptcha&googlekey=' + result + '&pageurl=club.pokemon.com', function(error, response, body) {
                if (error) throw error;

                console.log("Checking status of captcha id: " + body.substring(3));

                var checkCaptcha = function() {
                    request('http://2captcha.com/res.php?key=' + config.captchaApiKey + '&action=get&id=' + body.substring(3), function(error, response, body) {
                        if (error) throw error;

                        if (body.substring(0, 2) == "OK") {
                            var captchaValidation = body.substring(3);
                            nightmare.evaluate(function(data) {
                                document.getElementById("g-recaptcha-response").value = data.captchaValidation;
                            }, {
                                captchaValidation: captchaValidation
                            })
                                .click('.button-green[value=" Continue"]')
                                .then(function() {
                                    nightmare.wait(function() {
                                        return (document.getElementById("signup-signin") !== null || document.getElementById("btn-reset") !== null || document.body.textContent.indexOf("That username already exists") > -1);
                                    })
                                        .evaluate(function() {
                                            return (document.body.textContent.indexOf("Hello! Thank you for creating an account!") > -1);
                                        })
                                        .then(function(success) {
                                            if (success) {
                                                // Log it in the file of used nicknames
                                                var content = outputFormat.replace('%NICK%', _nick).replace('%PASS%', _pass).replace('%UN%', _nick);
                                                fs.appendFile(outputFile, content, function(err) {
                                                    if (err) throw err;
                                                });
                                            } else {
                                                console.log("[x] Failed username " + _nick);
                                            }

                                            // Next one, or stop
                                            if (ctr < config.end) {
                                                return function() {
                                                    createAccount(ctr + 1);
                                                };
                                            } else {
                                                return nightmare.end();
                                            }
                                        }).then(function(next) {
                                        return next();
                                    }).catch(handleError)
                                        .then(function(err) {
                                            if (typeof err !== "undefined") {
                                                return handleSignupPage(ctr);
                                            }
                                        });
                                });
                        } else {
                            // Not ready yet...
                            setTimeout(checkCaptcha, 2000);
                        }
                    });
                };
                setTimeout(checkCaptcha, 2000);
            });
        });
    } else {
        nightmare.evaluate(function(data) {
            document.getElementById("id_password").value = data.pass;
            document.getElementById("id_confirm_password").value = data.pass;
            document.getElementById("id_email").value = data.email_user === "" ? data.nick + "@" + data.email_domain : data.email_user + "+" + data.nick + "@" + data.email_domain;
            document.getElementById("id_confirm_email").value = data.email_user === "" ? data.nick + "@" + data.email_domain : data.email_user + "+" + data.nick + "@" + data.email_domain;
            document.getElementById("id_screen_name").value = data.nick;
            document.getElementById("id_username").value = data.nick;
            window.scrollTo(0, document.body.scrollHeight);
        }, {
            "pass": _pass,
            "nick": _nick,
            "email_user": config.email_user,
            "email_domain": config.email_domain
        })
            .check("#id_terms")
            .wait(function() {
                return (document.getElementById("signup-signin") !== null || document.getElementById("btn-reset") !== null || document.body.textContent.indexOf("That username already exists") > -1);
            })
            .evaluate(function() {
                return (document.body.textContent.indexOf("Ende") > -1);
            })
            .then(function(success) {
                if (success) {
                    // Log it in the file of used nicknames
                    var content = outputFormat.replace('%NICK%', _nick).replace('%PASS%', _pass).replace('%UN%', _nick);
                    fs.appendFile(outputFile, content, function(err) {
                        if (err) throw err;
                    });
                } else {
                    console.log("[x] Username nicht erlaubt " + _nick);
                }

                // Next one, or stop
                if (ctr < config.end) {
                    return function() {
                        createAccount(ctr + 1);
                    };
                } else {
                    return nightmare.end();
                }
            }).then(function(next) {
            return next();
        }).catch(handleError)
            .then(function(err) {
                if (typeof err !== "undefined") {
                    return handleSignupPage(ctr);
                }
            });
    }
}

// Evaluations
function evaluateDobPage() {
    var dob_value = document.getElementById("id_dob");
    return ((document.title === "The Official Pokémon Website | Pokemon.com") && (dob_value !== null));
}

function evaluateSignupPage() {
    var username_field = document.getElementById("id_username");
    return ((document.title === "The Official Pokémon Website | Pokemon.com") && (username_field !== null));
}