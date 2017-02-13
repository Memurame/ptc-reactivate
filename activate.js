var Nightmare = require('nightmare');
var fs = require('fs');
var chalk = require('chalk');

/**
 * Check accounts file exists
 */
if (!fs.existsSync('accounts.csv')) {
    console.log("accounts.csv don't exists!");
    return;
}

/**
 * Set variables
 */
var accounts = [];
var i = 0;
var debug = true;
var columns = ["username", "password", "provider"];

/**
 * CSV to array
 */
require("csv-to-array")({
    file: "accounts.csv",
    columns: columns
}, function (err, array) {
    accounts = array;
    console.log("Start Activate...")
    /**
     * Loop accounts array
     */
    array.forEach(function(val){
        /**
         * Set timeout and Init nightmare
         */
        var timeout = i * 6000;
        var nightmare = new Nightmare({ show: false });
        setTimeout(function(i){
            /**
             * Fill out the form
             */
            nightmare
                .goto('https://club.pokemon.com/us/pokemon-trainer-club/activated')
                .type('#id_username', val['username'])
                .type('#id_password', val['password'])
                .click('input[value="Continue"]')
                .end()
                .then(function(){
                    if(debug){ console.log(val['username'] + " -> " + chalk.green("done")); }
                })
                .catch(function (error) {
                    console.log(val['username'] + " -> " + chalk.red("error"));
                });
        }, timeout, true);

        i++;
    });


});