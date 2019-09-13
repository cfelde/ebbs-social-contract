var EbbsSocialForum = artifacts.require("EbbsSocialForum");
var AllowPreAction = artifacts.require("AllowPreAction");
var BlockPreAction = artifacts.require("BlockPreAction");
var NullPostAction = artifacts.require("NullPostAction");

function stringToBytes(str) {
    var ch, st, re = [];

    for (var i = 0; i < str.length; i++ ) {
        ch = str.charCodeAt(i);
        st = [];
        do {
            st.push( ch & 0xFF );
            ch = ch >> 8;
        } while (ch);

        re = re.concat(st.reverse());
    }

    return re;
}

module.exports = function(deployer, network, accounts) {
    deployer.deploy(EbbsSocialForum, stringToBytes("123"), [], false);
    deployer.deploy(AllowPreAction);
    deployer.deploy(BlockPreAction);
    deployer.deploy(NullPostAction);
};
